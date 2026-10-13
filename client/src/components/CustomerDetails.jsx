import React, { useState } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { ArrowLeft, XCircle, Save, Loader2, RotateCcw } from 'lucide-react';
import { toTitleCase } from '../utils/textFormatters';
import CustomerNameInput from './CustomerNameInput';

export default function CustomerDetails() {
  const { 
    customer, 
    setCustomer, 
    setQuoteMetadata, 
    quoteType, 
    quoteId, 
    clearCart, 
    saveQuoteToDatabase, 
    items 
  } = useQuoteStore();
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToastStore();

  const handleManualSave = async () => {
    setIsSaving(true);
    await saveQuoteToDatabase('Draft');
    setIsSaving(false);
  };

  const handleClear = () => {
    clearCart();
  };

  return (
    <div className="p-6 border-b border-gray-200 bg-slate-50">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-gray-800">
            {quoteId ? 'Editing Quotation' : 'Quotation Details'}
          </h2>
          <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-full border border-blue-200">
            Date: {new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}
          </span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleClear}
            className="text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1 bg-white px-3 py-1.5 rounded border border-gray-300 shadow-sm transition-colors"
            title="Clear customer details and products"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
            Clear
          </button>
          <button 
            onClick={handleManualSave}
            disabled={isSaving || items.length === 0}
            className="text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1 bg-white px-3 py-1.5 rounded border border-gray-300 shadow-sm transition-colors"
            title="Save Quote as Draft"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
            Save Draft
          </button>
          {quoteId && (
            <button 
              onClick={clearCart}
              className="text-sm font-medium text-red-600 hover:text-red-800 flex items-center gap-1 bg-white px-2 py-1.5 rounded border border-gray-200 shadow-sm transition-colors"
              title="Cancel editing and start a new quote"
            >
              <XCircle className="w-4 h-4" /> Cancel Edit
            </button>
          )}
          {quoteType !== 'Lighting Quote' && quoteType !== 'Image Quote' && (
            <button 
              onClick={() => setQuoteMetadata({ quoteType: null })}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white px-2 py-1.5 rounded border border-gray-200 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Change Type
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <CustomerNameInput />
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Phone Number" 
            className="input-field w-1/2" 
            value={customer.phone || ''}
            onChange={(e) => setCustomer('phone', e.target.value)}
          />
          <input 
            spellCheck={true}
            type="text" 
            placeholder="Project Name" 
            className="input-field w-1/2" 
            value={customer.project || ''}
            onChange={(e) => setCustomer('project', e.target.value)}
            onBlur={(e) => setCustomer('project', toTitleCase(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
