import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import {
  Plus, ChevronLeft, Check, Pencil, Trash2,
  ClipboardList, Loader2, Clock, CheckCircle2, Circle,
  Package, Boxes, Search
} from 'lucide-react';
import ManufacturingProducts from './ManufacturingProducts';
import RawComponents from './RawComponents';

const STATUS_CONFIG = {
  'Not Started': { color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  'In Progress': { color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  'Completed':   { color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
};

export default function ManufacturingPortal({ role }) {
  const { addToast } = useToastStore();
  const [portalTab, setPortalTab] = useState('jobs');
  
  // Load Product states
  const [showLoadProductModal, setShowLoadProductModal] = useState(false);
  const [mfgProducts, setMfgProducts] = useState([]);
  const [selectedMfgProduct, setSelectedMfgProduct] = useState(null);
  const [productBuildQty, setProductBuildQty] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [quoteItems, setQuoteItems] = useState([]);

  // Job form
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobNotes, setNewJobNotes] = useState('');
  const [savingJob, setSavingJob] = useState(false);

  // Components for selected job
  const [jobComponents, setJobComponents] = useState([]);
  const [rawComponents, setRawComponents] = useState([]);
  const [showAddComponentDrawer, setShowAddComponentDrawer] = useState(false);
  const [componentSearch, setComponentSearch] = useState('');
  const [selectedRawComponent, setSelectedRawComponent] = useState(null);
  const [addQty, setAddQty] = useState(1);
  const [addingComponent, setAddingComponent] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  // Employee name tracking for job completion
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [employeeName, setEmployeeName] = useState('');

  // Undo queue state & ref
  const [undoQueue, setUndoQueue] = useState([]);
  const undoQueueRef = useRef([]);
  const channelRef = useRef(null);

  useEffect(() => {
    undoQueueRef.current = undoQueue;
  }, [undoQueue]);

  useEffect(() => {
    fetchJobs();
    fetchRawComponents();

    // Realtime subscription for live updates
    channelRef.current = supabase
      .channel('manufacturing_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manufacturing_jobs' }, () => {
        fetchJobs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manufacturing_job_components' }, (payload) => {
        if (selectedJob) fetchJobComponents(selectedJob.id);
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      // Finalize all job deletions on unmount
      undoQueueRef.current.forEach(uq => {
        clearTimeout(uq.timerId);
        finalizeJobDeletion(uq.item.id);
      });
    };
  }, []);

  // Re-fetch job components and quotation details when job changes
  useEffect(() => {
    if (selectedJob) {
      fetchJobComponents(selectedJob.id);
      fetchQuotationDetails(selectedJob.quotation_id);
    }
  }, [selectedJob?.id]);

  useEffect(() => {
    if (showLoadProductModal) {
      fetchMfgProducts();
    }
  }, [showLoadProductModal]);

  async function fetchJobs() {
    const { data, error } = await supabase
      .from('manufacturing_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchJobs error:', error);
      addToast(`Failed to load jobs: ${error.message}`, 'error');
    } else {
      setJobs(data || []);
    }
    setLoading(false);
  }

  async function fetchRawComponents() {
    const { data, error } = await supabase
      .from('raw_components')
      .select('*')
      .order('name', { ascending: true });
    if (error) console.error('fetchRawComponents error:', error);
    setRawComponents(data || []);
  }

  async function fetchQuotationDetails(quoteId) {
    if (!quoteId) {
      setQuoteItems([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          id,
          customer_name,
          project_name,
          quotation_items (
            id,
            quantity,
            products (
              id,
              name,
              model_number
            )
          )
        `)
        .eq('id', quoteId)
        .single();
      if (data && data.quotation_items) {
        setQuoteItems(data.quotation_items);
      } else {
        setQuoteItems([]);
      }
    } catch (e) {
      console.error('fetchQuotationDetails error:', e);
      setQuoteItems([]);
    }
  }

  async function fetchJobComponents(jobId) {
    const { data, error } = await supabase
      .from('manufacturing_job_components')
      .select('*')
      .eq('job_id', jobId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) console.error('fetchJobComponents error:', error);
    setJobComponents(data || []);
  }

  async function fetchMfgProducts() {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          manufacturing_product_components (
            id,
            default_qty,
            component_id,
            raw_components (
              id,
              name,
              stock_qty
            )
          )
        `)
        .eq('show_in_manufacturing', true)
        .order('name', { ascending: true });
      if (error) throw error;
      setMfgProducts(data || []);
      if (data && data.length > 0) {
        setSelectedMfgProduct(data[0]);
      }
    } catch (e) {
      console.error('Error fetching mfg products:', e);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleCreateJob() {
    if (!newJobTitle.trim()) return;
    setSavingJob(true);
    const { data, error } = await supabase
      .from('manufacturing_jobs')
      .insert([{ title: newJobTitle.trim(), notes: newJobNotes.trim() || null, status: 'Not Started' }])
      .select()
      .single();
    if (error) {
      console.error('handleCreateJob error:', error);
      addToast(`Failed to create job: ${error.message}`, 'error');
    } else {
      setJobs(prev => [data, ...prev]);
      setNewJobTitle('');
      setNewJobNotes('');
      setShowNewJobModal(false);
      addToast('Job created!', 'success');
    }
    setSavingJob(false);
  }

  async function finalizeJobDeletion(jobId) {
    try {
      await supabase.from('manufacturing_jobs').delete().eq('id', jobId);
    } catch (e) {
      console.error('finalizeJobDeletion error:', e);
    }
  }

  const handleDeleteJobTrigger = (job) => {
    // Remove immediately from state list
    setJobs(prev => prev.filter(j => j.id !== job.id));
    if (selectedJob?.id === job.id) setSelectedJob(null);

    // Start 5-second timer
    const timerId = setTimeout(() => {
      finalizeJobDeletion(job.id);
      setUndoQueue(prev => prev.filter(q => q.id !== job.id));
    }, 5000);

    setUndoQueue(prev => [...prev, {
      id: job.id,
      item: job,
      timerId
    }]);
  };

  const handleUndoJobDelete = (id) => {
    const found = undoQueue.find(q => q.id === id);
    if (!found) return;
    clearTimeout(found.timerId);
    setJobs(prev => [found.item, ...prev].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    setUndoQueue(prev => prev.filter(q => q.id !== id));
    addToast(`Restored Job "${found.item.title}"`, 'success');
  };

  async function handleAddComponent() {
    if (!selectedRawComponent || !selectedJob) return;
    setAddingComponent(true);
    const maxOrder = jobComponents.length > 0 ? Math.max(...jobComponents.map(c => c.sort_order || 0)) : 0;
    const { data, error } = await supabase
      .from('manufacturing_job_components')
      .insert([{
        job_id: selectedJob.id,
        component_id: selectedRawComponent.id,
        component_name: selectedRawComponent.name,
        planned_qty: Number(addQty) || 1,
        is_collected: false,
        sort_order: maxOrder + 1
      }])
      .select()
      .single();
    if (error) {
      addToast('Failed to add component', 'error');
    } else {
      setJobComponents(prev => [...prev, data]);
      setSelectedRawComponent(null);
      setAddQty(1);
      setComponentSearch('');
      setShowAddComponentDrawer(false);
      addToast(`"${data.component_name}" added`, 'success');
    }
    setAddingComponent(false);
  }

  async function handleToggleCollected(comp) {
    const nextCollected = !comp.is_collected;
    const { error } = await supabase
      .from('manufacturing_job_components')
      .update({ is_collected: nextCollected })
      .eq('id', comp.id);

    if (!error) {
      setJobComponents(prev => prev.map(c => c.id === comp.id ? { ...c, is_collected: nextCollected } : c));

      // Auto-update raw_components stock if linked to catalog
      if (comp.component_id) {
        const targetRaw = rawComponents.find(r => r.id === comp.component_id);
        if (targetRaw) {
          const qty = Number(comp.actual_qty) || Number(comp.planned_qty) || 1;
          const newStock = nextCollected
            ? Math.max(0, (targetRaw.stock_qty || 0) - qty)
            : (targetRaw.stock_qty || 0) + qty;

          await supabase.from('raw_components').update({ stock_qty: newStock }).eq('id', comp.component_id);
          fetchRawComponents();
        }
      }
    }
  }

  async function handleUpdateQtyNote(comp, field, value) {
    const update = { [field]: field === 'note' ? value : (Number(value) || null) };
    const { error } = await supabase
      .from('manufacturing_job_components')
      .update(update)
      .eq('id', comp.id);
    if (!error) {
      setJobComponents(prev => prev.map(c => c.id === comp.id ? { ...c, ...update } : c));
    }
  }

  async function handleDeleteComponent(compId) {
    const { error } = await supabase.from('manufacturing_job_components').delete().eq('id', compId);
    if (!error) setJobComponents(prev => prev.filter(c => c.id !== compId));
  }

  async function handleStatusChange(status) {
    if (status === 'Completed') {
      setEmployeeName('');
      setShowCompletedModal(true);
    } else {
      setSavingStatus(true);
      const { error } = await supabase
        .from('manufacturing_jobs')
        .update({ status, completed_by: null, updated_at: new Date().toISOString() })
        .eq('id', selectedJob.id);
      
      if (error) {
        addToast('Failed to update status', 'error');
      } else {
        setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status, completed_by: null } : j));
        setSelectedJob(prev => ({ ...prev, status, completed_by: null }));
        addToast('Status updated', 'success');
      }
      setSavingStatus(false);
    }
  }

  async function handleSaveCompletion() {
    if (!employeeName.trim()) return;
    setSavingStatus(true);
    const { error } = await supabase
      .from('manufacturing_jobs')
      .update({
        status: 'Completed',
        completed_by: employeeName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedJob.id);

    if (error) {
      addToast('Failed to save completion info', 'error');
    } else {
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: 'Completed', completed_by: employeeName.trim() } : j));
      setSelectedJob(prev => ({ ...prev, status: 'Completed', completed_by: employeeName.trim() }));
      addToast('Job completed successfully', 'success');
      setShowCompletedModal(false);
    }
    setSavingStatus(false);
  }

  async function handleLoadProductTemplate() {
    if (!selectedMfgProduct || !selectedJob) return;
    const comps = selectedMfgProduct.manufacturing_product_components || [];
    if (comps.length === 0) {
      addToast('Selected product has no components in its recipe', 'warning');
      return;
    }

    const multiplier = Number(productBuildQty) || 1;
    const maxOrder = jobComponents.length > 0 ? Math.max(...jobComponents.map(c => c.sort_order || 0)) : 0;

    const inserts = comps.map((mpc, idx) => ({
      job_id: selectedJob.id,
      component_id: mpc.component_id,
      component_name: mpc.raw_components?.name || 'Unknown Component',
      planned_qty: (mpc.default_qty || 1) * multiplier,
      is_collected: false,
      product_name: selectedMfgProduct.name,
      sort_order: maxOrder + idx + 1
    }));

    const { data, error } = await supabase
      .from('manufacturing_job_components')
      .insert(inserts)
      .select();

    if (error) {
      addToast('Failed to load product recipe: ' + error.message, 'error');
    } else {
      setJobComponents(prev => [...prev, ...data]);
      setShowLoadProductModal(false);
      setSelectedMfgProduct(null);
      setProductBuildQty(1);
      addToast(`Recipe for "${selectedMfgProduct.name}" (Qty: ${multiplier}) loaded into job!`, 'success');
    }
  }

  // ─── RENDERING PRODUCTS CHECKS GROUPED ────────────────────────────────────
  const renderProductGroups = () => {
    const grouped = {};
    const extraComps = [];

    jobComponents.forEach(comp => {
      if (comp.product_name) {
        if (!grouped[comp.product_name]) {
          grouped[comp.product_name] = [];
        }
        grouped[comp.product_name].push(comp);
      } else {
        extraComps.push(comp);
      }
    });

    const quoteProducts = quoteItems.map(qi => ({
      name: qi.products?.name || 'Unknown Product',
      qty: qi.quantity
    }));

    const finalGroups = [];

    if (quoteProducts.length > 0) {
      quoteProducts.forEach(qp => {
        const comps = grouped[qp.name] || [];
        // Sort components: unchecked first, checked last
        const sortedComps = [...comps].sort((a, b) => {
          if (a.is_collected === b.is_collected) return (a.sort_order || 0) - (b.sort_order || 0);
          return a.is_collected ? 1 : -1;
        });
        finalGroups.push({
          name: qp.name,
          qty: qp.qty,
          components: sortedComps,
          isQuoteProduct: true
        });
        delete grouped[qp.name];
      });
    }

    // Any remaining custom loaded template products
    Object.keys(grouped).forEach(name => {
      const comps = grouped[name];
      const sortedComps = [...comps].sort((a, b) => {
        if (a.is_collected === b.is_collected) return (a.sort_order || 0) - (b.sort_order || 0);
        return a.is_collected ? 1 : -1;
      });
      finalGroups.push({
        name,
        qty: null,
        components: sortedComps,
        isQuoteProduct: false
      });
    });

    return (
      <div className="space-y-5">
        {finalGroups.map((g, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
                  <Package className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-905 text-sm sm:text-base leading-tight">{g.name}</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-0.5">Product Recipe</p>
                </div>
              </div>
              {g.qty !== null && (
                <span className="bg-blue-50 text-blue-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-blue-100">
                  Build Qty: {g.qty}
                </span>
              )}
            </div>

            {g.components.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs italic">
                No components linked to this product in the job.
              </div>
            ) : (
              <div className="space-y-3">
                {g.components.map(comp => (
                  <div
                    key={comp.id}
                    className={`rounded-xl border p-4 transition-all duration-300 ${
                      comp.is_collected ? 'border-green-200 bg-green-50/30 opacity-70' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleCollected(comp)}
                        className={`flex-none mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                          comp.is_collected ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {comp.is_collected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-semibold text-sm ${comp.is_collected ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {comp.component_name}
                          </p>
                          <button
                            onClick={() => handleDeleteComponent(comp.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-none"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Planned:</span>
                            <input
                              type="number"
                              min="1"
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                              defaultValue={comp.planned_qty}
                              onBlur={e => handleUpdateQtyNote(comp, 'planned_qty', e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Actual:</span>
                            <input
                              type="number"
                              min="0"
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                              defaultValue={comp.actual_qty ?? ''}
                              placeholder="—"
                              onBlur={e => handleUpdateQtyNote(comp, 'actual_qty', e.target.value)}
                            />
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Add a note (e.g. took extra backup)..."
                          className="mt-2 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-650 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          defaultValue={comp.note ?? ''}
                          onBlur={e => handleUpdateQtyNote(comp, 'note', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Extra Manual Parts Card */}
        {extraComps.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1.5 rounded-lg text-slate-600">
                  <Boxes className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-905 text-sm sm:text-base leading-tight">Manual / Custom Parts</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-0.5">Extra Components</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {[...extraComps].sort((a,b) => (a.is_collected === b.is_collected ? 0 : a.is_collected ? 1 : -1)).map(comp => (
                <div
                  key={comp.id}
                  className={`rounded-xl border p-4 transition-all duration-300 ${
                    comp.is_collected ? 'border-green-200 bg-green-50/30 opacity-70' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleCollected(comp)}
                      className={`flex-none mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        comp.is_collected ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {comp.is_collected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-semibold text-sm ${comp.is_collected ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {comp.component_name}
                        </p>
                        <button
                          onClick={() => handleDeleteComponent(comp.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-none"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Planned:</span>
                          <input
                            type="number"
                            min="1"
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                            defaultValue={comp.planned_qty}
                            onBlur={e => handleUpdateQtyNote(comp, 'planned_qty', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Actual:</span>
                          <input
                            type="number"
                            min="0"
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                            defaultValue={comp.actual_qty ?? ''}
                            placeholder="—"
                            onBlur={e => handleUpdateQtyNote(comp, 'actual_qty', e.target.value)}
                          />
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Add a note..."
                        className="mt-2 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-650 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        defaultValue={comp.note ?? ''}
                        onBlur={e => handleUpdateQtyNote(comp, 'note', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── JOB DETAIL VIEW ──────────────────────────────────────────────────────
  if (selectedJob) {
    const totalCount = jobComponents.length;
    const collectedCount = jobComponents.filter(c => c.is_collected).length;
    const progressPct = totalCount > 0 ? Math.round((collectedCount / totalCount) * 100) : 0;
    const cfg = STATUS_CONFIG[selectedJob.status] || STATUS_CONFIG['Not Started'];

    return (
      <div className="flex flex-col min-h-full bg-gray-50 relative pb-28">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => { setSelectedJob(null); setJobComponents([]); setQuoteItems([]); }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 text-sm sm:text-base truncate leading-tight">{selectedJob.title}</h2>
              {selectedJob.completed_by && selectedJob.status === 'Completed' ? (
                <p className="text-[10px] text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-100 mt-1 inline-block">
                  Completed by: {selectedJob.completed_by}
                </p>
              ) : selectedJob.notes ? (
                <p className="text-xs text-gray-500 truncate mt-0.5">{selectedJob.notes}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-none select-none">
            {savingStatus ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
            ) : null}
            <select
              value={selectedJob.status}
              disabled={savingStatus}
              onChange={e => handleStatusChange(e.target.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-250 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold ${cfg.color}`}
            >
              <option value="Not Started" className="bg-white text-gray-950 font-normal">Not Started</option>
              <option value="In Progress" className="bg-white text-gray-950 font-normal">In Progress</option>
              <option value="Completed" className="bg-white text-gray-950 font-normal">Completed</option>
            </select>
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div className="flex-1 p-4 space-y-4">
          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-bold text-gray-700">Completion Status</span>
                <span className="font-extrabold text-gray-900">{collectedCount}/{totalCount} parts collected</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 text-right font-medium">{progressPct}% Complete</p>
            </div>
          )}

          {/* Grouped Component List */}
          {totalCount === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-xl">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-gray-500">No components mapped for this job</p>
              <p className="text-xs mt-1">Load a product recipe template or add parts manually below.</p>
            </div>
          ) : (
            renderProductGroups()
          )}
        </div>

        {/* Sticky footer actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 z-10 shadow-lg">
          <button
            onClick={() => setShowAddComponentDrawer(true)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Component
          </button>
          <button
            onClick={() => setShowLoadProductModal(true)}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-sm"
          >
            <Package className="w-4 h-4" /> Load Product
          </button>
        </div>

        {/* Add Component Drawer */}
        {showAddComponentDrawer && (
          <div className="fixed inset-0 z-40 bg-black/40 flex justify-end">
            <div className="bg-white w-full max-w-md h-full flex flex-col p-6 animate-in slide-in-from-right duration-250">
              <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4 flex-none">
                <h3 className="font-bold text-gray-900 text-base">Add Component to Job</h3>
                <button onClick={() => { setShowAddComponentDrawer(false); setSelectedRawComponent(null); }} className="text-xl text-gray-400 hover:text-gray-600">×</button>
              </div>

              {/* Component selection search */}
              <div className="relative flex-none mb-3">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search raw components..."
                  value={componentSearch}
                  onChange={e => setComponentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                {rawComponents
                  .filter(r => r.name.toLowerCase().includes(componentSearch.toLowerCase()))
                  .map(rc => (
                    <button
                      key={rc.id}
                      onClick={() => setSelectedRawComponent(rc)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all text-sm flex justify-between items-center ${
                        selectedRawComponent?.id === rc.id
                          ? 'border-blue-600 bg-blue-50/50 font-bold text-blue-700'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <span className="truncate">{rc.name}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold ml-2">
                        Stock: {rc.stock_qty || 0} {rc.unit || 'pcs'}
                      </span>
                    </button>
                  ))}
              </div>

              {selectedRawComponent && (
                <div className="border-t border-gray-200 pt-4 flex-none mt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-semibold text-gray-700 shrink-0">Planned Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={addQty}
                      onChange={e => setAddQty(e.target.value)}
                      className="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm text-center font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddComponent}
                    disabled={addingComponent}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    {addingComponent ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-4 h-4" /> Add to Checklist</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Load Product Modal */}
        {showLoadProductModal && (
          <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-gray-150 pb-3 mb-4">
                <h3 className="font-bold text-gray-905 text-base">Load Product Recipe</h3>
                <button onClick={() => setShowLoadProductModal(false)} className="text-xl text-gray-400 hover:text-gray-600">×</button>
              </div>

              {loadingProducts ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : mfgProducts.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-4">No manufacturing products mapped yet.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-650 block mb-1">Select Product</label>
                    <select
                      value={selectedMfgProduct?.id || ''}
                      onChange={e => {
                        const found = mfgProducts.find(p => p.id === parseInt(e.target.value));
                        setSelectedMfgProduct(found);
                      }}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {mfgProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-655 block mb-1">Build Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={productBuildQty}
                      onChange={e => setProductBuildQty(e.target.value)}
                      className="w-24 border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleLoadProductTemplate}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2"
                  >
                    Load Recipe
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Job Completion Input Modal */}
        {showCompletedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100">
              <h3 className="font-bold text-gray-900 text-base mb-1.5">Job Completed</h3>
              <p className="text-xs text-gray-500 mb-4">Please enter your name to complete this build:</p>
              <input
                autoFocus
                type="text"
                placeholder="Your Name (e.g. Rahul)"
                value={employeeName}
                onChange={e => setEmployeeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && employeeName.trim() && handleSaveCompletion()}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCompletedModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCompletion}
                  disabled={savingStatus || !employeeName.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                >
                  Confirm Build
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── JOB LIST VIEW ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full bg-gray-50 relative">
      {/* Header with tabs inline */}
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center justify-between sticky top-0 z-10 flex-none gap-2 flex-wrap shadow-xs">
        <div className="flex gap-1">
          <button
            onClick={() => setPortalTab('jobs')}
            className={`px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              portalTab === 'jobs'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardList className="w-4.5 h-4.5" /> Jobs
          </button>
          <button
            onClick={() => setPortalTab('products')}
            className={`px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              portalTab === 'products'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="w-4.5 h-4.5" /> Products
          </button>
          <button
            onClick={() => setPortalTab('raw-components')}
            className={`px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              portalTab === 'raw-components'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Boxes className="w-4.5 h-4.5" /> Raw Components
          </button>
        </div>

        {portalTab === 'jobs' && (
          <button
            onClick={() => setShowNewJobModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4.5 h-4.5" />
            New Job
          </button>
        )}
      </div>

      {/* Tab Contents */}
      {portalTab === 'jobs' && (
        <div className="flex-1 p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-semibold text-gray-500">No manufacturing jobs yet</p>
              <p className="text-sm mt-1">Create a new job or send a quotation to manufacturing.</p>
            </div>
          ) : (
            jobs.map(job => {
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG['Not Started'];
              return (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-xs transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm leading-tight">{job.title}</h3>
                      {job.completed_by && job.status === 'Completed' ? (
                        <p className="text-[10px] text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded mt-1.5 inline-block border border-green-100">
                          Completed by: {job.completed_by}
                        </p>
                      ) : job.notes ? (
                        <p className="text-xs text-gray-500 mt-1 truncate">{job.notes}</p>
                      ) : null}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-none border ${cfg.color}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 mt-2">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(job.updated_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      {role === 'admin' && (
                        <button
                          onClick={() => handleDeleteJobTrigger(job)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg border border-transparent hover:border-gray-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Open →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Floating Undo notifications */}
      {undoQueue.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 animate-in fade-in duration-200">
          {undoQueue.map(uq => (
            <div key={uq.id} className="bg-gray-900 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-2xl border border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-semibold truncate">Deleted Job "{uq.item.title}"</span>
              </div>
              <button
                onClick={() => handleUndoJobDelete(uq.id)}
                className="bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors ml-4 shrink-0"
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      {portalTab === 'products' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <ManufacturingProducts role={role} isGlobal={false} />
        </div>
      )}

      {portalTab === 'raw-components' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <RawComponents />
        </div>
      )}

      {/* New Job Modal */}
      {showNewJobModal && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-base">New Manufacturing Job</h3>
              <button onClick={() => { setShowNewJobModal(false); setNewJobTitle(''); setNewJobNotes(''); }} className="text-xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Job Title *</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Sharma – 5× Sierra Light"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={newJobTitle}
                  onChange={e => setNewJobTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateJob()}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Any additional notes for this job..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  value={newJobNotes}
                  onChange={e => setNewJobNotes(e.target.value)}
                />
              </div>
              <button
                onClick={handleCreateJob}
                disabled={savingJob || !newJobTitle.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {savingJob ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
