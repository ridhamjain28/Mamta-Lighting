import React, { useState } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { Trash2, Plus, Minus, FileText, Send, CheckCircle2 } from 'lucide-react';

export default function Cart() {
  const { 
    items, 
    customer, 
    setCustomer, 
    updateItemQuantity, 
    updateItemPrice, 
    updateItemDiscount, 
    removeItem, 
    globalDiscount, 
    setGlobalDiscount, 
    gstIncluded, 
    toggleGst,
    getTotals,
    clearCart
  } = useQuoteStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const { addToast } = useToastStore();

  const { subtotal, discount_amount, gst_amount, grand_total } = getTotals();

  const handleGeneratePdf = async () => {
    if (items.length === 0) return addToast("Cart is empty", "error");
    if (!customer.name) return addToast("Please enter a customer name", "error");

    setIsGenerating(true);
    setSuccessData(null);

    try {
      const itemsWithEffectiveDiscount = items.map(item => ({
        ...item,
        discount_override: (item.discount_override !== '' && item.discount_override !== null) 
          ? Number(item.discount_override) 
          : (Number(globalDiscount) || 0)
      }));

      const response = await fetch(import.meta.env.VITE_API_URL + '/api/quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customer.name,
          customer_phone: customer.phone,
          project_name: customer.project,
          items: itemsWithEffectiveDiscount,
          subtotal,
          discount_amount,
          gst_amount,
          grand_total,
          gst_included: gstIncluded
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate PDF');

      try {
        const pdfResponse = await fetch(data.pdfUrl);
        const blob = await pdfResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Mamta-Quotation-${customer.name.replace(/\\s+/g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (dlError) {
        console.error("Direct download failed:", dlError);
        window.open(data.pdfUrl, '_blank');
      }

      setSuccessData({ pdfUrl: data.pdfUrl });
    } catch (error) {
      console.error(error);
      addToast("Error generating quotation: " + error.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWhatsApp = () => {
    if (!successData?.pdfUrl) return;
    const text = `Hello ${customer.name},\n\nHere is your quotation from Mamta Lighting.\nView/Download PDF: ${successData.pdfUrl}\n\nThank you!`;
    const url = `https://wa.me/${customer.phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (successData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-white text-center">
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Quotation Generated!</h2>
        <p className="text-gray-500 mb-8">The PDF has been successfully saved to the cloud.</p>
        
        <div className="space-y-4 w-full max-w-sm">
          <button 
            onClick={async () => {
              try {
                const pdfResponse = await fetch(successData.pdfUrl);
                const blob = await pdfResponse.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Mamta-Quotation-${customer.name.replace(/\\s+/g, '-')}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              } catch (e) {
                window.open(successData.pdfUrl, '_blank');
              }
            }}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5" /> Download PDF Again
          </button>
          <button 
            onClick={handleWhatsApp}
            className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" /> Send on WhatsApp
          </button>
          <button 
            onClick={() => {
              clearCart();
              setSuccessData(null);
            }}
            className="btn-secondary w-full"
          >
            Start New Quotation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white shadow-[-4px_0_15px_rgba(0,0,0,0.05)] relative z-20">
      
      {/* Customer Details Header */}
      <div className="p-6 border-b border-gray-200 bg-slate-50">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Quotation Details</h2>
        <div className="space-y-3">
          <input 
            type="text" 
            placeholder="Customer Name *" 
            className="input-field" 
            value={customer.name}
            onChange={(e) => setCustomer('name', e.target.value)}
          />
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Phone Number" 
              className="input-field w-1/2" 
              value={customer.phone}
              onChange={(e) => setCustomer('phone', e.target.value)}
            />
            <input 
              type="text" 
              placeholder="Project Name" 
              className="input-field w-1/2" 
              value={customer.project}
              onChange={(e) => setCustomer('project', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Cart Items Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>Cart is empty. Add products to begin.</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative group">
              <button 
                onClick={() => removeItem(item.id)}
                className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="font-semibold text-gray-800 mb-1 pr-6">{item.name}</div>
              <div className="text-xs text-gray-500 mb-3">Model: {item.model_number || 'N/A'}</div>
              
              <div className="flex items-center gap-4 text-sm">
                {/* Quantity */}
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                  <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="p-2 hover:bg-gray-200"><Minus className="w-3 h-3" /></button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="p-2 hover:bg-gray-200"><Plus className="w-3 h-3" /></button>
                </div>

                {/* Price & Discount */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-12 text-xs">Price:</span>
                    <input 
                      type="number" 
                      className="border border-gray-300 rounded p-1 w-24 text-right"
                      value={item.custom_price_override}
                      onChange={(e) => updateItemPrice(item.id, e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-16 text-xs">Disc (%):</span>
                    <input 
                      type="number" 
                      className="border border-gray-300 rounded p-1 w-24 text-right text-red-600"
                      value={item.discount_override === '' ? '' : item.discount_override}
                      placeholder="Default"
                      onChange={(e) => updateItemDiscount(item.id, e.target.value)}
                    />
                  </div>
                </div>

                {/* Total */}
                <div className="text-right font-bold text-gray-800">
                  ₹{((item.custom_price_override - (item.custom_price_override * (((item.discount_override !== '' && item.discount_override !== null) ? Number(item.discount_override) : (Number(globalDiscount) || 0)) / 100))) * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Settings (GST & Global Discount) */}
      {items.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-gray-700 font-medium cursor-pointer">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                checked={gstIncluded}
                onChange={(e) => toggleGst(e.target.checked)}
              />
              Add 18% GST to Total
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Default Discount (%)</span>
            <input 
              type="number" 
              className="border border-gray-300 rounded-md p-1.5 w-24 text-right font-medium text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={globalDiscount || ''}
              onChange={(e) => setGlobalDiscount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      {/* Sticky Footer: Totals & Generate Button */}
      <div className="p-6 border-t border-gray-200 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-gray-500 text-sm">
            <span>Subtotal (After Discounts)</span>
            <span>₹{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          {gstIncluded && (
            <div className="flex justify-between text-gray-500 text-sm">
              <span>GST (18%)</span>
              <span>₹{gst_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-between text-gray-900 font-bold text-2xl mb-6 pt-3 border-t border-gray-200">
          <span>Grand Total</span>
          <span>₹{Math.round(grand_total).toLocaleString()}</span>
        </div>
        
        <button 
          onClick={handleGeneratePdf}
          disabled={isGenerating || items.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating PDF...
            </>
          ) : (
            'Generate PDF Quotation'
          )}
        </button>
      </div>

    </div>
  );
}
