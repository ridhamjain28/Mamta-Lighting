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
      
      // Initialize selection based on the first item found (or a product currently in the cart)
      const cartProduct = data?.find(p => items.some(it => (it.cartItemId || it.id) === p.id));
      const initProduct = cartProduct || (data && data[0]);
      
      if (initProduct) {
        if (!selectedBrandId) setSelectedBrandId(initProduct.brand_id?.toString() || '');
        if (!selectedSubBrand) setSelectedSubBrand(initProduct.sub_brand || '');
        if (!selectedColor) setSelectedColor(initProduct.color || '');
      }
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
    if (subBrands.length === 0) {
      setSelectedSubBrand('');
    } else if (selectedSubBrand && !subBrands.includes(selectedSubBrand)) {
      setSelectedSubBrand('');
    }
  }, [selectedBrandId, subBrands]);

  useEffect(() => {
    if (colors.length === 0) {
      setSelectedColor('');
    } else if (selectedColor && !colors.includes(selectedColor)) {
      setSelectedColor('');
    }
  }, [selectedBrandId, selectedSubBrand, colors]);

  const visibleProducts = useMemo(() => {
    if (!selectedBrandId) return [];
    const filtered = allProducts.filter(p => 
      p.brand_id?.toString() === selectedBrandId &&
      (p.sub_brand || '') === (selectedSubBrand || '') &&
      (p.color || '') === (selectedColor || '')
    );
    
    const getRank = (name) => {
      const n = name.trim().toLowerCase();
      const exactList = [
        "switch 6a one-way - 1 module",
        "switch 6a two-way - 1 module",
        "switch 16a one-way with indicator - 1 module",
        "switch 6a - bell - 1 module",
        "socket 6a 3-pin-only shuttered - 2 module",
        "socket 16a and 6a 3-pin shuttered - 2 module",
        "fan regulator for 120w fan - 2 module",
        "indicator light - 1 module",
        "step marker lamp/night lamp - 2 module",
        "usb charger socket outlet a+c type - 1 module",
        "blanking plate - 1 module",
        "1m", "2m", "3m", "4m", "6m", "8m(h)", "8m(s)", "12m", "14m", "16m", "21m",
        "ac starter"
      ];
      const exactIndex = exactList.indexOf(n);
      if (exactIndex !== -1) return exactIndex;
      if (n.startsWith('switch 6a')) return 1.5;
      if (n.startsWith('switch 16a')) return 2.5;
      if (n.startsWith('switch 20a') || n.startsWith('switch 25a') || n.startsWith('switch 32a')) return 3.5;
      if (n.startsWith('socket')) return 6.5;
      if (n.startsWith('fan regulator')) return 7.5;
      if (n.startsWith('indicator')) return 8.5;
      if (n.startsWith('step marker') || n.startsWith('footlight')) return 9.5;
      if (n.includes('usb') || n.includes('charger')) return 10.1;
      if (n.includes('telephone') || n.includes('tv socket') || n.includes('computer')) return 10.2;
      if (n.includes('buzzer')) return 10.3;
      if (n.startsWith('blank')) return 11.5;
      if (n.includes('mcb')) return 99;
      if (n.match(/^\d+m/)) {
        const match = n.match(/^(\d+)m/);
        return 12 + (match ? parseInt(match[1]) / 100 : 0);
      }
      return 100;
    };

    return filtered.sort((a, b) => {
      const rankA = getRank(a.name);
      const rankB = getRank(b.name);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }, [allProducts, selectedBrandId, selectedSubBrand, selectedColor]);

  const handleItemChange = (product, field, value) => {
    const existingItem = items.find(it => (it.cartItemId || it.id) === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const currentPrice = existingItem ? (existingItem.custom_price_override ?? product.base_price) : product.base_price;
    const currentDisc = existingItem ? (existingItem.discount_override ?? '') : '';

    let newQty = currentQty;
    let newPrice = currentPrice;
    let newDisc = currentDisc;

    if (field === 'qty') {
      newQty = Math.max(0, parseInt(value, 10) || 0);
    } else if (field === 'price') {
      newPrice = value === '' ? null : parseFloat(value);
    } else if (field === 'disc') {
      newDisc = value;
    }

    if (newQty > 0) {
      if (!existingItem) {
        addItem({
          ...product,
          quantity: newQty,
          custom_price_override: newPrice,
          discount_override: newDisc,
        });
        setTimeout(() => {
          const fresh = useQuoteStore.getState().items.find(it => it.id === product.id);
          if (fresh) {
            if (newQty !== 1) updateItemQuantity(fresh.cartItemId, newQty);
            updateItemPrice(fresh.cartItemId, newPrice);
            if (newDisc !== '') updateItemDiscount(fresh.cartItemId, newDisc);
          }
        }, 0);
      } else {
        updateItemQuantity(existingItem.cartItemId, newQty);
        updateItemPrice(existingItem.cartItemId, newPrice);
        updateItemDiscount(existingItem.cartItemId, newDisc);
      }
    } else if (newQty === 0 && existingItem) {
      removeItem(existingItem.cartItemId || existingItem.id);
    }
  };

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
          <div className="text-center py-12 text-gray-600 font-medium">Please select a brand to view pricing.</div>
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
              <tbody className="bg-white divide-y divide-gray-200">
                {visibleProducts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      No products available for this selection.
                    </td>
                  </tr>
                ) : (
                  visibleProducts.map((product) => {
                    const cartItem = items.find(it => (it.cartItemId || it.id) === product.id);
                    const qty = cartItem ? cartItem.quantity : 0;
                    const manualPrice = cartItem ? (cartItem.custom_price_override ?? product.base_price) : product.base_price;
                    const disc = cartItem ? (cartItem.discount_override ?? '') : '';
                    const active = qty > 0;
                    
                    const effectiveDisc = disc !== '' ? parseFloat(disc) : (globalDiscount || 0);
                    const unitPrice = manualPrice - (manualPrice * (effectiveDisc / 100));
                    const total = unitPrice * qty;

                    return (
                      <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${active ? 'bg-purple-50' : ''}`}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right font-mono">
                          {product.base_price?.toFixed(2) || '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={qty || ''}
                            onChange={(e) => handleItemChange(product, 'qty', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500 outline-none text-center"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualPrice || ''}
                            onChange={(e) => handleItemChange(product, 'price', e.target.value)}
                            className="w-20 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500 outline-none text-right"
                            placeholder={product.base_price}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={disc}
                            onChange={(e) => handleItemChange(product, 'disc', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500 outline-none text-center"
                            placeholder={globalDiscount ? `${globalDiscount}` : ''}
                          />
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                          {total > 0 ? `₹${total.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <QuoteSummary />
    </div>
  );
}
