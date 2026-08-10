import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Plus, Pencil, Trash2, Save, X, Loader2, Package, Boxes, Settings } from 'lucide-react';

export default function ManufacturingProducts() {
  const { addToast } = useToastStore();
  const [products, setProducts] = useState([]);
  const [rawComponents, setRawComponents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null means adding

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedComponents, setSelectedComponents] = useState([]); // Array of { component_id, default_qty }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchRawComponents();
  }, []);

  async function fetchProducts() {
    setLoading(true);
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('fetchProducts error:', err);
      // Don't toast if tables don't exist yet, we'll show a warning in UI
    } finally {
      setLoading(false);
    }
  }

  async function fetchRawComponents() {
    try {
      const { data, error } = await supabase
        .from('raw_components')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setRawComponents(data || []);
    } catch (err) {
      console.error('fetchRawComponents error:', err);
    }
  }

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setSelectedComponents([]);
    setShowModal(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setName(prod.name);
    setDescription(prod.description || '');
    const comps = prod.manufacturing_product_components.map(mpc => ({
      component_id: mpc.component_id,
      default_qty: mpc.default_qty
    }));
    setSelectedComponents(comps);
    setShowModal(true);
  };

  const handleAddComponentLine = () => {
    if (rawComponents.length === 0) {
      addToast('Add raw components first!', 'error');
      return;
    }
    // Pick the first raw component that isn't already added, or just the first one
    const available = rawComponents.find(rc => !selectedComponents.some(sc => sc.component_id === rc.id)) || rawComponents[0];
    setSelectedComponents([...selectedComponents, { component_id: available.id, default_qty: 1 }]);
  };

  const handleRemoveComponentLine = (idx) => {
    setSelectedComponents(selectedComponents.filter((_, i) => i !== idx));
  };

  const handleComponentChange = (idx, field, value) => {
    const updated = [...selectedComponents];
    updated[idx][field] = value;
    setSelectedComponents(updated);
  };

  async function handleSave() {
    if (!name.trim()) {
      addToast('Product name is required', 'error');
      return;
    }
    setSaving(true);

    try {
      if (editingProduct) {
        // Update product
        const { error: prodErr } = await supabase
          .from('manufacturing_products')
          .update({ name: name.trim(), description: description.trim() || null })
          .eq('id', editingProduct.id);
        
        if (prodErr) throw prodErr;

        // Re-create components (delete old, insert new is simplest)
        const { error: delErr } = await supabase
          .from('manufacturing_product_components')
          .delete()
          .eq('product_id', editingProduct.id);

        if (delErr) throw delErr;

        if (selectedComponents.length > 0) {
          const insertData = selectedComponents.map(sc => ({
            product_id: editingProduct.id,
            component_id: sc.component_id,
            default_qty: Number(sc.default_qty) || 1
          }));
          const { error: insErr } = await supabase
            .from('manufacturing_product_components')
            .insert(insertData);
          if (insErr) throw insErr;
        }

        addToast('Product recipe updated', 'success');
      } else {
        // Create product
        const { data: newProd, error: prodErr } = await supabase
          .from('manufacturing_products')
          .insert([{ name: name.trim(), description: description.trim() || null }])
          .select()
          .single();

        if (prodErr) throw prodErr;

        if (selectedComponents.length > 0) {
          const insertData = selectedComponents.map(sc => ({
            product_id: newProd.id,
            component_id: sc.component_id,
            default_qty: Number(sc.default_qty) || 1
          }));
          const { error: insErr } = await supabase
            .from('manufacturing_product_components')
            .insert(insertData);
          if (insErr) throw insErr;
        }

        addToast('Product recipe created', 'success');
      }

      setShowModal(false);
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      addToast('Failed to save product: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(prod) {
    if (!window.confirm(`Delete product recipe "${prod.name}"?`)) return;
    try {
      const { error } = await supabase
        .from('manufacturing_products')
        .delete()
        .eq('id', prod.id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== prod.id));
      addToast('Product recipe deleted', 'success');
    } catch (err) {
      addToast('Failed to delete product', 'error');
    }
  }

  // Check if tables don't exist yet
  const showDdlWarning = !loading && products.length === 0 && rawComponents.length === 0;

  return (
    <div className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-gray-200 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Products & Recipes</h2>
            <p className="text-sm text-gray-500">Define manufactured items (lights/strips) and their raw component templates</p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Product
        </button>
      </div>

      {showDdlWarning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-6 text-sm">
          <strong>Notice:</strong> If the "Products" tab does not load, please ensure you have executed the latest query in the <strong>SUPABASE_SETUP.sql</strong> file inside your Supabase dashboard SQL editor.
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No products defined yet</p>
          <p className="text-sm">Click "+ New Product" to create your first build recipe (e.g. 12W Panel Light).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map(prod => (
            <div key={prod.id} className="bg-gray-50 rounded-xl border border-gray-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-950 text-base">{prod.name}</h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEdit(prod)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
                      title="Edit Product"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(prod)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {prod.description && <p className="text-xs text-gray-500 mb-4">{prod.description}</p>}
                
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Bill of Materials:</p>
                <div className="space-y-1.5 mb-4">
                  {prod.manufacturing_product_components?.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No components linked.</p>
                  ) : (
                    prod.manufacturing_product_components.map((mpc, idx) => (
                      <div key={mpc.id || idx} className="flex justify-between items-center bg-white border border-gray-150 rounded-lg px-2.5 py-1.5 text-xs text-gray-700">
                        <span className="font-medium">{mpc.raw_components?.name || 'Unknown Component'}</span>
                        <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-100">
                          Qty: {mpc.default_qty}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100 flex-none">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingProduct ? `Edit Recipe: ${editingProduct.name}` : 'New Product Recipe'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1 -mr-1">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. 12W LED Downlight (Philips Chip)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">Description (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Standard strip light recipe using COB strip & premium driver"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Required Raw Components</label>
                  <button
                    type="button"
                    onClick={handleAddComponentLine}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Component
                  </button>
                </div>

                {selectedComponents.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs">
                    No components added to this recipe. Click "+ Add Component" above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedComponents.map((sc, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={sc.component_id}
                          onChange={e => handleComponentChange(idx, 'component_id', e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          {rawComponents.map(rc => (
                            <option key={rc.id} value={rc.id}>
                              {rc.name} (Stock: {rc.stock_qty || 0})
                            </option>
                          ))}
                        </select>

                        <div className="w-24 flex items-center gap-1 flex-none bg-gray-50 border border-gray-300 rounded-lg px-2 py-2">
                          <span className="text-xs text-gray-500">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            value={sc.default_qty}
                            onChange={e => handleComponentChange(idx, 'default_qty', e.target.value)}
                            className="w-full bg-transparent text-sm text-center font-bold focus:outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveComponentLine(idx)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded-lg transition-colors flex-none"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-2 flex-none mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
