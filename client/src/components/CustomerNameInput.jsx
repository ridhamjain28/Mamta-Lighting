import React, { useState, useEffect, useRef } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { toTitleCase } from '../utils/textFormatters';

export default function CustomerNameInput({ className }) {
  const { customer, setCustomer, customerDirectory, fetchCustomerDirectory } = useQuoteStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const containerRef = useRef(null);

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

  const handleChange = (val) => {
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
    <div className="relative flex-1" ref={containerRef}>
      <input 
        spellCheck={true}
        type="text" 
        placeholder="Customer Name *" 
        className={className || "input-field w-full"} 
        value={customer.name || ''}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={(e) => {
          const val = e.target.value;
          setCustomer('name', toTitleCase(val));
          // Slight timeout to let mouse down register selection before closing suggestions
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
  );
}
