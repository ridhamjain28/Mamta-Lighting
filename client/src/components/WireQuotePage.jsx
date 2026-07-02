import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { supabase } from '../supabase';
import { Loader2, CheckCircle2 } from 'lucide-react';
import QuoteSummary from './QuoteSummary';

export default function WireQuotePage() {
  const {
    customer, setCustomer,
    items,
    globalDiscount, setGlobalDiscount,
    gstIncluded, toggleGst,
    hideListPrice, toggleHideListPrice,
    getTotals,
    addItem, removeItem,
    updateItemQuantity, updateItemPrice, updateItemDiscount
  } = useQuoteStore();

  const addToast = useToastStore((s) => s.addToast);

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('brand');

  // Local state map: productId -> { qty, price, discount }
  const [localOverrides, setLocalOverrides] = useState({});

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_type', 'Wire Product');

    if (error) {
      addToast('Failed to load wire products', 'error');
    } else {
      setAllProducts(data || []);
      
      const overrides = {};
      (data || []).forEach(p => {
        const existingItem = items.find(it => it.id === p.id);
        if (existingItem) {
          overrides[p.id] = {
            qty: existingItem.quantity,
            manualPrice: existingItem.custom_price_override ?? p.base_price,
            disc: existingItem.discount_override !== '' && existingItem.discount_override != null
              ? existingItem.discount_override
              : '',
          };
        }
      });
      setLocalOverrides(overrides);
    }
    setLoading(false);
  }

  const getOverride = useCallback((productId) => {
    return localOverrides[productId] || { qty: 0, manualPrice: null, disc: '' };
  }, [localOverrides]);

  const syncProductToStore = useCallback((product, qty, manualPrice, disc) => {
    const existingItem = items.find(it => it.id === product.id);

    if (qty > 0) {
      if (!existingItem) {
        addItem({
          ...product,
          quantity: qty,
          custom_price_override: manualPrice ?? product.base_price,
          discount_override: disc !== '' ? disc : '',
        });
        setTimeout(() => {
          const freshItems = useQuoteStore.getState().items;
          const added = freshItems.find(it => it.id === product.id);
          if (added) {
            if (qty !== 1) updateItemQuantity(added.cartItemId, qty);
            updateItemPrice(added.cartItemId, manualPrice ?? product.base_price);
            if (disc !== '') updateItemDiscount(added.cartItemId, disc);
          }
        }, 0);
      } else {
        updateItemQuantity(existingItem.cartItemId, qty);
        updateItemPrice(existingItem.cartItemId, manualPrice ?? product.base_price);
        updateItemDiscount(existingItem.cartItemId, disc !== '' ? disc : '');
      }
    } else {
      if (existingItem) {
        removeItem(existingItem.cartItemId);
      }
    }
  }, [items, addItem, updateItemQuantity, updateItemPrice, updateItemDiscount, removeItem]);

  const handleQtyChange = (product, value) => {
    const qty = Math.max(0, parseInt(value, 10) || 0);
    const ov = getOverride(product.id);
    setLocalOverrides(prev => ({ ...prev, [product.id]: { ...ov, qty } }));
    syncProductToStore(product, qty, ov.manualPrice, ov.disc);
  };

  const handlePriceChange = (product, value) => {
    const manualPrice = value === '' ? null : parseFloat(value);
    const ov = getOverride(product.id);
    setLocalOverrides(prev => ({ ...prev, [product.id]: { ...ov, manualPrice } }));
    if (ov.qty > 0) {
      syncProductToStore(product, ov.qty, manualPrice, ov.disc);
    }
  };

  const handleDiscChange = (product, value) => {
    const disc = value === '' ? '' : Math.min(100, Math.max(0, parseFloat(value) || 0));
    const ov = getOverride(product.id);
    setLocalOverrides(prev => ({ ...prev, [product.id]: { ...ov, disc } }));
    if (ov.qty > 0) {
      syncProductToStore(product, ov.qty, ov.manualPrice, disc);
    }
  };

  const rowTotal = (product) => {
    const ov = getOverride(product.id);
    const qty = ov.qty || 0;
    if (qty === 0) return 0;
    
    let price = ov.manualPrice;
    if (price === null || price === undefined || price === '' || Number(price) === 0) {
      price = product.base_price ?? 0;
    } else {
      price = Number(price);
    }
    
    const disc = ov.disc !== '' ? parseFloat(ov.disc) || 0 : (Number(globalDiscount) || 0);
    return (price - price * disc / 100) * qty;
  };

  const groupedProducts = useMemo(() => {
    const groups = {};

    allProducts.forEach(p => {
      const cat = p.sub_brand || 'Other';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(p);
    });

    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
    });

    // Return entries sorted by group name
    const entries = Object.entries(groups).filter(([_, items]) => items.length > 0);

    if (sortBy === 'length') {
      entries.sort((a, b) => {
        // Extract length numbers from group name (e.g. "90MTR", "180M", "300M")
        const matchA = a[0].match(/(\d+)\s*(?:M|MTR)/i);
        const matchB = b[0].match(/(\d+)\s*(?:M|MTR)/i);
        
        const numA = matchA ? parseInt(matchA[1], 10) : 0;
        const numB = matchB ? parseInt(matchB[1], 10) : 0;
        
        if (numA !== numB) {
          return numA - numB;
        }
        // Fallback to alphabetical
        return a[0].localeCompare(b[0]);
      });
    } else {
      // Default: sort alphabetically (brand-wise)
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
    
    return entries;
  }, [allProducts, localOverrides, getOverride, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      {/* Customer Details */}
      <div className="bg-white border-b shadow-sm px-5 py-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Customer Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={customer.name || ''}
            onChange={(e) => setCustomer('name', e.target.value)}
            placeholder="Customer Name *"
            className="input-field"
          />
          <input
            type="text"
            value={customer.phone || ''}
            onChange={(e) => setCustomer('phone', e.target.value)}
            placeholder="Phone Number"
            className="input-field"
          />
          <input
            type="text"
            value={customer.project || ''}
            onChange={(e) => setCustomer('project', e.target.value)}
            placeholder="Project Name"
            className="input-field"
          />
        </div>
      </div>

      {/* Sorting Toggle */}
      <div className="bg-white border-b shadow-sm px-5 py-3 flex items-center justify-start space-x-4">
        <h2 className="text-sm font-semibold text-gray-700">Sort Categories By:</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setSortBy('brand')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${sortBy === 'brand' ? 'bg-green-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Brand
          </button>
          <button
            onClick={() => setSortBy('length')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${sortBy === 'length' ? 'bg-green-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Length
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="flex-1 px-2 md:px-4 py-3">
        {groupedProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-700">
            No wire products found.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm text-gray-900">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Wire Name</th>
                  <th className="text-right px-3 py-3 font-semibold w-24">List ₹</th>
                  <th className="text-center px-3 py-3 font-semibold w-20">Qty</th>
                  <th className="text-right px-3 py-3 font-semibold w-28">Price ₹</th>
                  <th className="text-center px-3 py-3 font-semibold w-20">Disc %</th>
                  <th className="text-right px-4 py-3 font-semibold w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {groupedProducts.map(([groupName, groupProducts]) => (
                  <React.Fragment key={groupName}>
                    <tr>
                      <td colSpan={6} className="px-0 py-0">
                        <div className="flex items-center border-l-4 border-green-500 bg-green-50 px-4 py-2 mt-1">
                          <span className="font-bold text-green-800 text-xs uppercase tracking-wide">
                            {groupName}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {groupProducts.map(product => {
                      const ov = getOverride(product.id);
                      const qty = ov.qty || 0;
                      const manualPrice = ov.manualPrice ?? '';
                      const disc = ov.disc;
                      const total = rowTotal(product);
                      const isActive = qty > 0;

                      return (
                        <tr
                          key={product.id}
                          className={`border-b border-gray-100 transition-colors ${
                            isActive ? 'bg-green-50/50 hover:bg-green-100/50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {isActive && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              <span className={isActive ? 'font-bold text-gray-900' : 'text-gray-700 font-medium'}>
                                {product.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 font-medium tabular-nums">
                            {(product.base_price ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) => handleQtyChange(product, e.target.value)}
                              placeholder="0"
                              className={`w-16 text-center text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-green-400 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isActive ? 'border-green-300 bg-white font-bold' : 'border-gray-200 bg-gray-50'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={manualPrice}
                              onChange={(e) => handlePriceChange(product, e.target.value)}
                              className={`w-24 text-right text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-green-400 text-gray-900 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isActive ? 'border-green-300 bg-white' : 'border-gray-200 bg-gray-50'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={disc}
                              onChange={(e) => handleDiscChange(product, e.target.value)}
                              placeholder="—"
                              className={`w-16 text-center text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-red-300 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isActive ? 'border-green-300 bg-white text-red-700 font-medium' : 'border-gray-200 bg-gray-50'
                              }`}
                            />
                          </td>
                          <td className={`px-4 py-2 text-right tabular-nums font-medium ${isActive ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                            {isActive ? `₹${total.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <QuoteSummary />
    </div>
  );
}
