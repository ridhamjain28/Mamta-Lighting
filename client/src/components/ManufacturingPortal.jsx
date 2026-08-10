import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import {
  Plus, ChevronLeft, Check, Pencil, Trash2,
  ClipboardList, Loader2, Clock, CheckCircle2, Circle,
  Package, Boxes
} from 'lucide-react';
import ManufacturingProducts from './ManufacturingProducts';
import RawComponents from './RawComponents';

const STATUS_CONFIG = {
  'Not Started': { color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  'In Progress': { color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  'Completed':   { color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
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
  const [activeTab, setActiveTab] = useState('details');

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
  const channelRef = useRef(null);

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
    };
  }, []);

  // Re-fetch job components when job changes
  useEffect(() => {
    if (selectedJob) fetchJobComponents(selectedJob.id);
  }, [selectedJob?.id]);

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
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) console.error('fetchRawComponents error:', error);
    setRawComponents(data || []);
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

  async function handleDeleteJob(job) {
    if (!window.confirm(`Delete job "${job.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('manufacturing_jobs').delete().eq('id', job.id);
    if (error) {
      addToast('Failed to delete job', 'error');
    } else {
      setJobs(prev => prev.filter(j => j.id !== job.id));
      if (selectedJob?.id === job.id) setSelectedJob(null);
      addToast('Job deleted', 'success');
    }
  }

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

  async function handleUpdateStatus(jobId, status) {
    setSavingStatus(true);
    const { error } = await supabase
      .from('manufacturing_jobs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) {
      addToast('Failed to update status', 'error');
    } else {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status } : j));
      if (selectedJob?.id === jobId) setSelectedJob(prev => ({ ...prev, status }));
      addToast('Status updated', 'success');
    }
    setSavingStatus(false);
  }

  useEffect(() => {
    if (showLoadProductModal) {
      fetchMfgProducts();
    }
  }, [showLoadProductModal]);

  async function fetchMfgProducts() {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('manufacturing_products')
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

  const collectedCount = jobComponents.filter(c => c.is_collected).length;
  const totalCount = jobComponents.length;
  const progressPct = totalCount > 0 ? Math.round((collectedCount / totalCount) * 100) : 0;

  const filteredRaw = rawComponents.filter(rc =>
    rc.name.toLowerCase().includes(componentSearch.toLowerCase())
  );

  // ─── JOB DETAIL VIEW ──────────────────────────────────────────────────────
  if (selectedJob) {
    const cfg = STATUS_CONFIG[selectedJob.status] || STATUS_CONFIG['Not Started'];
    return (
      <div className="flex flex-col min-h-full bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => { setSelectedJob(null); setJobComponents([]); setActiveTab('details'); }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base truncate">{selectedJob.title}</h2>
            {selectedJob.notes && <p className="text-xs text-gray-500 truncate">{selectedJob.notes}</p>}
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
            {selectedJob.status}
          </span>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 flex px-4 gap-1">
          {['details', 'status'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'details' ? 'Details' : 'Status'}
            </button>
          ))}
        </div>

        {/* ── DETAILS TAB ── */}
        {activeTab === 'details' && (
          <div className="flex-1 p-4 space-y-3 pb-32">
            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700">Progress</span>
                  <span className="font-bold text-gray-900">{collectedCount}/{totalCount} collected</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-right">{progressPct}%</p>
              </div>
            )}

            {/* Component list */}
            {jobComponents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-gray-500">No components added yet</p>
                <p className="text-sm">Tap "+ Add Component" to get started.</p>
              </div>
            ) : (
              jobComponents.map(comp => (
                <div
                  key={comp.id}
                  className={`bg-white rounded-xl border p-4 transition-all ${
                    comp.is_collected ? 'border-green-200 bg-green-50/50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleCollected(comp)}
                      className={`flex-none mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        comp.is_collected
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {comp.is_collected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
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

                      {/* Qty fields */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Planned:</span>
                          <input
                            type="number"
                            min="1"
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            defaultValue={comp.planned_qty}
                            onBlur={e => handleUpdateQtyNote(comp, 'planned_qty', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Actual:</span>
                          <input
                            type="number"
                            min="0"
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            defaultValue={comp.actual_qty ?? ''}
                            placeholder="—"
                            onBlur={e => handleUpdateQtyNote(comp, 'actual_qty', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Note */}
                      <input
                        type="text"
                        placeholder="Add a note (e.g. took 2 extra as backup)…"
                        className="mt-2 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        defaultValue={comp.note ?? ''}
                        onBlur={e => handleUpdateQtyNote(comp, 'note', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {activeTab === 'status' && (
          <div className="flex-1 p-4 space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Job Status</p>
              <div className="space-y-3">
                {Object.keys(STATUS_CONFIG).map(statusOption => {
                  const isActive = selectedJob.status === statusOption;
                  const scfg = STATUS_CONFIG[statusOption];
                  return (
                    <button
                      key={statusOption}
                      onClick={() => handleUpdateStatus(selectedJob.id, statusOption)}
                      disabled={savingStatus}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                        isActive
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${scfg.dot} flex-none`} />
                      <span className={`font-semibold text-sm flex-1 ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                        {statusOption}
                      </span>
                      {isActive && <CheckCircle2 className="w-5 h-5 text-blue-500 flex-none" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-xs text-gray-500 space-y-1">
              <p>Created: {new Date(selectedJob.created_at).toLocaleString()}</p>
              <p>Last updated: {new Date(selectedJob.updated_at).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Floating Actions (only on details tab) */}
        {activeTab === 'details' && (
          <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 gap-3 z-30">
            <button
              onClick={() => setShowAddComponentDrawer(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl shadow-lg font-semibold flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add Component
            </button>
            <button
              onClick={() => setShowLoadProductModal(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-xl shadow-lg font-semibold flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Package className="w-4 h-4" strokeWidth={2.5} />
              Load Product
            </button>
          </div>
        )}

        {/* Load Product Modal */}
        {showLoadProductModal && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
            <div className="bg-white rounded-t-2xl p-5 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Load Product Recipe</h3>
                <button onClick={() => { setShowLoadProductModal(false); setSelectedMfgProduct(null); setProductBuildQty(1); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <span className="text-xl text-gray-500">×</span>
                </button>
              </div>

              {loadingProducts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : mfgProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No product recipes defined yet.</p>
                  <p className="text-xs mt-1">Create products in the "Products" tab of the Manufacturing Portal first.</p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">Select Product</label>
                    <select
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={selectedMfgProduct?.id || ''}
                      onChange={e => {
                        const prod = mfgProducts.find(p => p.id === e.target.value);
                        setSelectedMfgProduct(prod);
                      }}
                    >
                      {mfgProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1 font-bold">Build Quantity</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={productBuildQty}
                      onChange={e => setProductBuildQty(e.target.value)}
                      onBlur={e => setProductBuildQty(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>

                  {selectedMfgProduct && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Components to be added:</p>
                      <div className="space-y-1.5">
                        {selectedMfgProduct.manufacturing_product_components?.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No components in this recipe.</p>
                        ) : (
                          selectedMfgProduct.manufacturing_product_components.map((mpc, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs text-gray-600">
                              <span>{mpc.raw_components?.name || 'Unknown Component'}</span>
                              <span className="font-semibold text-gray-900">
                                {(mpc.default_qty || 1) * (Number(productBuildQty) || 0)} units ({(mpc.default_qty || 1)} × {Number(productBuildQty) || 0})
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleLoadProductTemplate}
                    disabled={!selectedMfgProduct || selectedMfgProduct.manufacturing_product_components?.length === 0}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Package className="w-5 h-5" /> Load components into Job
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Component Drawer / Modal */}
        {showAddComponentDrawer && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
            <div className="bg-white rounded-t-2xl p-5 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Add Component</h3>
                <button onClick={() => { setShowAddComponentDrawer(false); setSelectedRawComponent(null); setComponentSearch(''); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <span className="text-xl text-gray-500">×</span>
                </button>
              </div>

              {/* Search */}
              <input
                autoFocus
                type="text"
                placeholder="Search components..."
                className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={componentSearch}
                onChange={e => setComponentSearch(e.target.value)}
              />

              {/* Component list */}
              <div className="overflow-y-auto flex-1 -mx-1 px-1">
                {filteredRaw.length === 0 ? (
                  <p className="text-center text-gray-400 py-6 text-sm">No components found</p>
                ) : (
                  filteredRaw.map(rc => (
                    <button
                      key={rc.id}
                      onClick={() => setSelectedRawComponent(rc)}
                      className={`w-full text-left px-3 py-3 rounded-xl mb-1.5 transition-colors flex items-center gap-3 ${
                        selectedRawComponent?.id === rc.id
                          ? 'bg-blue-50 border-2 border-blue-400'
                          : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex-none ${
                        selectedRawComponent?.id === rc.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {selectedRawComponent?.id === rc.id && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-0.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{rc.name}</p>
                        {rc.description && <p className="text-xs text-gray-500">{rc.description}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-none ${
                        (rc.stock_qty || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>
                        Stock: {rc.stock_qty ?? 0}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Qty + Add */}
              {selectedRawComponent && (
                <div className="pt-3 mt-3 border-t border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-medium text-gray-700">Quantity:</span>
                    <input
                      type="number"
                      min="1"
                      value={addQty}
                      onChange={e => setAddQty(e.target.value)}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-sm text-gray-500">of <strong>{selectedRawComponent.name}</strong></span>
                  </div>
                  <button
                    onClick={handleAddComponent}
                    disabled={addingComponent}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {addingComponent ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Add to Job</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── JOB LIST VIEW ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header with tabs inline */}
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center justify-between sticky top-0 z-10 flex-none gap-2 flex-wrap">
        <div className="flex gap-1">
          <button
            onClick={() => setPortalTab('jobs')}
            className={`px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              portalTab === 'jobs'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Jobs
          </button>
          <button
            onClick={() => setPortalTab('products')}
            className={`px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              portalTab === 'products'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="w-4 h-4" /> Products
          </button>
          <button
            onClick={() => setPortalTab('raw-components')}
            className={`px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              portalTab === 'raw-components'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Boxes className="w-4 h-4" /> Raw Components
          </button>
        </div>

        {portalTab === 'jobs' && (
          <button
            onClick={() => setShowNewJobModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
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
                  className="bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm leading-tight">{job.title}</h3>
                      {job.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{job.notes}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-none ${cfg.color}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1.5`} />
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(job.updated_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      {role === 'admin' && (
                        <button
                          onClick={() => handleDeleteJob(job)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedJob(job); setActiveTab('details'); }}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
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

      {portalTab === 'products' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <ManufacturingProducts />
        </div>
      )}

      {portalTab === 'raw-components' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <RawComponents />
        </div>
      )}

      {/* New Job Modal */}
      {showNewJobModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-5">
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
