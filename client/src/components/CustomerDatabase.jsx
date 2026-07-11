import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FileText, Search, Trash2, Edit, Copy, Plus, X, Phone, Folder, Users, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { toTitleCase } from '../utils/textFormatters';

export default function CustomerDatabase({ setActiveTab }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, quote: null });
  const [generatingPdfId, setGeneratingPdfId] = useState(null);
  
  // Add Customer Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', project: '' });
  const [isAdding, setIsAdding] = useState(false);

  const { addToast } = useToastStore();

  useEffect(() => {
    fetchQuotesAndGroup();
  }, []);

  async function fetchQuotesAndGroup() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*, quotation_items(*, products(*, brands(*)))')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error("Error fetching quotes:", error.message);
        addToast("Failed to fetch customer quotations", "error");
      } else {
        setQuotes(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Soft delete quotation
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

  const mapQuotationItems = (quote) => {
    return (quote.quotation_items || [])
      .map((qi, index) => {
        if (!qi.products) return null;
        const baseId = qi.products.selected_wattage ? `${qi.products.id}-${qi.products.selected_wattage}` : qi.products.id;
        const uniqueSuffix = `${Date.now()}-${index}`;
        return {
          ...qi.products,
          cartItemId: `${baseId}-${uniqueSuffix}`,
          quantity: qi.quantity,
          description: qi.description || '',
          discount_override: qi.discount_override !== null && qi.discount_override !== undefined ? qi.discount_override : '',
          custom_price_override: qi.custom_price_override
        };
      })
      .filter(Boolean);
  };

  const handleEdit = (quote) => {
    const { setCustomer, setQuoteMetadata, setSystemMode } = useQuoteStore.getState();
    
    // 1. First switch the active quotation system mode
    setSystemMode(quote.quote_type || 'Image Quote');
    
    // 2. Set active metadata and cart items
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

    // 3. Navigate to appropriate tab
    if (quote.quote_type === 'Comparison') {
      setActiveTab('compare');
    } else {
      setActiveTab('new-quote');
    }
    
    addToast(`Editing ${quote.quote_type || 'Image Quote'} for ${quote.customer_name}`, "info");
  };

  const handleDuplicate = (quote) => {
    const { setCustomer, setQuoteMetadata, setSystemMode } = useQuoteStore.getState();
    
    setSystemMode(quote.quote_type || 'Image Quote');
    
    setQuoteMetadata({
      quoteId: null, // Marks as new draft
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
    if (quote.quote_type === 'Comparison') {
      setActiveTab('compare');
    } else {
      setActiveTab('new-quote');
    }
  };

  const handleDownloadPdf = async (quote) => {
    try {
      const projPart = quote.project_name ? ` - ${quote.project_name}` : '';
      const namePart = quote.customer_name ? quote.customer_name : 'Walk-in';
      const fileName = `Quotation - ${namePart}${projPart}.pdf`;
      
      if (quote.pdf_url) {
        const downloadUrl = `${quote.pdf_url}?download=${encodeURIComponent(fileName)}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setGeneratingPdfId(quote.id);
        const mappedItems = mapQuotationItems(quote);
        
        const payload = {
          customer_name: quote.customer_name,
          phone_number: quote.phone_number,
          project_name: quote.project_name,
          items: mappedItems,
          subtotal: quote.subtotal,
          discount_amount: quote.total_discount,
          gst_amount: quote.tax_amount,
          grand_total: quote.grand_total,
          gst_included: quote.gst_included || false,
          hide_list_price: quote.hide_list_price || false,
          quote_type: quote.quote_type || 'Image Quote',
          quote_id: quote.id
        };

        const response = await fetch(import.meta.env.VITE_API_URL + '/api/quotation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
           throw new Error('Failed to generate PDF on the fly');
        }

        const pdfBlob = await response.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to download PDF.", "error");
      if (quote.pdf_url) {
        window.open(quote.pdf_url, '_blank');
      }
    } finally {
      setGeneratingPdfId(null);
    }
  };

  // Create new customer placeholder quotation
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      addToast("Customer name is required.", "error");
      return;
    }

    setIsAdding(true);
    try {
      const payload = {
        customer_name: toTitleCase(newCustomer.name.trim()),
        phone_number: newCustomer.phone.trim(),
        project_name: toTitleCase(newCustomer.project.trim()),
        quote_number: 'QT-' + Math.floor(100000 + Math.random() * 900000).toString(),
        quote_type: 'Image Quote',
        status: 'Draft',
        subtotal: 0,
        tax_amount: 0,
        total_discount: 0,
        grand_total: 0,
        is_deleted: false,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('quotations')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      addToast("Customer details added successfully.", "success");
      setIsAddModalOpen(false);
      setNewCustomer({ name: '', phone: '', project: '' });
      // Re-fetch database to refresh list
      await fetchQuotesAndGroup();
    } catch (err) {
      console.error(err);
      addToast("Failed to add customer.", "error");
    } finally {
      setIsAdding(false);
    }
  };

  // Group quotes by customer
  const getGroupedCustomers = () => {
    const customerMap = {};
    
    quotes.forEach(quote => {
      const name = (quote.customer_name || '').trim();
      const phone = (quote.phone_number || '').trim();
      const key = `${name.toLowerCase()}-${phone.toLowerCase()}`;
      
      if (!name) return; // Skip empty names
      
      if (!customerMap[key]) {
        customerMap[key] = {
          key,
          name,
          phone,
          projects: new Set(),
          quotes: []
        };
      }
      
      if (quote.project_name) {
        customerMap[key].projects.add(quote.project_name.trim());
      }
      customerMap[key].quotes.push(quote);
    });

    return Object.values(customerMap).map(c => ({
      ...c,
      projects: Array.from(c.projects)
    })).sort((a, b) => a.name.localeCompare(b.name));
  };

  const toggleExpand = (key) => {
    const next = new Set(expandedCustomers);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedCustomers(next);
  };

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700',
      'bg-cyan-100 text-cyan-700',
      'bg-indigo-100 text-indigo-700'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const allCustomers = getGroupedCustomers();

  // Search filter
  const filteredCustomers = allCustomers.filter(customer => {
    const search = searchTerm.toLowerCase();
    const nameMatch = customer.name.toLowerCase().includes(search);
    const phoneMatch = customer.phone.includes(search);
    const projectMatch = customer.projects.some(p => p.toLowerCase().includes(search));
    const quoteIdMatch = customer.quotes.some(q => 
      q.id.toString().includes(search) || 
      (q.quote_number && q.quote_number.toLowerCase().includes(search))
    );
    
    return nameMatch || phoneMatch || projectMatch || quoteIdMatch;
  });

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 w-full">
      
      {/* Title & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-gray-700" />
            Customer Database
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage customer profiles and access their complete quotation history.</p>
        </div>

        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-2xl shadow-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] text-sm self-start md:self-auto"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by customer name, phone, project, or quotation ID..."
          className="block w-full pl-11 pr-10 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900 bg-gray-50 placeholder-gray-400 transition-all"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Customer List Container */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Loading customer database...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-3xl text-gray-500">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-700">No customers found</p>
            <p className="text-sm text-gray-400 mt-1">Try refining your search or add a new customer details profile.</p>
          </div>
        ) : (
          filteredCustomers.map(c => {
            const isExpanded = expandedCustomers.has(c.key);
            const avatarColorClass = getAvatarColor(c.name);
            return (
              <div 
                key={c.key} 
                className={`border rounded-2xl overflow-hidden transition-all duration-200 ${isExpanded ? 'border-blue-200 bg-blue-50/20 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
              >
                {/* Accordion Trigger Header */}
                <div 
                  onClick={() => toggleExpand(c.key)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors select-none"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Initials Avatar */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm flex-none ${avatarColorClass}`}>
                      {getInitials(c.name)}
                    </div>
                    
                    {/* Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                      <div>
                        <h3 className="font-bold text-gray-900 capitalize text-base">{c.name}</h3>
                        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-1">
                          {c.quotes.length} {c.quotes.length === 1 ? 'Quotation' : 'Quotations'}
                        </span>
                      </div>
                      
                      {/* Phone */}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {c.phone ? (
                          <>
                            <Phone className="w-4 h-4 text-gray-400 flex-none" />
                            <span className="font-mono">{c.phone}</span>
                          </>
                        ) : (
                          <span className="text-gray-400 italic">No Phone Number</span>
                        )}
                      </div>
                      
                      {/* Projects */}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {c.projects.length > 0 ? (
                          <>
                            <Folder className="w-4 h-4 text-gray-400 flex-none" />
                            <span className="truncate max-w-[200px]" title={c.projects.join(', ')}>
                              {c.projects.join(', ')}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400 italic">No Project Name</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expand Chevron */}
                  <div className="text-gray-400 hover:text-gray-600 ml-4">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Accordion Content (Quotation List) */}
                {isExpanded && (
                  <div className="bg-white border-t border-gray-100 p-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quotation History</h4>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                            <th className="py-2 px-3 font-semibold">Date & ID</th>
                            <th className="py-2 px-3 font-semibold">Project</th>
                            <th className="py-2 px-3 font-semibold">Quote Type / Status</th>
                            <th className="py-2 px-3 font-semibold text-right">Amount</th>
                            <th className="py-2 px-3 font-semibold text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                          {c.quotes.map(quote => {
                            // Style variables based on type
                            let badgeStyle = 'bg-gray-100 text-gray-700';
                            if (quote.quote_type === 'Image Quote') badgeStyle = 'bg-blue-50 text-blue-700 border border-blue-100';
                            if (quote.quote_type === 'Switch Quote') badgeStyle = 'bg-purple-50 text-purple-700 border border-purple-100';
                            if (quote.quote_type === 'Wire Quote') badgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                            if (quote.quote_type === 'Comparison') badgeStyle = 'bg-amber-50 text-amber-700 border border-amber-100';

                            return (
                              <tr key={quote.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                                  <div className="font-medium">{new Date(quote.updated_at || quote.created_at).toLocaleDateString()}</div>
                                  <div className="text-xs font-mono text-gray-400">ID: {quote.id}</div>
                                </td>
                                <td className="py-3 px-3 text-gray-700 font-medium">
                                  {quote.project_name || <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeStyle}`}>
                                      {quote.quote_type || 'Image Quote'}
                                    </span>
                                    <span className={`text-[10px] uppercase font-bold tracking-wide ${quote.status === 'Final' ? 'text-green-600' : 'text-gray-400'}`}>
                                      {quote.status || 'Draft'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 font-bold text-gray-900 text-right">
                                  ₹{quote.grand_total ? parseFloat(quote.grand_total).toLocaleString(undefined, {minimumFractionDigits:2}) : '0.00'}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => handleEdit(quote)} 
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" 
                                      title="Edit Quotation"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDuplicate(quote)} 
                                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition-colors" 
                                      title="Duplicate Quote"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadPdf(quote)} 
                                      disabled={generatingPdfId === quote.id} 
                                      className={`p-1.5 rounded-md transition-colors ${generatingPdfId === quote.id ? 'text-gray-400 cursor-not-allowed' : 'text-emerald-600 hover:bg-emerald-50'}`} 
                                      title="Download PDF"
                                    >
                                      <FileText className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => setDeleteConfirm({ isOpen: true, quote })} 
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" 
                                      title="Move to Trash"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Quotation"
        message="Are you sure you want to delete this quotation? You can restore it from the History Trash menu."
        onConfirm={() => {
          handleSoftDelete(deleteConfirm.quote.id);
          setDeleteConfirm({ isOpen: false, quote: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, quote: null })}
        confirmText="Delete"
      />

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-700" />
                Add New Customer
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Customer Name *
                </label>
                <input
                  required
                  spellCheck={true}
                  type="text"
                  placeholder="e.g. Chetan Bhai"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Project Name
                </label>
                <input
                  spellCheck={true}
                  type="text"
                  placeholder="e.g. Office Renovation"
                  value={newCustomer.project}
                  onChange={(e) => setNewCustomer({ ...newCustomer, project: e.target.value })}
                  className="input-field w-full"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors text-sm disabled:opacity-50"
                >
                  {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
