import React, { useState, useEffect } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { supabase } from '../supabase';
import CustomerDetails from './CustomerDetails';
import QuoteSummary from './QuoteSummary';

export default function ManualQuote() {
  const { items, updateItemQuantity, updateItemPrice, updateItemDiscount, globalDiscount } = useQuoteStore();
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [selectedType, setSelectedType] = useState('Switch');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  
  const [brands, setBrands] = useState([]);
  const presetColors = ['White', 'Black', 'Grey', 'Silver', 'Gold', 'Red', 'Blue', 'Yellow', 'Green'];

  // Load manual products and brands on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [prodRes, brandRes] = await Promise.all([
          supabase.from('products').select('*, categories(name)').eq('product_type', 'Manual Product').order('name'),
          supabase.from('brands').select('*').order('name')
        ]);
        
        if (!brandRes.error && brandRes.data) {
          setBrands(brandRes.data);
          if (brandRes.data.length > 0) setSelectedBrand(brandRes.data[0].id);
        }

        if (!prodRes.error && prodRes.data) {
          const storeItems = useQuoteStore.getState().items;
          const existingMap = new Map();
          
          storeItems.forEach(item => {
            const key = item.product_id || item.id || item.name;
            existingMap.set(key, item);
          });

          const newItems = prodRes.data.map(p => {
            const existing = existingMap.get(p.id) || existingMap.get(p.name);
            if (existing) {
              return {
                ...existing,
                category_name: p.categories?.name || 'Uncategorized',
                brand_id: p.brand_id,
                description: p.description
              };
            }
            return {
              id: p.id,
              product_id: p.id,
              cartItemId: 'row-' + p.id,
              name: p.name,
              base_price: p.base_price,
              product_type: 'Manual Product',
              category_name: p.categories?.name || 'Uncategorized',
              brand_id: p.brand_id,
              description: p.description,
              quantity: '', 
              custom_price_override: null,
              discount_override: ''
            };
          });

          useQuoteStore.setState({ items: newItems });
        }
      } catch (err) {
        console.error("Failed to load manual products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter items for display based on wizard
  const currentCategoryName = `[M] ${selectedType}`;
  const displayedItems = items.filter(item => {
    // Only manual products should be in this view
    if (item.product_type !== 'Manual Product') return false;
    
    const matchesCategory = item.category_name === currentCategoryName;
    const matchesBrand = selectedBrand ? item.brand_id === selectedBrand : true;
    const matchesColor = selectedColor ? (item.description || '').toLowerCase() === selectedColor.toLowerCase() : (!item.description);
    
    return matchesCategory && matchesBrand && matchesColor;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 overflow-y-auto overflow-x-hidden">
      <div className="max-w-[1400px] w-full mx-auto p-4 md:p-8 flex flex-col min-h-full">
        
        {/* Top: Customer Details */}
        <div className="bg-white rounded-t-xl shadow-sm mb-4">
          <CustomerDetails />
        </div>

        {/* Wizard Selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm mb-4">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Select Product Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
              <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                <button 
                  onClick={() => setSelectedType('Switch')}
                  className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${selectedType === 'Switch' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Switch
                </button>
                <button 
                  onClick={() => setSelectedType('Wire')}
                  className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors border-l border-gray-300 ${selectedType === 'Wire' ? 'bg-blue-600 text-white border-l-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Wire
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <select 
                value={selectedBrand} 
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
              >
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color (Optional)</label>
              <input 
                type="text" 
                list="colors"
                value={selectedColor} 
                onChange={(e) => setSelectedColor(e.target.value)}
                placeholder="e.g. White"
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
              />
              <datalist id="colors">
                {presetColors.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

          </div>
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

              {/* Data Rows */}
              <div className="pb-4 pt-2">
                {displayedItems.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 bg-white">
                    <p className="text-lg mb-2">No products found for this combination.</p>
                    <p className="text-sm">You can add products from the "Manage Products" tab.</p>
                  </div>
                ) : (
                  displayedItems.map(item => (
                    <SpreadsheetRow 
                      key={item.cartItemId || item.id} 
                      item={item} 
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom: Summary */}
        <div className="bg-white rounded-b-xl shadow-sm mt-auto">
          <QuoteSummary />
        </div>

      </div>
    </div>
  );
}

const SpreadsheetRow = React.memo(function SpreadsheetRow({ item }) {
  const updateItemQuantity = useQuoteStore(state => state.updateItemQuantity);
  const updateItemPrice = useQuoteStore(state => state.updateItemPrice);
  const updateItemDiscount = useQuoteStore(state => state.updateItemDiscount);
  const globalDiscount = useQuoteStore(state => state.globalDiscount);
  
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
}, (prev, next) => {
  return prev.item.quantity === next.item.quantity &&
         prev.item.custom_price_override === next.item.custom_price_override &&
         prev.item.discount_override === next.item.discount_override &&
         prev.item.base_price === next.item.base_price;
});
