import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Plus, Pencil, Trash2, Save, X, Loader2, Package, Boxes, Settings, Bookmark, Tag } from 'lucide-react';
import { toTitleCase } from '../utils/textFormatters';

export default function ManufacturingProducts() {
  const { addToast } = useToastStore();
  const [products, setProducts] = useState([]);
  const [rawComponents, setRawComponents] = useState([]);
  const [brands, setBrands] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null means adding

  // Form state
  const [name, setName] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [brandId, setBrandId] = useState('');
  const [unitType, setUnitType] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState([]); // Array of { name, price }
  const [selectedComponents, setSelectedComponents] = useState([]); // Array of { component_id, default_qty }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchRawComponents();
    fetchMetadata();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          brands ( name ),
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
        .or('product_type.eq.Image Product,product_type.is.null') // Only fetch Image Products (like in Image Quote)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('fetchProducts error:', err);
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

  async function fetchMetadata() {
    try {
      const { data: brandData } = await supabase.from('brands').select('*');
      if (brandData) setBrands(brandData.sort((a,b) => a.name.localeCompare(b.name)));

      const { data: unitTypeData } = await supabase.from('unit_types').select('*');
      if (unitTypeData) setUnitTypes(unitTypeData.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('fetchMetadata error:', err);
    }
  }

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setModelNumber('');
    setBrandId('');
    setUnitType('');
    setBasePrice('');
    setDescription('');
    setVariants([]);
    setSelectedComponents([]);
    setShowModal(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setName(prod.name || '');
    setModelNumber(prod.model_number || '');
    setBrandId(prod.brand_id || '');
    setUnitType(prod.unit_type || '');
    setBasePrice(prod.base_price || '');
    setDescription(prod.description || '');
    setVariants(prod.variants || []);
    
    const comps = (prod.manufacturing_product_components || []).map(mpc => ({
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

  const handleAddVariant = () => {
    setVariants([...variants, { name: '', price: '' }]);
  };

  const handleRemoveVariant = (idx) => {
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const handleVariantChange = (idx, field, value) => {
    const updated = [...variants];
    updated[idx][field] = value;
    setVariants(updated);
  };

  async function handleSave() {
    if (!name.trim()) {
      addToast('Product name is required', 'error');
      return;
    }
    if (!basePrice && basePrice !== 0) {
      addToast('Base price is required', 'error');
      return;
    }
    setSaving(true);

    // Safe brand ID parser matching App DB
    const parsedBrandId = brandId ? (isNaN(Number(brandId)) ? brandId : Number(brandId)) : null;

    const payload = {
      name: toTitleCase(name.trim()),
      model_number: modelNumber.trim() || null,
      brand_id: parsedBrandId,
      unit_type: unitType || null,
      base_price: parseFloat(basePrice) || 0,
      description: description.trim() || null,
      variants: variants.map(v => ({ name: v.name.trim(), price: parseFloat(v.price) || 0 })),
      product_type: 'Image Product' // Match "Image Quote" style
    };

    try {
      let productId = null;

      if (editingProduct) {
        productId = editingProduct.id;
        const { error: prodErr } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productId);
        
        if (prodErr) throw prodErr;

        // Re-create components (delete old, insert new)
        const { error: delErr } = await supabase
          .from('manufacturing_product_components')
          .delete()
          .eq('product_id', productId);

        if (delErr) throw delErr;

        addToast('Product details updated', 'success');
      } else {
        // Create product
        const { data: newProd, error: prodErr } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single();

        if (prodErr) throw prodErr;
        productId = newProd.id;
        addToast('Product added to catalog', 'success');
      }

      // Save recipe components
      if (selectedComponents.length > 0) {
        const insertData = selectedComponents.map(sc => ({
          product_id: productId,
          component_id: sc.component_id,
          default_qty: Number(sc.default_qty) || 1
        }));
        const { error: insErr } = await supabase
          .from('manufacturing_product_components')
          .insert(insertData);
        if (insErr) throw insErr;
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
    if (!window.confirm(`Delete product "${prod.name}" from database?`)) return;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', prod.id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== prod.id));
      addToast('Product deleted from database', 'success');
    } catch (err) {
      addToast('Failed to delete product: ' + err.message, 'error');
    }
  }

  return (
    <div className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-gray-200 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Products Catalog</h2>
            <p className="text-sm text-gray-500">Manage all finished lighting/strip products and link their assembly parts</p>
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

      {/* Product List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No products defined yet</p>
          <p className="text-sm">Click "+ New Product" to add a finished product to the database.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map(prod => (
            <div key={prod.id} className="bg-gray-50 rounded-xl border border-gray-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-gray-950 text-base">{prod.name}</h3>
                    <span className="text-[11px] text-gray-700 font-semibold bg-gray-200 px-2 py-0.5 rounded">
                      Model: {prod.model_number || 'N/A'}
                    </span>
                    <span className="text-[11px] text-gray-700 font-semibold bg-gray-200 px-2 py-0.5 rounded ml-1.5">
                      Price: ₹{prod.base_price}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-none">
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
                
                {prod.variants && prod.variants.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Variations:</p>
                    <div className="flex flex-wrap gap-1">
                      {prod.variants.map((v, i) => (
                        <span key={i} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 rounded px-1.5 py-0.5 font-medium">
                          {v.name}: ₹{v.price}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Linked Raw Components:</p>
                <div className="space-y-1.5">
                  {!prod.manufacturing_product_components || prod.manufacturing_product_components.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No assembly parts linked. Edit this product to assign components.</p>
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
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'New Product Details'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1 -mr-1">
              {/* Product Basic Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-650 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. 12W LED Downlight"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-650 block mb-1">Model Number</label>
                  <input
                    type="text"
                    placeholder="e.g. ML-DL-12W"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={modelNumber}
                    onChange={e => setModelNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-650 block mb-1">Brand</label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={brandId}
                    onChange={e => setBrandId(e.target.value)}
                  >
                    <option value="">Select Brand</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-650 block mb-1">Unit Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={unitType}
                    onChange={e => setUnitType(e.target.value)}
                  >
                    <option value="">Select Unit Type</option>
                    {unitTypes.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-650 block mb-1">Base Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 299.00"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value)}
                />
              </div>

              {/* Product Variations */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block">Product Variations</label>
                    <p className="text-[10px] text-gray-500">Different wattages, sizes, or custom pricing overrides</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg shadow-xs hover:bg-gray-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Variation
                  </button>
                </div>

                {variants.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">No variations added. Using Base Price.</p>
                ) : (
                  <div className="space-y-2">
                    {variants.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Name (e.g. 7W)"
                          value={v.name}
                          onChange={e => handleVariantChange(idx, 'name', e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="w-28 relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-gray-500 font-medium">₹</span>
                          <input
                            type="number"
                            placeholder="Price"
                            value={v.price}
                            onChange={e => handleVariantChange(idx, 'price', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg pl-6 pr-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-650 block mb-1">Description (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Provide any additional specifications..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              {/* Linking to raw components (Recipe) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-655 block">Linking to Raw Components (Recipe)</label>
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
                    No components linked to this product recipe yet. Click "+ Add Component" above.
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
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
