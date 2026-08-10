import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Plus, Pencil, Trash2, Save, X, Boxes, GripVertical, Search } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

export default function RawComponents() {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStock, setNewStock] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStock, setEditStock] = useState(0);
  const { addToast } = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Undo queue state & ref
  const [undoQueue, setUndoQueue] = useState([]);
  const undoQueueRef = useRef([]);

  useEffect(() => {
    undoQueueRef.current = undoQueue;
  }, [undoQueue]);

  useEffect(() => {
    fetchComponents();

    return () => {
      // Finalize all component deletions on unmount
      undoQueueRef.current.forEach(uq => {
        clearTimeout(uq.timerId);
        finalizeComponentDeletion(uq.item.id);
      });
    };
  }, []);

  async function fetchComponents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('raw_components')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('fetchComponents error:', error);
      addToast(`Failed to load components: ${error.message}`, 'error');
    } else {
      setComponents(data || []);
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    const maxOrder = components.length > 0 ? Math.max(...components.map(c => c.sort_order || 0)) : 0;
    const { data, error } = await supabase
      .from('raw_components')
      .insert([{
        name: newName.trim(),
        description: newDesc.trim() || null,
        stock_qty: Number(newStock) || 0,
        sort_order: maxOrder + 1
      }])
      .select()
      .single();
    if (error) {
      addToast('Failed to add component: ' + error.message, 'error');
    } else {
      setComponents(prev => [...prev, data]);
      setNewName('');
      setNewDesc('');
      setNewStock(0);
      addToast(`"${data.name}" added`, 'success');
    }
    setAdding(false);
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return;
    const stockVal = Math.max(0, Number(editStock) || 0);
    const { error } = await supabase
      .from('raw_components')
      .update({ name: editName.trim(), description: editDesc.trim() || null, stock_qty: stockVal })
      .eq('id', id);
    if (error) {
      addToast('Failed to update component', 'error');
    } else {
      setComponents(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim(), description: editDesc.trim() || null, stock_qty: stockVal } : c));
      setEditingId(null);
      addToast('Component updated', 'success');
    }
  }

  async function handleQuickStockChange(id, delta) {
    const comp = components.find(c => c.id === id);
    if (!comp) return;
    const newQty = Math.max(0, (comp.stock_qty || 0) + delta);
    const { error } = await supabase
      .from('raw_components')
      .update({ stock_qty: newQty })
      .eq('id', id);
    if (!error) {
      setComponents(prev => prev.map(c => c.id === id ? { ...c, stock_qty: newQty } : c));
    }
  }

  async function finalizeComponentDeletion(id) {
    try {
      await supabase.from('raw_components').delete().eq('id', id);
    } catch (e) {
      console.error('finalizeComponentDeletion error:', e);
    }
  }

  const handleDeleteTrigger = (id, name) => {
    const target = components.find(c => c.id === id);
    if (!target) return;

    // Immediately remove from list state
    setComponents(prev => prev.filter(c => c.id !== id));

    // Start a 5-second timer to permanently delete
    const timerId = setTimeout(() => {
      finalizeComponentDeletion(id);
      setUndoQueue(prev => prev.filter(q => q.id !== id));
    }, 5000);

    setUndoQueue(prev => [...prev, {
      id,
      item: target,
      timerId
    }]);
  };

  const handleUndoDelete = (id) => {
    const found = undoQueue.find(q => q.id === id);
    if (!found) return;
    clearTimeout(found.timerId);
    setComponents(prev => [...prev, found.item].sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)));
    setUndoQueue(prev => prev.filter(q => q.id !== id));
    addToast(`Restored "${found.item.name}"`, 'success');
  };

  const filteredComponents = components.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.description && c.description.toLowerCase().includes(query))
    );
  });

  return (
    <div className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-gray-200 max-w-3xl mx-auto relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-2 rounded-lg">
            <Boxes className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Raw Components & Stock</h2>
            <p className="text-sm text-gray-500">Global catalog & real-time inventory management</p>
          </div>
        </div>

        <div className="relative w-full sm:w-48">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Add Component */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-3">Add New Component</p>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5 flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Component Name</label>
            <input
              type="text"
              placeholder="e.g. LED Chip"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Description (optional)</label>
            <input
              type="text"
              placeholder="e.g. Philips 12W Driver"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Initial Stock</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={newStock}
              onChange={e => setNewStock(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="sm:col-span-1">
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 whitespace-nowrap h-[38px]"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Component List */}
      {loading ? (
        <p className="text-center text-gray-500 py-8">Loading components...</p>
      ) : filteredComponents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Boxes className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No components match your search</p>
          <p className="text-sm">Try using a different term or add a new component.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filteredComponents.map((comp, idx) => (
            <div key={comp.id} className="py-3 flex items-center gap-3 group">
              <GripVertical className="w-4 h-4 text-gray-300 flex-none" />
              <div className="flex-none w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                {idx + 1}
              </div>

              {editingId === comp.id ? (
                <div className="flex flex-1 gap-2 flex-col sm:flex-row items-center">
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 border border-blue-400 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleSaveEdit(comp.id)}
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleSaveEdit(comp.id)}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 font-medium">Stock:</span>
                    <input
                      type="number"
                      min="0"
                      value={editStock}
                      onChange={e => setEditStock(e.target.value)}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit(comp.id)}
                    />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleSaveEdit(comp.id)} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                      <Save className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{comp.name}</p>
                    {comp.description && <p className="text-xs text-gray-500 truncate">{comp.description}</p>}
                  </div>

                  {/* Stock counter & controls */}
                  <div className="flex items-center gap-2 flex-none">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                      (comp.stock_qty || 0) > 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      (comp.stock_qty || 0) > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-red-50 text-red-600 border border-red-200'
                    }`}>
                      <span>Stock:</span>
                      <span className="font-bold text-sm">{comp.stock_qty ?? 0}</span>
                    </div>

                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
                      <button
                        onClick={() => handleQuickStockChange(comp.id, -1)}
                        className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 border-r border-gray-200 font-bold"
                        title="Decrease stock"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleQuickStockChange(comp.id, +1)}
                        className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold"
                        title="Increase stock"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingId(comp.id); setEditName(comp.name); setEditDesc(comp.description || ''); setEditStock(comp.stock_qty || 0); }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTrigger(comp.id, comp.name)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Floating Undo notifications */}
      {undoQueue.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
          {undoQueue.map(uq => (
            <div key={uq.id} className="bg-gray-900 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-2xl border border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-semibold truncate">Removed "{uq.item.name}"</span>
              </div>
              <button
                onClick={() => handleUndoDelete(uq.id)}
                className="bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors ml-4 shrink-0"
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 text-center">
        {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''} in list
      </p>
    </div>
  );
}
