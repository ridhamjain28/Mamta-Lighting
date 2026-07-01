import React, { useState } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { FileText, Save, CheckCircle2, Send, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';

export default function QuoteSummary() {
  const { 
    items, 
    customer, 
    globalDiscount, 
    setGlobalDiscount, 
    gstIncluded, 
    toggleGst,
    hideListPrice,
    toggleHideListPrice,
    getTotals,
    quoteId,
    quoteType,
    status,
    setQuoteMetadata,
    clearCart
  } = useQuoteStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const { addToast } = useToastStore();

  const { subtotal, discount_amount, gst_amount, grand_total } = getTotals();

  const saveQuoteToDatabase = async (finalStatus = status, pdfUrl = null) => {
    if (items.length === 0) {
      addToast("Cart is empty", "error");
      return null;
    }
    if (!customer.name) {
      addToast("Please enter a customer name", "error");
      return null;
    }

    const activeItems = items.filter(item => Number(item.quantity) > 0);

    const payload = {
      customer_name: customer.name,
      phone_number: customer.phone,
      project_name: customer.project,
      items: activeItems,
      subtotal,
      tax_amount: gst_amount,
      total_discount: discount_amount,
      grand_total,
      quote_type: quoteType,
      status: finalStatus,
      updated_at: new Date().toISOString()
    };

    if (pdfUrl) {
      payload.pdf_url = pdfUrl;
    }

    try {
      let savedQuote;
      if (quoteId) {
        // Update existing
        const { data, error } = await supabase
          .from('quotations')
          .update(payload)
          .eq('id', quoteId)
          .select()
          .single();
        if (error) throw error;
        savedQuote = data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('quotations')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        savedQuote = data;
      }
      
      setQuoteMetadata({ quoteId: savedQuote.id, status: savedQuote.status });
      return savedQuote;
    } catch (error) {
      console.error("Save error:", error);
      addToast("Failed to save quotation: " + error.message, "error");
      return null;
    }
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    const saved = await saveQuoteToDatabase('Draft');
    if (saved) {
      addToast("Quotation saved successfully", "success");
    }
    setIsSaving(false);
  };

  const handleGeneratePdf = async () => {
    if (items.length === 0) return addToast("Cart is empty", "error");
    if (!customer.name) return addToast("Please enter a customer name", "error");

    setIsGenerating(true);
    setSuccessData(null);

    // If it takes longer than 6 seconds, let the user know the server is waking up
    const slowServerTimeout = setTimeout(() => {
      addToast("Waking up cloud server... this can take up to 60 seconds.", "success");
    }, 6000);

    try {
      const activeItems = items.filter(item => Number(item.quantity) > 0);

      const itemsWithEffectiveDiscount = activeItems.map(item => ({
        ...item,
        discount_override: (item.discount_override !== '' && item.discount_override !== null) 
          ? Number(item.discount_override) 
          : (Number(globalDiscount) || 0)
      }));

      // First, save as draft to ensure we have an ID and data is preserved
      let currentQuote = await saveQuoteToDatabase('Draft');
      if (!currentQuote) throw new Error("Failed to save quotation data before PDF generation.");

      // Generate PDF
      const response = await fetch(import.meta.env.VITE_API_URL + '/api/quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customer.name,
          phone_number: customer.phone,
          project_name: customer.project,
          items: itemsWithEffectiveDiscount,
          subtotal,
          discount_amount,
          gst_amount,
          grand_total,
          gst_included: gstIncluded,
          hide_list_price: hideListPrice,
          quote_type: quoteType,
          quote_id: currentQuote.id
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate PDF');

      // Update the DB with Completed status and PDF URL
      await saveQuoteToDatabase('Completed', data.pdfUrl);

      try {
        const pdfResponse = await fetch(data.pdfUrl);
        const blob = await pdfResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Quotation-${customer.name.replace(/\\s+/g, '-')}.pdf`;
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
      clearTimeout(slowServerTimeout);
      setIsGenerating(false);
    }
  };

  const handleWhatsApp = () => {
    if (!successData?.pdfUrl) return;
    const text = `Hello ${customer.name},\n\nHere is your quotation.\nView/Download PDF: ${successData.pdfUrl}\n\nThank you!`;
    const url = `https://wa.me/${customer.phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (successData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-white text-center rounded-b-xl">
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
                a.download = `Quotation-${customer.name.replace(/\\s+/g, '-')}.pdf`;
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

  // Modern Toggle Switch Component
  const ToggleSwitch = ({ checked, onChange }) => (
    <button
      type="button"
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
      onClick={() => onChange(!checked)}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="bg-white rounded-b-xl shadow-[-4px_0_15px_rgba(0,0,0,0.05)] relative z-10 flex flex-col mt-auto">
      {/* Settings (GST & Global Discount) */}
      {items.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Add 18% GST to Total</span>
            <ToggleSwitch checked={gstIncluded} onChange={toggleGst} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Hide List Price on PDF</span>
            <ToggleSwitch checked={hideListPrice} onChange={toggleHideListPrice} />
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <span className="text-gray-700 font-medium">Default Discount (%)</span>
            <input 
              type="number" 
              className="border border-gray-300 rounded-md p-1.5 w-24 text-right font-medium text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={globalDiscount || ''}
              onChange={(e) => setGlobalDiscount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      {/* Sticky Footer: Totals & Actions */}
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
        
        <div className="flex gap-3">
          <button 
            onClick={handleManualSave}
            disabled={isSaving || isGenerating || items.length === 0}
            className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save
          </button>
          
          <button 
            onClick={handleGeneratePdf}
            disabled={isGenerating || isSaving || items.length === 0}
            className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Generate PDF'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
