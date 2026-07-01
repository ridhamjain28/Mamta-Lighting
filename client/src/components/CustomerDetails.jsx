import React from 'react';
import { useQuoteStore } from '../store/useQuoteStore';

export default function CustomerDetails() {
  const { customer, setCustomer } = useQuoteStore();

  return (
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
  );
}
