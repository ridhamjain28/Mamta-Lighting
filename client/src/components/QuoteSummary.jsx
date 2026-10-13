import React, { useState, useEffect } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { FileText, Save, CheckCircle2, Send, Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '../supabase';
import { openWhatsAppQuotation } from '../utils/whatsapp';

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
    clearCart,
    saveQuoteToDatabase
  } = useQuoteStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [buildSent, setBuildSent] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const { addToast } = useToastStore();
  const role = sessionStorage.getItem('role');

  // Reset success state if any quote parameters change
  useEffect(() => {
    if (successData) {
      setSuccessData(null);
    }
  }, [items, customer, globalDiscount, gstIncluded, hideListPrice]);

  const { subtotal, discount_amount, gst_amount, grand_total } = getTotals();


  const handleGeneratePdf = async () => {
    if (items.length === 0) return addToast("Cart is empty", "error");
    if (!customer.name) return addToast("Please enter a customer name", "error");

    setIsGenerating(true);
    setSuccessData(null);

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

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch(e) {
          errorData = { error: 'Failed to generate PDF' };
        }
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Update the DB with Completed status (without PDF URL)
      await saveQuoteToDatabase('Completed');

      try {
        const projPart = customer.project ? ` - ${customer.project}` : '';
        const namePart = customer.name ? customer.name : 'Walk-in';
        
        let brandPart = '';
        if (quoteType === 'Switch Quote' && activeItems.length > 0) {
          const firstSwitch = activeItems.find(i => i.product_type === 'Switch Product' || i.product_type === 'Manual Product');
          if (firstSwitch) {
            const brandName = firstSwitch.brands?.name || '';
            const subBrand = firstSwitch.sub_brand || '';
            const color = firstSwitch.color || '';
            const str = `${brandName} ${subBrand} ${color}`.trim();
            if (str) brandPart = ` - ${str}`;
          }
        }
        
        const fileName = `Quotation - ${namePart}${projPart}${brandPart}.pdf`;
        
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (dlError) {
        console.error("Direct download failed:", dlError);
        window.open(pdfUrl, '_blank');
      }

      setSuccessData({ pdfUrl });
    } catch (error) {
      console.error(error);
      addToast("Error generating quotation: " + error.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWhatsApp = () => {
    const { grand_total } = getTotals();
    openWhatsAppQuotation({
      customerName: customer.name,
      phoneNumber: customer.phone,
      projectName: customer.project,
      grandTotal: grand_total,
      quoteType: quoteType || 'Lighting Quote'
    });
  };

  const handleBuild = async () => {
    setBuildLoading(true);
    try {
      const { quoteId: qId } = useQuoteStore.getState();
      const namePart = customer.name || 'Walk-in';
      const projPart = customer.project ? ` – ${customer.project}` : '';
      const title = `${namePart}${projPart}`;
      const { data: newJob, error } = await supabase
        .from('manufacturing_jobs')
        .insert([{ quotation_id: qId ? String(qId) : null, title, status: 'Not Started' }])
        .select()
        .single();
      if (error) throw error;

      // Keep each quoted product's recipe attached to that product in the job.
      const buildItems = items.filter(item => Number(item.quantity) > 0 && item.id);
      const productIds = [...new Set(buildItems.map(item => item.id))];

      if (productIds.length > 0) {
        const { data: recipes, error: recipeError } = await supabase
          .from('manufacturing_product_components')
          .select(`
            product_id,
            component_id,
            default_qty,
            raw_components (
              name
            )
          `)
          .in('product_id', productIds);

        if (recipeError) throw recipeError;

        const jobComponents = [];
        let sortOrder = 0;

        buildItems.forEach(item => {
          const productRecipes = (recipes || []).filter(recipe => recipe.product_id === item.id);
          productRecipes.forEach(recipe => {
            const buildQty = Number(item.quantity) || 0;
            const perProductQty = Number(recipe.default_qty) || 1;
            jobComponents.push({
              job_id: newJob.id,
              component_id: recipe.component_id,
              component_name: recipe.raw_components?.name || 'Unknown Component',
              planned_qty: buildQty * perProductQty,
              is_collected: false,
              product_id: item.id,
              product_name: item.name || 'Unknown Product',
              note: recipe.raw_components?.name || 'Unknown Component',
              sort_order: sortOrder++
            });
          });
        });

        if (jobComponents.length > 0) {
          const { error: componentError } = await supabase
            .from('manufacturing_job_components')
            .insert(jobComponents);
          if (componentError) throw componentError;
        }
      }

      setBuildSent(true);
      addToast(`Job "${title}" sent to Manufacturing!`, 'success');
    } catch (err) {
      console.error('handleBuild error:', err);
      addToast(`Failed to send to manufacturing: ${err.message || err}`, 'error');
    } finally {
      setBuildLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-white text-center rounded-b-xl">
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Quotation Generated!</h2>
        <p className="text-gray-700 mb-8">The PDF has been successfully saved to the cloud.</p>
        
        <div className="space-y-4 w-full max-w-sm">
          <button 
            onClick={async () => {
              try {
                const projPart = customer.project ? ` - ${customer.project}` : '';
                const namePart = customer.name ? customer.name : 'Walk-in';
                const fileName = `Quotation - ${namePart}${projPart}.pdf`;
                const downloadUrl = successData.pdfUrl;
                
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
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
          {role === 'admin' && (
            <button
              onClick={handleBuild}
              disabled={buildLoading || buildSent}
              className={`w-full font-medium py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 ${
                buildSent
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
              }`}
            >
              {buildLoading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <ClipboardList className="w-5 h-5" />
              }
              {buildSent ? 'Sent to Manufacturing ✓' : 'Send to Manufacturing'}
            </button>
          )}
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
          <div className="flex justify-between text-gray-700 text-sm">
            <span>Subtotal (After Discounts)</span>
            <span>₹{Math.ceil(subtotal).toLocaleString()}</span>
          </div>
          {gstIncluded && (
            <div className="flex justify-between text-gray-700 text-sm">
              <span>GST (18%)</span>
              <span>₹{Math.ceil(gst_amount).toLocaleString()}</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-between text-gray-900 font-bold text-2xl mb-6 pt-3 border-t border-gray-200">
          <span>Grand Total</span>
          <span>₹{Math.ceil(grand_total).toLocaleString()}</span>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleGeneratePdf}
            disabled={isGenerating || items.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Generate PDF'
            )}
          </button>
          <button
            onClick={handleWhatsApp}
            disabled={items.length === 0}
            className="bg-[#25D366] hover:bg-[#1ebd5a] disabled:opacity-40 text-white font-bold px-4 py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 text-sm shrink-0"
            title="Share via WhatsApp"
          >
            <Send className="w-4 h-4" /> WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
