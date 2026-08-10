import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';

export default function ComponentSelect({ value, onChange, options, onCreateNew }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt.id === value);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-left text-sm flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
      >
        <span className="truncate text-gray-700 font-medium">
          {selectedOption ? `${selectedOption.name} (Stock: ${selectedOption.stock_qty ?? 0})` : 'Select Component...'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="relative border-b border-gray-150 p-2 flex-none">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search component..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="overflow-y-auto flex-1 max-h-40">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 italic text-center">No components found</div>
            ) : (
              filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2.5 text-xs hover:bg-blue-50 transition-colors flex justify-between items-center ${
                    value === opt.id ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700'
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium ml-1">
                    Stock: {opt.stock_qty ?? 0}
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onCreateNew();
              setIsOpen(false);
            }}
            className="w-full border-t border-gray-200 px-3 py-2.5 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1.5 bg-gray-50"
          >
            <Plus className="w-3.5 h-3.5" /> Create New Component
          </button>
        </div>
      )}
    </div>
  );
}
