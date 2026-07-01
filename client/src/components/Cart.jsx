import React from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { Trash2, Plus, Minus, FileText } from 'lucide-react';
import CustomerDetails from './CustomerDetails';
import QuoteSummary from './QuoteSummary';

export default function Cart() {
  const { 
    items, 
    updateItemQuantity, 
    updateItemPrice, 
    updateItemDiscount, 
    removeItem,
    globalDiscount
  } = useQuoteStore();

  return (
    <div className="h-full flex flex-col bg-white shadow-[-4px_0_15px_rgba(0,0,0,0.05)] relative z-10">
      
      {/* Customer Details Header */}
      <CustomerDetails />

      {/* Cart Items Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>Cart is empty. Add products to begin.</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.cartItemId || item.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative group">
              <button 
                onClick={() => removeItem(item.cartItemId || item.id)}
                className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <h4 className="font-semibold text-gray-900 pr-6">
                {item.name} {item.selected_wattage && <span className="text-blue-600 font-bold ml-1">({item.selected_wattage})</span>}
              </h4>
              <div className="text-xs text-gray-700 mb-3">Model: {item.model_number || 'N/A'}</div>
              
              <div className="flex items-center gap-4 text-sm">
                {/* Quantity */}
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                  <button onClick={() => updateItemQuantity(item.cartItemId || item.id, Math.max(1, (Number(item.quantity) || 0) - 1))} className="p-2 hover:bg-gray-200"><Minus className="w-3 h-3" /></button>
                  <input 
                    type="number" 
                    min="1"
                    className="w-12 text-center font-medium bg-transparent focus:outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={item.quantity === '' ? '' : item.quantity}
                    onChange={(e) => updateItemQuantity(item.cartItemId || item.id, e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value === '' || e.target.value === '0') {
                        updateItemQuantity(item.cartItemId || item.id, 1);
                      }
                    }}
                  />
                  <button onClick={() => updateItemQuantity(item.cartItemId || item.id, (Number(item.quantity) || 0) + 1)} className="p-2 hover:bg-gray-200"><Plus className="w-3 h-3" /></button>
                </div>

                {/* Price & Discount */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 w-12 text-xs">Price:</span>
                    <input 
                      type="number" 
                      className="border border-gray-300 rounded p-1 w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={item.custom_price_override ?? ''}
                      placeholder={item.base_price}
                      onChange={(e) => updateItemPrice(item.cartItemId || item.id, e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 w-16 text-xs">Disc (%):</span>
                    <input 
                      type="number" 
                      className="border border-gray-300 rounded p-1 w-24 text-right text-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={item.discount_override === '' ? '' : item.discount_override}
                      placeholder="Default"
                      onChange={(e) => updateItemDiscount(item.cartItemId || item.id, e.target.value)}
                    />
                  </div>
                </div>

                {/* Total */}
                <div className="text-right font-bold text-gray-800">
                  {(() => {
                    let price = item.custom_price_override;
                    if (price === null || price === undefined || price === '' || Number(price) === 0) {
                      price = item.base_price;
                    } else {
                      price = Number(price);
                    }
                    const disc = (item.discount_override !== '' && item.discount_override !== null) ? Number(item.discount_override) : (Number(globalDiscount) || 0);
                    const finalPrice = price - (price * (disc / 100));
                    return `₹${(finalPrice * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
                  })()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary and Generate PDF */}
      <QuoteSummary />
    </div>
  );
}
