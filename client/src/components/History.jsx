import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FileText, Clock, Search, Trash2 } from 'lucide-react';

export default function History() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeletes, setPendingDeletes] = useState([]);

  useEffect(() => {
    fetchQuotes();
  }, []);

  async function fetchQuotes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // If the table doesn't exist yet, it'll fail gracefully.
        console.error("Error fetching quotes (table might not exist):", error.message);
      } else {
        setQuotes(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const initiateDelete = (quote) => {
    const deleteId = quote.id;
    
    // Hide it instantly
    setQuotes(prev => prev.filter(q => q.id !== deleteId));

    // Wait 10 seconds before actually deleting
    const timer = setTimeout(async () => {
      try {
        if (quote.pdf_url) {
          const fileName = quote.pdf_url.split('/').pop();
          if (fileName) {
            await supabase.storage.from('quotations').remove([fileName]);
          }
        }
        await supabase.from('quotations').delete().eq('id', deleteId);
      } catch (err) {
        console.error("Failed delayed delete:", err);
      }
      
      setPendingDeletes(prev => prev.filter(p => p.id !== deleteId));
    }, 10000);

    setPendingDeletes(prev => [...prev, { id: deleteId, quote, timer }]);
  };

  const undoDelete = (deleteObj) => {
    clearTimeout(deleteObj.timer);
    setQuotes(prev => [deleteObj.quote, ...prev].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    setPendingDeletes(prev => prev.filter(p => p.id !== deleteObj.id));
  };

  const handleDownloadPdf = async (pdfUrl, quoteNumber) => {
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Direct download failed:", err);
      // Fallback if browser blocks silent download
      window.open(pdfUrl, '_blank');
    }
  };

  const filteredQuotes = quotes.filter(q => 
    q.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.phone_number?.includes(searchTerm) ||
    q.quote_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <div className="flex items-center gap-3">
          <Clock className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Quotation History</h2>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search quotes..."
            className="input-field pl-9 py-1.5 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
              <th className="py-3 px-4 font-medium">Date & Quote #</th>
              <th className="py-3 px-4 font-medium">Customer</th>
              <th className="py-3 px-4 font-medium">Amount</th>
              <th className="py-3 px-4 font-medium text-center">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading ? (
              <tr>
                <td colSpan="4" className="py-8 text-center text-gray-500">Loading history...</td>
              </tr>
            ) : filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan="4" className="py-8 text-center text-gray-500">No quotation history found.</td>
              </tr>
            ) : (
              filteredQuotes.map(quote => (
                <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                    <div>{new Date(quote.created_at).toLocaleDateString()}</div>
                    <div className="text-xs font-mono text-gray-400">{quote.quote_number}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{quote.customer_name}</div>
                    <div className="text-xs text-gray-500">{quote.phone_number}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">
                    ₹{quote.grand_total ? parseFloat(quote.grand_total).toLocaleString(undefined, {minimumFractionDigits:2}) : '0.00'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {quote.pdf_url ? (
                        <button 
                          onClick={() => handleDownloadPdf(quote.pdf_url, quote.quote_number)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-full text-xs font-medium cursor-pointer"
                        >
                          <FileText className="w-3 h-3" /> Download
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                      
                      <button 
                        onClick={() => initiateDelete(quote)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Quotation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes shrinkTimer {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {pendingDeletes.map(pd => (
          <div key={pd.id} className="bg-gray-900 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center justify-between min-w-[280px] relative overflow-hidden transition-all">
            <div className="text-sm font-medium">Quotation Deleted</div>
            <button 
              onClick={() => undoDelete(pd)}
              className="text-blue-400 font-bold text-sm hover:text-blue-300 bg-gray-800 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            >
              UNDO
            </button>
            <div 
              className="absolute bottom-0 left-0 h-1 bg-blue-500 rounded-bl-xl" 
              style={{ animation: 'shrinkTimer 10s linear forwards' }}
            ></div>
          </div>
        ))}
      </div>
    </div>
  );
}
