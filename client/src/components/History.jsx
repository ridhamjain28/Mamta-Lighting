import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FileText, Clock, Search } from 'lucide-react';

export default function History() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
                    {quote.pdf_url ? (
                      <a 
                        href={quote.pdf_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-full text-xs font-medium"
                      >
                        <FileText className="w-3 h-3" /> View
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">N/A</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
