import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FileText, Clock, Search, Trash2, Edit, Copy, RotateCcw } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';

export default function History({ setActiveTab }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, quote: null });
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchQuotes();
  }, [showTrash]);

  async function fetchQuotes() {
    setLoading(true);
    try {
      const systemMode = useQuoteStore.getState().systemMode;
      const { data, error } = await supabase
        .from('quotations')
        .select('*, quotation_items(*, products(*, brands(*)))')
        .eq('is_deleted', showTrash)
        .eq('quote_type', systemMode || 'Image Quote')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error("Error fetching quotes:", error.message);
      } else {
        setQuotes(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSoftDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('quotations')
        .update({ is_deleted: true })
        .eq('id', id);
      
      if (error) throw error;
      setQuotes(prev => prev.filter(q => q.id !== id));
      addToast("Quotation moved to trash.", "success");
    } catch (err) {
      addToast("Failed to delete quotation.", "error");
    }
  };

  const handleRestore = async (id) => {
    try {
      const { error } = await supabase
        .from('quotations')
        .update({ is_deleted: false })
        .eq('id', id);
      
      if (error) throw error;
      setQuotes(prev => prev.filter(q => q.id !== id));
      addToast("Quotation restored.", "success");
    } catch (err) {
      addToast("Failed to restore quotation.", "error");
    }
  };

  const handlePermanentDelete = async (quote) => {
    try {
      if (quote.pdf_url) {
        const fileName = quote.pdf_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('quotations').remove([fileName]);
        }
      }
      const { error } = await supabase.from('quotations').delete().eq('id', quote.id);
      if (error) throw error;
      
      setQuotes(prev => prev.filter(q => q.id !== quote.id));
      addToast("Quotation permanently deleted.", "success");
    } catch (err) {
      addToast("Failed to delete quotation.", "error");
    }
  };

  const mapQuotationItems = (quote) => {
    return (quote.quotation_items || []).map(qi => ({
      ...qi.products,
      cartItemId: qi.products.selected_wattage ? `${qi.products.id}-${qi.products.selected_wattage}` : qi.products.id,
      quantity: qi.quantity,
      discount_override: qi.discount_override,
      custom_price_override: qi.custom_price_override
    }));
  };

  const handleEdit = (quote) => {
    const { setCustomer, setQuoteMetadata } = useQuoteStore.getState();
    
    setQuoteMetadata({
      quoteId: quote.id,
      quoteType: quote.quote_type || 'Image Quote',
      status: quote.status || 'Draft',
      items: mapQuotationItems(quote),
      globalDiscount: quote.global_discount || 0,
      gstIncluded: quote.gst_included || false,
      hideListPrice: quote.hide_list_price || false,
    });
    
    setCustomer('name', quote.customer_name || '');
    setCustomer('phone', quote.phone_number || '');
    setCustomer('project', quote.project_name || '');

    setActiveTab('new-quote');
  };

  const handleDuplicate = (quote) => {
    const { setCustomer, setQuoteMetadata } = useQuoteStore.getState();
    
    setQuoteMetadata({
      quoteId: null, // New Quote
      quoteType: quote.quote_type || 'Image Quote',
      status: 'Draft',
      items: mapQuotationItems(quote),
      globalDiscount: quote.global_discount || 0,
      gstIncluded: quote.gst_included || false,
      hideListPrice: quote.hide_list_price || false,
    });
    
    setCustomer('name', quote.customer_name || '');
    setCustomer('phone', quote.phone_number || '');
    setCustomer('project', quote.project_name || '');

    addToast("Quotation duplicated. You are now editing a new draft.", "success");
    setActiveTab('new-quote');
  };

  const handleDownloadPdf = async (quote) => {
    try {
      const projPart = quote.project_name ? ` - ${quote.project_name}` : '';
      const namePart = quote.customer_name ? quote.customer_name : 'Walk-in';
      const fileName = `Quotation - ${namePart}${projPart}.pdf`;
      const downloadUrl = `${quote.pdf_url}?download=${encodeURIComponent(fileName)}`;
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      window.open(quote.pdf_url, '_blank');
    }
  };

  const filteredQuotes = quotes.filter(q => {
    const search = searchTerm.toLowerCase();
    
    // Deep search through items for product matches
    const itemsMatch = q.items && q.items.some(item => 
      item.name?.toLowerCase().includes(search) || 
      item.brand?.toLowerCase().includes(search) ||
      item.model_number?.toLowerCase().includes(search)
    );

    return (
      q.customer_name?.toLowerCase().includes(search) ||
      q.phone_number?.includes(search) ||
      q.project_name?.toLowerCase().includes(search) ||
      q.quote_type?.toLowerCase().includes(search) ||
      new Date(q.created_at).toLocaleDateString().includes(search) ||
      String(q.id).includes(search) ||
      itemsMatch
    );
  });

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b pb-4 gap-4">
        <div className="flex items-center gap-3">
          <Clock className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Quotation History</h2>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
            <input
              type="text"
              placeholder="Search quotes or products..."
              className="input-field pl-9 py-2 text-sm w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowTrash(!showTrash)}
            className={`px-4 py-2 rounded-md font-medium text-sm border transition-colors whitespace-nowrap ${showTrash ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            {showTrash ? 'View Active' : 'View Trash'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-200 text-sm text-gray-700 uppercase tracking-wider">
              <th className="py-3 px-4 font-medium">Date & ID</th>
              <th className="py-3 px-4 font-medium">Customer</th>
              <th className="py-3 px-4 font-medium">Type / Status</th>
              <th className="py-3 px-4 font-medium">Amount</th>
              <th className="py-3 px-4 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-700">Loading history...</td>
              </tr>
            ) : filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-700">No quotations found in {showTrash ? 'Trash' : 'History'}.</td>
              </tr>
            ) : (
              filteredQuotes.map(quote => (
                <tr key={quote.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                    <div>{new Date(quote.updated_at || quote.created_at).toLocaleDateString()}</div>
                    <div className="text-xs font-mono text-gray-600">ID: {quote.id}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{quote.customer_name}</div>
                    <div className="text-xs text-gray-700">{quote.phone_number} {quote.project_name && `• ${quote.project_name}`}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-700 text-xs bg-gray-100 inline-block px-2 py-1 rounded mb-1">{quote.quote_type || 'Image Quote'}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">
                    ₹{quote.grand_total ? parseFloat(quote.grand_total).toLocaleString(undefined, {minimumFractionDigits:2}) : '0.00'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      
                      {!showTrash && (
                        <>
                          <button onClick={() => handleEdit(quote)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDuplicate(quote)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition-colors" title="Duplicate">
                            <Copy className="w-4 h-4" />
                          </button>
                          {quote.pdf_url && (
                            <button onClick={() => handleDownloadPdf(quote)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Download PDF">
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleSoftDelete(quote.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Move to Trash">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {showTrash && (
                        <>
                          <button onClick={() => handleRestore(quote.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors" title="Restore">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteConfirm({ isOpen: true, quote })} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Permanently Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Quotation"
        message="Are you sure you want to permanently delete this quotation? This cannot be undone."
        onConfirm={() => {
          handlePermanentDelete(deleteConfirm.quote);
          setDeleteConfirm({ isOpen: false, quote: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, quote: null })}
        confirmText="Delete Permanently"
      />
    </div>
  );
}
