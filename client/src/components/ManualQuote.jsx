import React, { useState, useEffect } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { supabase } from '../supabase';
import CustomerDetails from './CustomerDetails';
import QuoteSummary from './QuoteSummary';

export default function ManualQuote() {
  const { items, updateItemQuantity, updateItemPrice, updateItemDiscount, globalDiscount } = useQuoteStore();
  const [loading, setLoading] = useState(true);

  // Load manual products on mount and merge with existing items
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, categories(name)')
          .eq('product_type', 'Manual Product')
          .order('name');
          
        if (!error && data) {
          const storeItems = useQuoteStore.getState().items;
          const existingMap = new Map();
          
          // Old manual quote items might not have a clean product ID if they were custom rows,
          // but our new implementation only has fixed products.
          storeItems.forEach(item => {
            // For items from history, we match by product_id if available, otherwise by name.
            const key = item.product_id || item.id || item.name;
            existingMap.set(key, item);
          });

          const newItems = data.map(p => {
            // Check if we have this product in the store already (e.g. editing a quote)
            const existing = existingMap.get(p.id) || existingMap.get(p.name);
            if (existing) {
              return {
                ...existing,
                category_name: p.categories?.name || 'Uncategorized' // ensure category name is attached
              };
            }
            // Fresh row
            return {
              id: p.id, // we use product id as the item id for simplicity
              product_id: p.id,
              cartItemId: 'row-' + p.id,
              name: p.name,
              base_price: p.base_price,
              product_type: 'Manual Product',
              category_name: p.categories?.name || 'Uncategorized',
              quantity: '', // blank by default
              custom_price_override: null,
              discount_override: ''
            };
          });

          // Sort by category name then product name
          newItems.sort((a, b) => {
            const catA = a.category_name || '';
            const catB = b.category_name || '';
            if (catA !== catB) return catA.localeCompare(catB);
            return (a.name || '').localeCompare(b.name || '');
          });

          useQuoteStore.setState({ items: newItems });
        }
      } catch (err) {
        console.error("Failed to load manual products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // Group items for display
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category_name || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 overflow-y-auto overflow-x-hidden">
      <div className="max-w-[1400px] w-full mx-auto p-4 md:p-8 flex flex-col min-h-full">
        
        {/* Top: Customer Details */}
        <div className="bg-white rounded-t-xl shadow-sm mb-4">
          <CustomerDetails />
        </div>

        {/* Middle: Spreadsheet Grid */}
        <div className="flex-1 bg-white shadow-sm border border-gray-200 p-0 overflow-visible mb-4 rounded-xl">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading manual products...</div>
          ) : (
            <div className="w-full">
              {/* Header Row */}
              <div className="grid grid-cols-[3fr_80px_120px_120px_120px_120px_120px] gap-2 px-4 py-3 bg-gray-900 text-white font-bold text-sm sticky top-0 z-10 rounded-t-xl">
                <div>Product</div>
                <div className="text-center">Qty</div>
                <div className="text-center">Manual Disc (%)</div>
                <div className="text-right">List Price</div>
                <div className="text-right">Manual Price</div>
                <div className="text-right">Net Price</div>
                <div className="text-right pr-2">Total</div>
              </div>

              {/* Data Rows Grouped by Category */}
              <div className="pb-4">
                {Object.entries(groupedItems).map(([category, catItems]) => (
                  <div key={category} className="mb-2">
                    <div className="bg-blue-50 text-blue-800 font-bold px-4 py-2 text-sm border-y border-blue-100">
                      {category}
                    </div>
                    <div>
                      {catItems.map(item => (
                        <SpreadsheetRow 
                          key={item.cartItemId || item.id} 
                          item={item} 
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom: Summary */}
        <div className="bg-white rounded-b-xl shadow-sm">
          <QuoteSummary />
        </div>

      </div>
    </div>
  );
}

function SpreadsheetRow({ item }) {
  const { updateItemQuantity, updateItemPrice, updateItemDiscount, globalDiscount } = useQuoteStore();
  const cartItemId = item.cartItemId || item.id;
  
  // Calculate Math
  const listPrice = item.base_price || 0;
  const manualPrice = item.custom_price_override;
  
  const baseRate = manualPrice !== null && manualPrice !== '' ? Number(manualPrice) : listPrice;
  
  const manualDiscount = item.discount_override;
  const effectiveDiscount = (manualDiscount !== '' && manualDiscount !== null) 
    ? Number(manualDiscount) 
    : (Number(globalDiscount) || 0);

  const netPrice = baseRate - (baseRate * (effectiveDiscount / 100));
  
  const qty = item.quantity === '' ? 0 : Number(item.quantity);
  const total = netPrice * qty;

  const isActive = qty > 0;

  return (
    <div className={`grid grid-cols-[3fr_80px_120px_120px_120px_120px_120px] gap-2 px-4 py-1.5 border-b border-gray-100 hover:bg-gray-50 items-center text-sm transition-colors ${isActive ? 'bg-green-50/30' : ''}`}>
      
      {/* Product Name */}
      <div className="font-medium text-gray-800 truncate pr-4" title={item.name}>
        {item.name}
      </div>

      {/* Qty */}
      <div>
        <input 
          type="number"
          min="0"
          className={`w-full border rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isActive ? 'border-green-400 bg-green-50 font-bold' : 'border-gray-300'}`}
          value={item.quantity === '' ? '' : item.quantity}
          onChange={(e) => updateItemQuantity(cartItemId, e.target.value)}
        />
      </div>

      {/* Manual Discount */}
      <div>
        <input 
          type="number"
          min="0"
          max="100"
          placeholder={globalDiscount ? `${globalDiscount}% (G)` : ''}
          className="w-full border border-gray-300 rounded-md p-1.5 text-center text-red-600 focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={item.discount_override === '' ? '' : item.discount_override}
          onChange={(e) => updateItemDiscount(cartItemId, e.target.value)}
        />
      </div>

      {/* List Price */}
      <div className="text-right text-gray-500 py-1.5">
        {listPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}
      </div>

      {/* Manual Price */}
      <div>
        <input 
          type="number"
          min="0"
          className="w-full border border-gray-300 rounded-md p-1.5 text-right text-blue-600 font-medium focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={item.custom_price_override === null ? '' : item.custom_price_override}
          onChange={(e) => updateItemPrice(cartItemId, e.target.value)}
        />
      </div>

      {/* Net Price */}
      <div className="text-right font-medium text-gray-700 py-1.5">
        {netPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}
      </div>

      {/* Total */}
      <div className={`text-right font-bold pr-2 py-1.5 ${isActive ? 'text-green-700' : 'text-gray-400'}`}>
        {total.toLocaleString(undefined, {minimumFractionDigits: 2})}
      </div>

    </div>
  );
}
