import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { supabase } from '../supabase';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { getProductRank } from '../utils/productStandardizer';
import QuoteSummary from './QuoteSummary';
import CustomerNameInput from './CustomerNameInput';
import { toTitleCase } from '../utils/textFormatters';

export default function SwitchQuotePage() {
  const {
    customer, setCustomer,
    items,
    globalDiscount,
    addItem, removeItem,
    updateItemQuantity, updateItemPrice, updateItemDiscount,
    saveQuoteToDatabase
  } = useQuoteStore();

  const addToast = useToastStore((s) => s.addToast);
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  
  // Selection state
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedSubBrand, setSelectedSubBrand] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  // Local state map to preserve exact strings while typing: productId -> { qty, price, disc }
  const [localInputs, setLocalInputs] = useState({});

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
      const cartProduct = data?.find(p => items.some(it => it.id === p.id));
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
    
    return filtered.sort((a, b) => {
      const rankA = getProductRank(a.name);
      const rankB = getProductRank(b.name);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }, [allProducts, selectedBrandId, selectedSubBrand, selectedColor]);

  // Auto-migrate quantities when the user changes variants (brand, sub-brand, or color)
  useEffect(() => {
    if (visibleProducts.length === 0) return;
    
    const store = useQuoteStore.getState();
    const currentItems = store.items;
    let hasChanges = false;
    const newItems = [...currentItems];
    const removedItems = [];

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      // Only migrate Switch/Manual Products
      if (item.product_type !== 'Switch Product' && item.product_type !== 'Manual Product') continue;

      const isCurrentVariant = 
        item.brand_id?.toString() === selectedBrandId &&
        (item.sub_brand || '') === (selectedSubBrand || '') &&
        (item.color || '') === (selectedColor || '');

      if (!isCurrentVariant) {
        const matchingNewProduct = visibleProducts.find(p => p.name === item.name);
        
        if (matchingNewProduct) {
          hasChanges = true;
          // Check if this new product is already in our migrated newItems list (from earlier iterations)
          const existingMigratedIndex = newItems.findIndex((it, idx) => 
            idx < i && it && it.id === matchingNewProduct.id && (it.description || '') === (item.description || '')
          );
          
          if (existingMigratedIndex !== -1) {
            // Aggregate quantity instead of creating a duplicate
            newItems[existingMigratedIndex].quantity += item.quantity;
            newItems[i] = null;
          } else {
            const uniqueSuffix = Math.random().toString(36).substring(2, 7);
            newItems[i] = {
              ...matchingNewProduct,
              cartItemId: `${matchingNewProduct.id}-${uniqueSuffix}`,
              quantity: item.quantity,
              description: item.description || '',
              custom_price_override: null, // Reset manual price to use new variant's base price
              discount_override: item.discount_override,
            };
          }
        } else {
          removedItems.push(item.name);
          newItems[i] = null;
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      useQuoteStore.setState({ items: newItems.filter(Boolean) });
      setLocalInputs({}); // Clear typing state so new base prices show up
      if (removedItems.length > 0) {
        addToast(`Removed items not available in this variant: ${removedItems.join(', ')}`, 'warning');
      }
    }
  }, [visibleProducts, selectedBrandId, selectedSubBrand, selectedColor]);

  const handleItemChange = (product, field, value) => {
    // 1. Update local string state to perfectly preserve what the user types
    const currentLocal = localInputs[product.id] || {};
    const updatedLocal = { ...currentLocal, [field]: value };
    
    setLocalInputs(prev => ({
      ...prev,
      [product.id]: updatedLocal
    }));

    // 2. Parse the combined local state and update the store
    const existingItem = items.find(it => it.id === product.id);
    
    const getQty = () => {
      if (updatedLocal.qty !== undefined) return updatedLocal.qty === '' ? 0 : Math.max(0, parseInt(updatedLocal.qty, 10) || 0);
      return existingItem ? existingItem.quantity : 0;
    };
    
    const getPrice = () => {
      if (updatedLocal.price !== undefined) {
         if (updatedLocal.price === '') return null;
         const p = parseFloat(updatedLocal.price);
         return (isNaN(p) || p <= 0) ? null : p;
      }
      return existingItem ? (existingItem.custom_price_override ?? product.base_price) : product.base_price;
    };
    
    const getDisc = () => {
      if (updatedLocal.disc !== undefined) return updatedLocal.disc;
      return existingItem ? (existingItem.discount_override ?? '') : '';
    };

    const newQty = getQty();
    const newPrice = getPrice();
    const newDisc = getDisc();

    if (newQty > 0) {
      if (!existingItem) {
        addItem({
          ...product,
          quantity: newQty,
          custom_price_override: newPrice,
          discount_override: newDisc,
        });
      } else {
        updateItemQuantity(existingItem.cartItemId, newQty);
        updateItemPrice(existingItem.cartItemId, newPrice);
        updateItemDiscount(existingItem.cartItemId, newDisc);
      }
    } else if (newQty === 0 && existingItem) {
      removeItem(existingItem.cartItemId);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      <div className="bg-white border-b shadow-sm px-5 py-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-800">Customer Details</h2>
          <button onClick={async () => {
            const saved = await saveQuoteToDatabase('Draft');
            if (saved) addToast("Quote saved successfully", "success");
          }} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Draft
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CustomerNameInput />
          <input type="text" value={customer.phone || ''} onChange={(e) => setCustomer('phone', e.target.value)} placeholder="Phone Number" className="input-field" />
          <input type="text" spellCheck={true} value={customer.project || ''} onChange={(e) => setCustomer('project', e.target.value)} onBlur={(e) => setCustomer('project', toTitleCase(e.target.value))} placeholder="Project Name" className="input-field" />
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
                      const cartItem = items.find(it => it.id === product.id);
                      const qty = cartItem ? cartItem.quantity : 0;
                      
                      const override = cartItem ? cartItem.custom_price_override : null;
                      const manualPrice = (override !== null && override !== undefined && override !== '') ? override : product.base_price;
                      
                      const disc = cartItem ? (cartItem.discount_override ?? '') : '';
                      const active = qty > 0;
                      
                      const local = localInputs[product.id] || {};
                      const displayQty = local.qty !== undefined ? local.qty : (qty || '');
                      const displayPrice = local.price !== undefined ? local.price : (manualPrice || '');
                      const displayDisc = local.disc !== undefined ? local.disc : disc;
                      
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
                              value={displayQty}
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
                              value={displayPrice}
                              onChange={(e) => handleItemChange(product, 'price', e.target.value)}
                              onBlur={() => {
                                setLocalInputs(prev => {
                                  const next = { ...prev };
                                  if (next[product.id]) {
                                    delete next[product.id].price;
                                    if (Object.keys(next[product.id]).length === 0) delete next[product.id];
                                  }
                                  return next;
                                });
                              }}
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
                              value={displayDisc}
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
