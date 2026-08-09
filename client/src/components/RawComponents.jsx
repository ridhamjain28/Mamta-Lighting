import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Pencil, Trash2, Save, X, Boxes, GripVertical } from 'lucide-react';
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

  useEffect(() => { fetchComponents(); }, []);

  async function fetchComponents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('raw_components')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) addToast('Failed to load components', 'error');
    else setComponents(data || []);
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

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('raw_components').delete().eq('id', id);
    if (error) {
      addToast('Failed to delete component', 'error');
    } else {
      setComponents(prev => prev.filter(c => c.id !== id));
      addToast(`"${name}" deleted`, 'success');
    }
  }

  return (
    <div className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-gray-200 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
        <div className="bg-slate-100 p-2 rounded-lg">
          <Boxes className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Raw Components & Stock</h2>
          <p className="text-sm text-gray-500">Global catalog & real-time inventory management</p>
        </div>
      </div>

      {/* Add Component */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-3">Add New Component</p>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="text"
            placeholder="Component name (e.g. LED Chip)"
            className="sm:col-span-5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            className="sm:col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <input
            type="number"
            min="0"
            placeholder="Initial Stock"
            className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={newStock}
            onChange={e => setNewStock(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="sm:col-span-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Component List */}
      {loading ? (
        <p className="text-center text-gray-500 py-8">Loading components...</p>
      ) : components.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Boxes className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No components yet</p>
          <p className="text-sm">Add your first raw component above.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {components.map((comp, idx) => (
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
                      onClick={() => handleDelete(comp.id, comp.name)}
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

      <p className="text-xs text-gray-400 mt-4 text-center">
        {components.length} component{components.length !== 1 ? 's' : ''} in catalog
      </p>
    </div>
  );
}
