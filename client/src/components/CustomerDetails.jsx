import React from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { ArrowLeft } from 'lucide-react';

export default function CustomerDetails() {
  const { customer, setCustomer, setQuoteMetadata, quoteType } = useQuoteStore();

  return (
    <div className="p-6 border-b border-gray-200 bg-slate-50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Quotation Details</h2>
        <button 
          onClick={() => setQuoteMetadata({ quoteType: null })}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Change Type
        </button>
      </div>
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
  );
}
