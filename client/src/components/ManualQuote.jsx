import React, { useState, useEffect, useRef } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { supabase } from '../supabase';
import { Plus, Trash2 } from 'lucide-react';
import CustomerDetails from './CustomerDetails';
import QuoteSummary from './QuoteSummary';

// Cache for manual products
let manualProductsCache = null;

export default function ManualQuote() {
  const { items, addItem, updateItemQuantity, updateItemPrice, updateItemDiscount, removeItem, globalDiscount } = useQuoteStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load manual products on mount
  useEffect(() => {
    async function loadProducts() {
      if (manualProductsCache) {
        setProducts(manualProductsCache);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('product_type', 'Manual Product')
          .order('name');
        if (!error && data) {
          manualProductsCache = data;
          setProducts(data);
        }
      } catch (err) {
        console.error("Failed to load manual products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const handleAddRow = () => {
    // Generate a temporary unique ID for new custom rows
    const tempId = 'row-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    // Add empty item to store
    // Since addItem expects a product, we'll mock one
    addItem({
      id: tempId,
      name: '',
      base_price: 0,
      product_type: 'Manual Product'
    });
  };

  // Ensure there's at least one row initially
  useEffect(() => {
    if (items.length === 0) {
      handleAddRow();
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 overflow-y-auto overflow-x-hidden">
      <div className="max-w-[1400px] w-full mx-auto p-4 md:p-8 flex flex-col min-h-full">
        
        {/* Top: Customer Details */}
        <div className="bg-white rounded-t-xl shadow-sm mb-4">
          <CustomerDetails />
        </div>

        {/* Middle: Spreadsheet */}
        <div className="flex-1 bg-white shadow-sm border border-gray-200 p-6 overflow-visible mb-4">
          <SpreadsheetTable products={products} />
        </div>

        {/* Bottom: Summary */}
        <div className="bg-white rounded-b-xl shadow-sm">
          <QuoteSummary />
        </div>

      </div>
    </div>
  );
}

function SpreadsheetTable({ products }) {
  const { items, updateItemQuantity, updateItemPrice, updateItemDiscount, removeItem, setQuoteMetadata } = useQuoteStore();
  
  // Custom action to update item name (description) directly in store
  // Since useQuoteStore doesn't have an updateItemName action, we'll just update it by overriding the state
  const updateItemName = (cartItemId, newName) => {
    useQuoteStore.setState(state => ({
      items: state.items.map(item => 
        (item.cartItemId || item.id) === cartItemId ? { ...item, name: newName } : item
      )
    }));
  };

  const applyProductToRow = (cartItemId, product) => {
    useQuoteStore.setState(state => ({
      items: state.items.map(item => {
        if ((item.cartItemId || item.id) === cartItemId) {
          return {
            ...item,
            product_id: product.id,
            name: product.name,
            base_price: product.base_price,
            custom_price_override: product.base_price,
            quantity: 1
          };
        }
        return item;
      })
    }));
  };

  return (
    <div>
      <div className="grid grid-cols-[minmax(250px,2fr)_100px_120px_100px_150px_40px] gap-4 mb-3 px-4 font-bold text-gray-700 text-sm uppercase tracking-wider border-b border-gray-200 pb-3">
        <div>Description</div>
        <div className="text-center">Qty</div>
        <div className="text-right">Rate</div>
        <div className="text-right">Disc %</div>
        <div className="text-right">Amount</div>
        <div></div>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <SpreadsheetRow 
            key={item.cartItemId || item.id} 
            item={item} 
            index={index}
            products={products}
            updateItemName={updateItemName}
            applyProductToRow={applyProductToRow}
            isLast={index === items.length - 1}
          />
        ))}
      </div>

      <button 
        onClick={() => {
          const tempId = 'row-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
          useQuoteStore.getState().addItem({ id: tempId, name: '', base_price: 0, product_type: 'Manual Product' });
        }}
        className="mt-4 flex items-center gap-2 text-blue-600 font-medium hover:text-blue-800 transition-colors px-4 py-2 hover:bg-blue-50 rounded-md"
      >
        <Plus className="w-5 h-5" /> Add Row
      </button>
    </div>
  );
}

function SpreadsheetRow({ item, index, products, updateItemName, applyProductToRow, isLast }) {
  const { updateItemQuantity, updateItemPrice, updateItemDiscount, removeItem, globalDiscount } = useQuoteStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Keyboard navigation refs
  const descRef = useRef(null);
  const qtyRef = useRef(null);
  const rateRef = useRef(null);
  const discRef = useRef(null);

  const cartItemId = item.cartItemId || item.id;
  
  // Calculate row total
  const rate = item.custom_price_override !== null ? item.custom_price_override : item.base_price;
  const effectiveDiscount = (item.discount_override !== '' && item.discount_override !== null) 
    ? Number(item.discount_override) 
    : (Number(globalDiscount) || 0);
  const amount = (rate - (rate * (effectiveDiscount / 100))) * (Number(item.quantity) || 0);

  // Click outside to close autocomplete
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Filter products for autocomplete
  const filteredProducts = showSuggestions ? products.filter(p => {
    const search = (item.name || '').toLowerCase();
    if (!search) return false; // Don't show all if empty
    return (
      p.name.toLowerCase().includes(search) || 
      (p.brand && p.brand.toLowerCase().includes(search)) || 
      (p.model_number && p.model_number.toLowerCase().includes(search))
    );
  }).slice(0, 8) : []; // Limit to 8 suggestions

  const handleKeyDown = (e, currentField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      switch (currentField) {
        case 'desc':
          setShowSuggestions(false);
          qtyRef.current?.focus();
          break;
        case 'qty':
          rateRef.current?.focus();
          break;
        case 'rate':
          discRef.current?.focus();
          break;
        case 'disc':
          if (isLast) {
            // Add a new row automatically if it's the last row
            const tempId = 'row-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
            useQuoteStore.getState().addItem({ id: tempId, name: '', base_price: 0, product_type: 'Manual Product' });
          } else {
            // Focus next row's description (Requires traversing DOM or advanced refs, simplify by just blurring for now, user can click or tab)
            e.target.blur(); 
          }
          break;
      }
    }
  };

  return (
    <div className="grid grid-cols-[minmax(250px,2fr)_100px_120px_100px_150px_40px] gap-4 items-center group bg-white border border-transparent hover:border-gray-200 p-2 rounded-lg transition-colors">
      
      {/* Description / Autocomplete */}
      <div className="relative" ref={wrapperRef}>
        <input 
          ref={descRef}
          type="text"
          className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Type product name..."
          value={item.name || ''}
          onChange={(e) => {
            updateItemName(cartItemId, e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            if (item.name) setShowSuggestions(true);
          }}
          onKeyDown={(e) => handleKeyDown(e, 'desc')}
        />
        
        {/* Suggestions Dropdown */}
        {showSuggestions && filteredProducts.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {filteredProducts.map(p => (
              <div 
                key={p.id}
                className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                onClick={() => {
                  applyProductToRow(cartItemId, p);
                  setShowSuggestions(false);
                  qtyRef.current?.focus();
                }}
              >
                <div className="font-medium text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>{p.brand} {p.model_number ? `| ${p.model_number}` : ''}</span>
                  <span className="font-semibold text-gray-700">₹{p.base_price}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quantity */}
      <div>
        <input 
          ref={qtyRef}
          type="number"
          min="1"
          className="w-full border border-gray-300 rounded-md p-2 text-center focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={item.quantity === '' ? '' : item.quantity}
          onChange={(e) => updateItemQuantity(cartItemId, e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'qty')}
          onBlur={(e) => {
            if (e.target.value === '' || e.target.value === '0') {
              updateItemQuantity(cartItemId, 1);
            }
          }}
        />
      </div>

      {/* Rate */}
      <div>
        <input 
          ref={rateRef}
          type="number"
          className="w-full border border-gray-300 rounded-md p-2 text-right focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={item.custom_price_override !== null ? item.custom_price_override : item.base_price}
          onChange={(e) => updateItemPrice(cartItemId, e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'rate')}
        />
      </div>

      {/* Discount */}
      <div>
        <input 
          ref={discRef}
          type="number"
          placeholder={globalDiscount ? `${globalDiscount}% (Global)` : '0'}
          className="w-full border border-gray-300 rounded-md p-2 text-right text-red-600 focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={item.discount_override === '' ? '' : item.discount_override}
          onChange={(e) => updateItemDiscount(cartItemId, e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'disc')}
        />
      </div>

      {/* Amount */}
      <div className="text-right font-bold text-gray-900 pr-2">
        ₹{amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
      </div>

      {/* Delete Action */}
      <div className="flex justify-center">
        <button 
          onClick={() => removeItem(cartItemId)}
          className="text-gray-400 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-colors opacity-50 group-hover:opacity-100"
          tabIndex="-1"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
}
