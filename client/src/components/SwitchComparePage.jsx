import React, { useState, useEffect, useMemo } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { supabase } from '../supabase';
import { Loader2, Printer } from 'lucide-react';
import { getProductRank } from '../utils/productStandardizer';

export default function SwitchComparePage() {
  const { items, switchCompareColumns: columns, setSwitchCompareColumns: setColumns, customer } = useQuoteStore();
  const addToast = useToastStore((s) => s.addToast);
  const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, brands(id, name)')
      .eq('product_type', 'Manual Product');

    if (error) {
      addToast('Failed to load products', 'error');
    } else {
      setAllProducts(data || []);
      
      // Initialize first column based on cart
      const cartProduct = data?.find(p => items.some(it => (it.cartItemId || it.id) === p.id));
      const initProduct = cartProduct || (data && data[0]);
      
      
      if (initProduct && columns[0].brandId === '') {
        setColumns(prev => {
          const newCols = [...prev];
          newCols[0] = {
            brandId: initProduct.brand_id?.toString() || '',
            subBrand: initProduct.sub_brand || '',
            color: initProduct.color || '',
            discount: '',
            gstIncluded: false
          };
          return newCols;
        });
      }
    }
    setLoading(false);
  }

  // Extracted unique cart items to compare (deduplicate by standard product name)
  const compareItems = useMemo(() => {
    const map = new Map();
    items.forEach(item => {
      // For Switch System, we compare based on item.name
      const name = item.name;
      if (!map.has(name)) {
        map.set(name, {
          name,
          quantity: item.quantity,
          isManual: item.product_type === 'Manual Product', 
        });
      } else {
        map.get(name).quantity += item.quantity;
      }
    });
    return Array.from(map.values()).sort((a, b) => getProductRank(a.name) - getProductRank(b.name));
  }, [items]);

  // Derived options for dropdowns
  const getBrands = () => {
    const map = new Map();
    allProducts.forEach(p => {
      if (p.brands) map.set(p.brands.id, p.brands.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name));
  };

  const getSubBrands = (brandId) => {
    if (!brandId) return [];
    const subs = new Set();
    allProducts.filter(p => p.brand_id?.toString() === brandId && p.sub_brand).forEach(p => subs.add(p.sub_brand));
    return Array.from(subs).sort();
  };

  const getColors = (brandId, subBrand) => {
    if (!brandId) return [];
    const cols = new Set();
    allProducts.filter(p => 
      p.brand_id?.toString() === brandId && 
      (subBrand ? p.sub_brand === subBrand : !p.sub_brand) &&
      p.color
    ).forEach(p => cols.add(p.color));
    return Array.from(cols).sort();
  };

  // Helper to update a column state
  const updateColumn = (index, field, value) => {
    setColumns(prev => {
      const newCols = [...prev];
      newCols[index] = { ...newCols[index], [field]: value };
      
      // Reset dependencies
      if (field === 'brandId') {
        newCols[index].subBrand = '';
        newCols[index].color = '';
      } else if (field === 'subBrand') {
        newCols[index].color = '';
      }
      return newCols;
    });
  };

  // Helper to calculate total for a column
  const calculateColumnTotal = (colState) => {
    let subtotal = 0;
    const globalDisc = parseFloat(colState.discount) || 0;
    
    // Find matching products in the DB for this variant
    const variantProducts = allProducts.filter(p => 
      p.brand_id?.toString() === colState.brandId &&
      (colState.subBrand ? p.sub_brand === colState.subBrand : !p.sub_brand) &&
      (colState.color ? p.color === colState.color : !p.color)
    );

    compareItems.forEach(cartItem => {
      const match = variantProducts.find(p => p.name === cartItem.name);
      if (match) {
        const price = match.base_price || 0;
        const discountedPrice = price - (price * globalDisc / 100);
        subtotal += discountedPrice * cartItem.quantity;
      }
    });

    if (colState.gstIncluded) {
      subtotal += subtotal * 0.18;
    }

    return Math.round(subtotal);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (compareItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-white p-8">
        <div className="text-center text-gray-500 text-lg">
          <p>Your cart is empty.</p>
          <p className="text-sm mt-2">Go to the "New Quote" tab or load a quote from "History" to compare pricing.</p>
        </div>
      </div>
    );
  }

  const allBrands = getBrands();

  return (
    <div className="flex flex-col h-full print:h-auto print:block overflow-y-auto print:overflow-visible bg-gray-50 p-4 print:p-0 print:bg-white">
      <style>{`
        @media print {
          .no-print-price { display: none !important; }
        }
      `}</style>
      <div className="flex justify-between items-center mb-4 shrink-0 print:hidden">
        <h2 className="text-xl font-bold text-gray-800">Compare Switch Pricing</h2>
        <button onClick={() => window.print()} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow flex items-center gap-2 transition-colors">
          <Printer className="w-4 h-4" /> Save as PDF
        </button>
      </div>

      {/* --- PRINT HEADER --- */}
      <div className="hidden print:block w-full">
        {/* Company Header */}
        <div className="flex justify-between items-start mb-6">
          <div></div>
          <div className="text-right">
            <img src="/mamta.png" alt="Mamta Logo" className="w-[250px] inline-block mb-1" onError={(e) => e.target.style.display = 'none'} />
            <h2 className="text-xl font-bold text-blue-600 hidden" id="logo-fallback">MAMTA</h2>
            <div className="text-[11px] leading-relaxed text-gray-700">
              12, Kashyap Chambers, Opp. Mudit Palace,<br />
              Station Road, Bardoli - 394601
            </div>
          </div>
        </div>

        {/* Customer & Quote Metadata */}
        <div className="flex justify-between items-start border-t border-b border-gray-200 py-3 mb-6 text-sm font-semibold">
          <div className="space-y-1">
            <div>To: {customer?.name || 'N/A'}</div>
            <div>Phone: {customer?.phone || 'N/A'}</div>
            {customer?.project && <div>Project: {customer.project}</div>}
          </div>
          <div className="text-right space-y-1">
            <div>Date: {dateStr}</div>
            <div>Type: Switch Quote Comparison</div>
          </div>
        </div>

        {/* Quotation Title */}
        <h3 className="text-center text-xl font-bold underline mb-6 tracking-wide">COMPARISON</h3>
      </div>
      {/* --- END PRINT HEADER --- */}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 print:grid-cols-3 gap-6 print:gap-2 flex-1 min-h-0 print:overflow-visible">
        {[0, 1, 2].map(colIndex => {
          const colState = columns[colIndex];
          const colSubBrands = getSubBrands(colState.brandId);
          const colColors = getColors(colState.brandId, colState.subBrand);
          
          const variantProducts = allProducts.filter(p => 
            p.brand_id?.toString() === colState.brandId &&
            (colState.subBrand ? p.sub_brand === colState.subBrand : !p.sub_brand) &&
            (colState.color ? p.color === colState.color : !p.color)
          );

          const total = calculateColumnTotal(colState);

          return (
            <div key={colIndex} className="bg-white rounded-xl shadow-md border border-gray-200 flex flex-col h-full print:h-auto overflow-hidden min-h-[500px] print:min-h-0 print:shadow-none">
              {/* Variant Selector */}
              <div className="p-4 bg-purple-50 border-b border-purple-100 flex flex-col gap-3 shrink-0 print:bg-white print:border-gray-300">
                <div className="font-bold text-purple-900 text-sm tracking-wide">VARIANT {colIndex + 1}</div>
                <select
                  className="input-field py-2 text-sm bg-white"
                  value={colState.brandId}
                  onChange={(e) => updateColumn(colIndex, 'brandId', e.target.value)}
                >
                  <option value="">Select Brand</option>
                  {allBrands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <select
                  className="input-field py-2 text-sm bg-white"
                  value={colState.subBrand}
                  onChange={(e) => updateColumn(colIndex, 'subBrand', e.target.value)}
                  disabled={!colState.brandId || colSubBrands.length === 0}
                >
                  <option value="">Select Sub-Brand</option>
                  {colSubBrands.map(sb => (
                    <option key={sb} value={sb}>{sb}</option>
                  ))}
                </select>
                <select
                  className="input-field py-2 text-sm bg-white"
                  value={colState.color}
                  onChange={(e) => updateColumn(colIndex, 'color', e.target.value)}
                  disabled={!colState.brandId || colColors.length === 0}
                >
                  <option value="">Select Color</option>
                  {colColors.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              {/* Settings: Discount and GST */}
              <div className="p-3 bg-white border-b border-gray-100 flex flex-col gap-2 shrink-0 print:hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Discount (%)</span>
                  <input 
                    type="number"
                    placeholder="0"
                    className="input-field py-1 px-2 text-sm w-16 text-right"
                    value={colState.discount}
                    onChange={(e) => updateColumn(colIndex, 'discount', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Add 18% GST</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={colState.gstIncluded}
                      onChange={(e) => updateColumn(colIndex, 'gstIncluded', e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
              </div>

              {/* Itemized List */}
              <div className="flex-1 overflow-y-auto print:overflow-visible p-0 min-h-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-gray-600">Product</th>
                      <th className="px-2 py-2 font-semibold text-gray-600 text-center w-12">Qty</th>
                      <th className="px-4 py-2 font-semibold text-gray-600 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareItems.map(cartItem => {
                      const match = variantProducts.find(p => p.name === cartItem.name);
                      const basePrice = match ? (match.base_price || 0) : 0;
                      const discPercent = parseFloat(colState.discount) || 0;
                      const discountedPrice = basePrice - (basePrice * discPercent / 100);
                      const lineTotal = discountedPrice * cartItem.quantity;
                      
                      return (
                        <tr key={cartItem.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{cartItem.name}</div>
                            {match ? (
                              <div className="text-xs text-gray-500 no-print-price print:hidden">
                                ₹{basePrice} each
                              </div>
                            ) : (
                              <div className="text-xs text-red-500 italic no-print-price print:hidden">N/A</div>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center text-gray-600 font-semibold bg-gray-50/50">
                            {cartItem.quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            ₹{lineTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grand Total Footer */}
              <div style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} className="bg-purple-100 text-purple-900 border-t-2 border-purple-500 p-4 text-center shrink-0 rounded-b-xl print:bg-purple-200 print:border-purple-800 print:border-4 print:text-purple-900">
                <div className="text-purple-800 print:text-purple-900 text-xs font-bold uppercase tracking-wider mb-1">Grand Total</div>
                <div className="text-2xl font-black print:text-purple-950">₹{total.toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- PRINT FOOTER --- */}
      <div className="hidden print:block w-full mt-8">
        {/* T&C Section */}
        <div className="text-[11px] leading-relaxed border-t border-gray-100 pt-4">
          <h4 className="font-bold text-xs mb-1">Terms & Conditions:</h4>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Prices are subject to change without prior notice.</li>
            <li>Goods once sold will not be taken back.</li>
            <li>Delivery subject to stock availability.</li>
            <li>The quotation is only valid till 3 days from the date provided.</li>
            <li>This is inclusive of all the charges (GST, Freight Charges if any).</li>
          </ol>
          <div className="text-center font-bold text-xs mt-4">Looking Forward To Your Valuable Order!</div>
        </div>

        {/* Repeating Brands Footer (at bottom of sheet) */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-center opacity-85 page-break-inside-avoid">
          <img src="/havells.png" alt="Havells" className="h-[40px] object-contain" />
          <img src="/norisys.png" alt="Norisys" className="h-[50px] object-contain" />
          <img src="/beton.png" alt="Beton" className="h-[40px] object-contain" />
          <img src="/crabtree.png" alt="Crabtree" className="h-[40px] object-contain" />
          <img src="/finolex.png" alt="Finolex" className="h-[32px] object-contain" />
        </div>
      </div>
      {/* --- END PRINT FOOTER --- */}
    </div>
  );
}
