import React, { useState, useEffect, useRef } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { ArrowLeft, XCircle, Save, Loader2 } from 'lucide-react';
import { toTitleCase } from '../utils/textFormatters';

export default function CustomerDetails() {
  const { 
    customer, 
    setCustomer, 
    setQuoteMetadata, 
    quoteType, 
    quoteId, 
    clearCart, 
    saveQuoteToDatabase, 
    items,
    customerDirectory,
    fetchCustomerDirectory
  } = useQuoteStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const containerRef = useRef(null);
  const { addToast } = useToastStore();

  const handleManualSave = async () => {
    setIsSaving(true);
    const saved = await saveQuoteToDatabase('Draft');
    if (saved) {
      addToast("Quotation saved successfully", "success");
    }
    setIsSaving(false);
  };

  useEffect(() => {
    fetchCustomerDirectory();
  }, [fetchCustomerDirectory]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFilteredSuggestions = (val) => {
    if (val.trim() === '') {
      return customerDirectory.slice(0, 5);
    }
    return customerDirectory.filter(c => 
      c.name.toLowerCase().includes(val.toLowerCase()) || 
      (c.phone && c.phone.includes(val))
    );
  };

  const handleNameChange = (val) => {
    setCustomer('name', val);
    setSuggestions(getFilteredSuggestions(val));
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    setSuggestions(getFilteredSuggestions(customer.name || ''));
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (selected) => {
    setCustomer('name', selected.name);
    setCustomer('phone', selected.phone);
    setCustomer('project', selected.project);
    setShowSuggestions(false);
  };

  return (
    <div className="p-6 border-b border-gray-200 bg-slate-50" ref={containerRef}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">
          {quoteId ? 'Editing Quotation' : 'Quotation Details'}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={handleManualSave}
            disabled={isSaving || items.length === 0}
            className="text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1 bg-white px-3 py-1.5 rounded border border-gray-300 shadow-sm transition-colors"
            title="Save Quote as Draft"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
            Save
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
          {quoteType !== 'Image Quote' && (
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
        <div className="relative">
          <input 
            spellCheck={true}
            type="text" 
            placeholder="Customer Name *" 
            className="input-field" 
            value={customer.name}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={(e) => {
              const val = e.target.value;
              setCustomer('name', toTitleCase(val));
              // Timeout to let clicks on suggestions register first
              setTimeout(() => setShowSuggestions(false), 200);
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-[9999] divide-y divide-gray-100">
              {suggestions.map((s, idx) => (
                <div 
                  key={idx}
                  onMouseDown={() => handleSelectSuggestion(s)}
                  className="p-3 hover:bg-blue-50 cursor-pointer transition-colors text-left flex justify-between items-center"
                >
                  <div>
                    <span className="font-semibold text-gray-900 capitalize text-sm">{s.name}</span>
                    {s.project && <span className="text-gray-500 text-xs ml-2">({s.project})</span>}
                  </div>
                  {s.phone && <span className="text-xs text-gray-600 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{s.phone}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Phone Number" 
            className="input-field w-1/2" 
            value={customer.phone}
            onChange={(e) => setCustomer('phone', e.target.value)}
          />
          <input 
            spellCheck={true}
            type="text" 
            placeholder="Project Name" 
            className="input-field w-1/2" 
            value={customer.project}
            onChange={(e) => setCustomer('project', e.target.value)}
            onBlur={(e) => setCustomer('project', toTitleCase(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
