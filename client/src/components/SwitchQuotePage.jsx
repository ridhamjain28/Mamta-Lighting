import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { supabase } from '../supabase';
import { Loader2, CheckCircle2 } from 'lucide-react';
import QuoteSummary from './QuoteSummary';

export default function SwitchQuotePage() {
  const {
    customer, setCustomer,
    items,
    globalDiscount,
    addItem, removeItem,
    updateItemQuantity, updateItemPrice, updateItemDiscount
  } = useQuoteStore();

  const addToast = useToastStore((s) => s.addToast);
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  
  // Selection state
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedSubBrand, setSelectedSubBrand] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  // Local state map: productName -> { qty, manualPrice, disc }
  const [localOverrides, setLocalOverrides] = useState({});

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
      
      // We map overrides by Product Name instead of ID since ID changes per brand/color
      // but in the store, we save the specific variant ID if it exists
      const overrides = {};
      (data || []).forEach(p => {
        const existingItem = items.find(it => it.id === p.id);
        if (existingItem) {
          overrides[p.name] = {
            qty: existingItem.quantity,
            manualPrice: existingItem.custom_price_override ?? p.base_price,
            disc: existingItem.discount_override !== '' && existingItem.discount_override != null
              ? existingItem.discount_override
              : '',
          };
          // Initialize selection based on the first item found
          if (!selectedBrandId) setSelectedBrandId(p.brand_id?.toString() || '');
          if (!selectedSubBrand) setSelectedSubBrand(p.sub_brand || '');
          if (!selectedColor) setSelectedColor(p.color || '');
        }
      });
      setLocalOverrides(overrides);
    }
    setLoading(false);
  }

  // Derived dropdown options
  const brands = useMemo(() => {
    const map = new Map();
    allProducts.forEach(p => {
      if (p.brands) map.set(p.brands.id, p.brands.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name));
  }, [allProducts]);

  const subBrands = useMemo(() => {
    if (!selectedBrandId) return [];
    const subs = new Set();
    allProducts.filter(p => p.brand_id?.toString() === selectedBrandId && p.sub_brand).forEach(p => subs.add(p.sub_brand));
    return Array.from(subs).sort();
  }, [allProducts, selectedBrandId]);

  const colors = useMemo(() => {
    if (!selectedBrandId) return [];
    const cols = new Set();
    allProducts.filter(p => 
      p.brand_id?.toString() === selectedBrandId && 
      (selectedSubBrand ? p.sub_brand === selectedSubBrand : !p.sub_brand) &&
      p.color
    ).forEach(p => cols.add(p.color));
    return Array.from(cols).sort();
  }, [allProducts, selectedBrandId, selectedSubBrand]);

  // Reset dependent dropdowns
  useEffect(() => {
    if (selectedBrandId && !subBrands.includes(selectedSubBrand) && subBrands.length > 0) {
      setSelectedSubBrand(subBrands[0] || '');
    } else if (subBrands.length === 0) {
      setSelectedSubBrand('');
    }
  }, [selectedBrandId, subBrands]);

  useEffect(() => {
    if (selectedBrandId && !colors.includes(selectedColor) && colors.length > 0) {
      setSelectedColor(colors[0] || '');
    } else if (colors.length === 0) {
      setSelectedColor('');
    }
  }, [selectedBrandId, selectedSubBrand, colors]);

  // All unique product names
  const uniqueNames = useMemo(() => {
    const names = new Set(allProducts.map(p => p.name));
    return Array.from(names).sort();
  }, [allProducts]);

  // Find the specific product variant for a name given current dropdowns
  const getCurrentVariant = useCallback((name) => {
    if (!selectedBrandId) return null;
    return allProducts.find(p => 
      p.name === name &&
      p.brand_id?.toString() === selectedBrandId &&
      (p.sub_brand || '') === (selectedSubBrand || '') &&
      (p.color || '') === (selectedColor || '')
    ) || null;
  }, [allProducts, selectedBrandId, selectedSubBrand, selectedColor]);

  // Sync to store handles finding the old variant and removing it, and adding the new one
  const syncToStore = useCallback((name, qty, manualPrice, disc) => {
    const variant = getCurrentVariant(name);
    
    // First, remove any existing variants of this product name from the store to avoid duplicates
    // e.g. if they had Havells 1 Way Switch and now we are on Norisys
    const allVariantsOfName = allProducts.filter(p => p.name === name);
    allVariantsOfName.forEach(v => {
      const existing = items.find(it => (it.cartItemId || it.id) === v.id);
      // Remove it if it's not the currently active variant, or if qty is 0
      if (existing && (!variant || existing.id !== variant.id || qty === 0)) {
        removeItem(existing.cartItemId || existing.id);
      }
    });

    if (qty > 0 && variant) {
      const existingItem = items.find(it => (it.cartItemId || it.id) === variant.id);
      if (!existingItem) {
        addItem({
          ...variant,
          quantity: qty,
          custom_price_override: manualPrice ?? variant.base_price,
          discount_override: disc !== '' ? disc : '',
        });
        setTimeout(() => {
          const fresh = useQuoteStore.getState().items.find(it => it.id === variant.id);
          if (fresh) {
            if (qty !== 1) updateItemQuantity(fresh.cartItemId, qty);
            updateItemPrice(fresh.cartItemId, manualPrice ?? variant.base_price);
            if (disc !== '') updateItemDiscount(fresh.cartItemId, disc);
          }
        }, 0);
      } else {
        updateItemQuantity(existingItem.cartItemId, qty);
        updateItemPrice(existingItem.cartItemId, manualPrice ?? variant.base_price);
        updateItemDiscount(existingItem.cartItemId, disc !== '' ? disc : '');
      }
    }
  }, [allProducts, items, getCurrentVariant, addItem, removeItem, updateItemQuantity, updateItemPrice, updateItemDiscount]);

  // Effect to re-sync all active products when dropdown changes!
  useEffect(() => {
    // Only re-sync if we have a valid selection
    if (selectedBrandId) {
      Object.keys(localOverrides).forEach(name => {
        const ov = localOverrides[name];
        if (ov.qty > 0) {
          // It will update the store to use the new variant for this name (if it exists)
          // If it doesn't exist, the store item gets removed but the qty stays in localOverrides
          syncToStore(name, ov.qty, ov.manualPrice, ov.disc);
        }
      });
    }
  }, [selectedBrandId, selectedSubBrand, selectedColor]);

  const getOverride = (name) => localOverrides[name] || { qty: 0, manualPrice: null, disc: '' };

  const handleQtyChange = (name, value) => {
    const qty = Math.max(0, parseInt(value, 10) || 0);
    const variant = getCurrentVariant(name);
    const ov = getOverride(name);
    const manualPrice = ov.manualPrice ?? variant?.base_price;
    setLocalOverrides(prev => ({ ...prev, [name]: { ...ov, qty, manualPrice } }));
    syncToStore(name, qty, manualPrice, ov.disc);
  };

  const handlePriceChange = (name, value) => {
    const price = parseFloat(value) || 0;
    const ov = getOverride(name);
    setLocalOverrides(prev => ({ ...prev, [name]: { ...ov, manualPrice: price } }));
    if (ov.qty > 0) syncToStore(name, ov.qty, price, ov.disc);
  };

  const handleDiscChange = (name, value) => {
    const disc = value === '' ? '' : Math.min(100, Math.max(0, parseFloat(value) || 0));
    const ov = getOverride(name);
    setLocalOverrides(prev => ({ ...prev, [name]: { ...ov, disc } }));
    if (ov.qty > 0) syncToStore(name, ov.qty, ov.manualPrice, disc);
  };

  const rowTotal = (name, variant) => {
    const ov = getOverride(name);
    const qty = ov.qty || 0;
    if (!variant || qty === 0) return 0;
    const price = ov.manualPrice ?? variant.base_price ?? 0;
    const disc = ov.disc !== '' ? parseFloat(ov.disc) || 0 : (Number(globalDiscount) || 0);
    return (price - price * disc / 100) * qty;
  };

  // Sort names: active > alphabetical
  const sortedNames = useMemo(() => {
    return [...uniqueNames].sort((a, b) => {
      const aQty = localOverrides[a]?.qty || 0;
      const bQty = localOverrides[b]?.qty || 0;
      if (aQty > 0 && bQty === 0) return -1;
      if (aQty === 0 && bQty > 0) return 1;
      return a.localeCompare(b);
    });
  }, [uniqueNames, localOverrides]);

  if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      <div className="bg-white border-b shadow-sm px-5 py-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Customer Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" value={customer.name || ''} onChange={(e) => setCustomer('name', e.target.value)} placeholder="Customer Name *" className="input-field" />
          <input type="text" value={customer.phone || ''} onChange={(e) => setCustomer('phone', e.target.value)} placeholder="Phone Number" className="input-field" />
          <input type="text" value={customer.project || ''} onChange={(e) => setCustomer('project', e.target.value)} placeholder="Project Name" className="input-field" />
        </div>
      </div>

      {/* Brand Selector Bar */}
      <div className="bg-purple-50 border-b border-purple-100 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-bold text-purple-800 uppercase tracking-wide mb-1">Brand</label>
            <select className="input-field min-w-[200px]" value={selectedBrandId} onChange={(e) => setSelectedBrandId(e.target.value)}>
              <option value="">Select Brand...</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {subBrands.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-purple-800 uppercase tracking-wide mb-1">Sub-Brand</label>
              <select className="input-field min-w-[150px]" value={selectedSubBrand} onChange={(e) => setSelectedSubBrand(e.target.value)}>
                <option value="">(None)</option>
                {subBrands.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {colors.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-purple-800 uppercase tracking-wide mb-1">Color</label>
              <select className="input-field min-w-[150px]" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)}>
                <option value="">(None)</option>
                {colors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-2 md:px-4 py-3">
        {!selectedBrandId ? (
          <div className="text-center py-12 text-gray-400 font-medium">Please select a brand to view pricing.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Product Name</th>
                  <th className="text-right px-3 py-3 font-semibold w-24">List ₹</th>
                  <th className="text-center px-3 py-3 font-semibold w-20">Qty</th>
                  <th className="text-right px-3 py-3 font-semibold w-28">Price ₹</th>
                  <th className="text-center px-3 py-3 font-semibold w-20">Disc %</th>
                  <th className="text-right px-4 py-3 font-semibold w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedNames.map(name => {
                  const variant = getCurrentVariant(name);
                  const ov = getOverride(name);
                  const qty = ov.qty || 0;
                  const isActive = qty > 0;
                  const manualPrice = ov.manualPrice ?? variant?.base_price ?? '';
                  const total = rowTotal(name, variant);
                  
                  const isUnavailable = !variant;

                  return (
                    <tr key={name} className={`border-b border-gray-100 transition-colors ${isActive && !isUnavailable ? 'bg-purple-50/50' : isUnavailable ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {isActive && !isUnavailable && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          <span className={`${isActive && !isUnavailable ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                            {name}
                          </span>
                          {isUnavailable && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">N/A</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400 tabular-nums">
                        {variant ? variant.base_price.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={qty === 0 ? '' : qty}
                          onChange={(e) => handleQtyChange(name, e.target.value)}
                          disabled={isUnavailable}
                          className={`w-16 text-center text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-purple-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isActive && !isUnavailable ? 'border-purple-300 bg-white font-bold text-purple-700' : 'border-gray-200 bg-gray-50'}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={manualPrice}
                          onChange={(e) => handlePriceChange(name, e.target.value)}
                          disabled={isUnavailable}
                          className={`w-24 text-right text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-purple-400 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isActive && !isUnavailable ? 'border-purple-300 bg-white' : 'border-gray-200 bg-gray-50'}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={ov.disc}
                          onChange={(e) => handleDiscChange(name, e.target.value)}
                          disabled={isUnavailable}
                          placeholder="—"
                          className={`w-16 text-center text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-red-300 text-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isActive && !isUnavailable ? 'border-purple-300 bg-white' : 'border-gray-200 bg-gray-50'}`}
                        />
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${isActive && !isUnavailable ? 'text-gray-900 font-bold' : 'text-gray-300'}`}>
                        {isActive && !isUnavailable ? `₹${total.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <QuoteSummary />
    </div>
  );
}
