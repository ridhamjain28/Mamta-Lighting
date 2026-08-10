import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Plus, Pencil, Trash2, Save, X, Loader2, Package, Boxes, Settings, Bookmark, Tag, Search } from 'lucide-react';
import { toTitleCase } from '../utils/textFormatters';
import ComponentSelect from './ComponentSelect';

export default function ManufacturingProducts({ role = 'admin', isGlobal = true }) {
  const isEmployee = role === 'employee';
  const { addToast } = useToastStore();
  const [products, setProducts] = useState([]);
  const [rawComponents, setRawComponents] = useState([]);
  const [brands, setBrands] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Visibility Flags
  const [showInImageQuote, setShowInImageQuote] = useState(true);
  const [showInManufacturing, setShowInManufacturing] = useState(false);

  // Inline raw component modal state
  const [showNewComponentModal, setShowNewComponentModal] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentDesc, setNewComponentDesc] = useState('');
  const [newComponentStock, setNewComponentStock] = useState('');
  const [newComponentUnit, setNewComponentUnit] = useState('pcs');
  const [newComponentCost, setNewComponentCost] = useState('');
  const [activeRecipeRowIndex, setActiveRecipeRowIndex] = useState(null);

  // Undo queue state & ref
  const [undoQueue, setUndoQueue] = useState([]);
  const undoQueueRef = useRef([]);

  // Link products from database states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [dbProducts, setDbProducts] = useState([]);
  const [selectedDbIds, setSelectedDbIds] = useState([]);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [linking, setLinking] = useState(false);

  const handleToggleSelectDbId = (id) => {
    if (selectedDbIds.includes(id)) {
      setSelectedDbIds(selectedDbIds.filter(x => x !== id));
    } else {
      setSelectedDbIds([...selectedDbIds, id]);
    }
  };

  useEffect(() => {
    undoQueueRef.current = undoQueue;
  }, [undoQueue]);

  useEffect(() => {
    fetchProducts();
    fetchRawComponents();
    fetchMetadata();

    return () => {
      // Finalize all deletions on unmount
      undoQueueRef.current.forEach(uq => {
        clearTimeout(uq.timerId);
        finalizeDeletion(uq.item);
      });
    };
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      let query = supabase
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
        .or('product_type.eq.Image Product,product_type.is.null');

      if (!isGlobal) {
        query = query.eq('show_in_manufacturing', true);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

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

  async function fetchDbProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .neq('show_in_manufacturing', true)
        .or('product_type.eq.Image Product,product_type.is.null')
        .order('name', { ascending: true });
      if (error) throw error;
      setDbProducts(data || []);
      setSelectedDbIds([]);
    } catch (err) {
      console.error('Error fetching db products:', err);
    }
  }

  async function handleLinkSelected() {
    if (selectedDbIds.length === 0) return;
    setLinking(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ show_in_manufacturing: true })
        .in('id', selectedDbIds);
      if (error) throw error;
      addToast(`Successfully linked ${selectedDbIds.length} products to Manufacturing`, 'success');
      setShowLinkModal(false);
      fetchProducts();
    } catch (err) {
      addToast('Failed to link products: ' + err.message, 'error');
    } finally {
      setLinking(false);
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
    setShowInImageQuote(true);
    setShowInManufacturing(isGlobal ? false : true);
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
    setShowInImageQuote(prod.show_in_image_quote ?? true);
    setShowInManufacturing(prod.show_in_manufacturing ?? false);
    
    const comps = (prod.manufacturing_product_components || []).map(mpc => ({
      component_id: mpc.component_id,
      default_qty: mpc.default_qty
    }));
    setSelectedComponents(comps);
    setShowModal(true);
  };

  const handleAddComponentLine = () => {
    // Start with blank component line
    setSelectedComponents([...selectedComponents, { component_id: '', default_qty: 1 }]);
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
    if (selectedComponents.some(sc => !sc.component_id)) {
      addToast('Please select a component for all recipe rows', 'error');
      return;
    }

    setSaving(true);

    const parsedBrandId = brandId ? (isNaN(Number(brandId)) ? brandId : Number(brandId)) : null;

    const payload = {
      name: toTitleCase(name.trim()),
      model_number: modelNumber.trim() || null,
      brand_id: parsedBrandId,
      unit_type: unitType || null,
      base_price: parseFloat(basePrice) || 0,
      description: description.trim() || null,
      variants: variants.map(v => ({ name: v.name.trim(), price: parseFloat(v.price) || 0 })),
      product_type: 'Image Product',
      show_in_image_quote: showInImageQuote,
      show_in_manufacturing: showInManufacturing
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

  async function finalizeDeletion(prod) {
    try {
      const { data: checkProd } = await supabase.from('products').select('show_in_image_quote').eq('id', prod.id).single();
      if (checkProd && checkProd.show_in_image_quote && !isGlobal) {
        // If it's active in Image Quote, just set show_in_manufacturing to false (hide it)
        await supabase.from('products').update({ show_in_manufacturing: false }).eq('id', prod.id);
      } else {
        // Delete permanently
        await supabase.from('products').delete().eq('id', prod.id);
      }
    } catch (err) {
      console.error('finalizeDeletion error:', err);
    }
  }

  const handleDeleteTrigger = (prod) => {
    // Immediately remove from list state
    setProducts(prev => prev.filter(p => p.id !== prod.id));

    // Start a 5-second timer to permanently delete
    const timerId = setTimeout(() => {
      finalizeDeletion(prod);
      setUndoQueue(prev => prev.filter(q => q.id !== prod.id));
    }, 5000);

    setUndoQueue(prev => [...prev, {
      id: prod.id,
      item: prod,
      timerId
    }]);
  };

  const handleUndoDelete = (id) => {
    const found = undoQueue.find(q => q.id === id);
    if (!found) return;
    clearTimeout(found.timerId);
    setProducts(prev => [found.item, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    setUndoQueue(prev => prev.filter(q => q.id !== id));
    addToast(`Restored "${found.item.name}"`, 'success');
  };

  async function handleCreateComponentInline() {
    if (!newComponentName.trim()) {
      addToast('Component name is required', 'error');
      return;
    }
    try {
      const payload = {
        name: newComponentName.trim(),
        description: newComponentDesc.trim() || null,
        stock_qty: parseInt(newComponentStock) || 0,
        unit: newComponentUnit || 'pcs',
        cost: parseFloat(newComponentCost) || 0
      };

      const { data, error } = await supabase
        .from('raw_components')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      addToast(`Component "${data.name}" created!`, 'success');
      
      // Update raw components list
      setRawComponents(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));

      // Auto-select in the active row
      if (activeRecipeRowIndex !== null) {
        const updated = [...selectedComponents];
        updated[activeRecipeRowIndex].component_id = data.id;
        setSelectedComponents(updated);
      }

      // Reset inline form
      setShowNewComponentModal(false);
      setNewComponentName('');
      setNewComponentDesc('');
      setNewComponentStock('');
      setNewComponentUnit('pcs');
      setNewComponentCost('');
      setActiveRecipeRowIndex(null);
    } catch (err) {
      addToast('Failed to create component: ' + err.message, 'error');
    }
  }

  // Filter products by search query
  const filteredProducts = products.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.model_number && p.model_number.toLowerCase().includes(query))
    );
  });

  return (
    <div className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-gray-200 max-w-4xl mx-auto relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{isGlobal ? 'Global Products Database' : 'Products Catalog'}</h2>
            <p className="text-sm text-gray-500">Manage all finished lighting/strip products and link their assembly parts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative w-full sm:w-48">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {!isEmployee && !isGlobal && (
            <button
              onClick={() => {
                fetchDbProducts();
                setShowLinkModal(true);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 animate-in fade-in"
            >
              <Plus className="w-4 h-4" />
              Link from Database
            </button>
          )}

          {!isEmployee && (
            <button
              onClick={handleOpenAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          )}
        </div>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No products match your search</p>
          <p className="text-sm">Try using a different term or add a new product.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map(prod => (
            <div key={prod.id} className="bg-gray-50 rounded-xl border border-gray-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-950 text-base truncate">{prod.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-[10px] text-gray-700 font-semibold bg-gray-200 px-2 py-0.5 rounded">
                        Model: {prod.model_number || 'N/A'}
                      </span>
                      <span className="text-[10px] text-gray-700 font-semibold bg-gray-200 px-2 py-0.5 rounded">
                        Price: ₹{prod.base_price}
                      </span>
                    </div>
                  </div>
                  {!isEmployee && (
                    <div className="flex gap-1 flex-none">
                      <button
                        onClick={() => handleOpenEdit(prod)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
                        title="Edit Product"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrigger(prod)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
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

                {/* Database Locations Tagging */}
                <div className="mb-3 border-t border-gray-200 pt-2 flex flex-wrap gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prod.show_in_image_quote ? 'bg-indigo-100 text-indigo-750' : 'bg-gray-100 text-gray-400'}`}>
                    Image Quote
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prod.show_in_manufacturing ? 'bg-cyan-100 text-cyan-750' : 'bg-gray-100 text-gray-400'}`}>
                    Manufacturing Portal
                  </span>
                </div>

                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Linked Raw Components:</p>
                <div className="space-y-1.5">
                  {!prod.manufacturing_product_components || prod.manufacturing_product_components.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No assembly parts linked. Edit this product to assign components.</p>
                  ) : (
                    prod.manufacturing_product_components.map((mpc, idx) => (
                      <div key={mpc.id || idx} className="flex justify-between items-center bg-white border border-gray-150 rounded-lg px-2.5 py-1.5 text-xs text-gray-700">
                        <span className="font-medium truncate mr-2">{mpc.raw_components?.name || 'Unknown Component'}</span>
                        <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-100 shrink-0">
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100 flex-none">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'New Product Details'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1 -mr-1">
              
              {/* Database Visibility Checkboxes */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[10px] text-blue-750 uppercase tracking-wider font-bold mb-2">Show Product In:</p>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={showInImageQuote}
                      onChange={e => setShowInImageQuote(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    Image Quotation System
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={showInManufacturing}
                      onChange={e => setShowInManufacturing(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    Manufacturing Portal
                  </label>
                </div>
              </div>

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
                        <ComponentSelect
                          value={sc.component_id}
                          onChange={val => handleComponentChange(idx, 'component_id', val)}
                          options={rawComponents}
                          onCreateNew={() => {
                            setActiveRecipeRowIndex(idx);
                            setShowNewComponentModal(true);
                          }}
                        />

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

      {/* Inline Create Component Modal */}
      {showNewComponentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-150">
              <h4 className="font-bold text-gray-900 text-base">Create Raw Component</h4>
              <button onClick={() => setShowNewComponentModal(false)} className="text-xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-650 block mb-1">Component Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Led Chip 12W"
                  value={newComponentName}
                  onChange={e => setNewComponentName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-650 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Warm white chip for Sierra downlights"
                  value={newComponentDesc}
                  onChange={e => setNewComponentDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-655 block mb-1">Stock Qty</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newComponentStock}
                    onChange={e => setNewComponentStock(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-655 block mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="pcs"
                    value={newComponentUnit}
                    onChange={e => setNewComponentUnit(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-655 block mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newComponentCost}
                    onChange={e => setNewComponentCost(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setShowNewComponentModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateComponentInline}
                disabled={!newComponentName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 rounded-xl text-xs transition-colors"
              >
                Create & Select
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Link Products from Database Modal */}
    {showLinkModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-150 flex-none">
              <h4 className="font-bold text-gray-900 text-base">Link Products from Database</h4>
              <button onClick={() => setShowLinkModal(false)} className="text-xl text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="relative flex-none mb-3 flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={dbSearchQuery}
                  onChange={e => setDbSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              {dbProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const filtered = dbProducts.filter(p => p.name.toLowerCase().includes(dbSearchQuery.toLowerCase()));
                    const filteredIds = filtered.map(p => p.id);
                    const allSelected = filteredIds.every(id => selectedDbIds.includes(id));
                    if (allSelected) {
                      setSelectedDbIds(prev => prev.filter(id => !filteredIds.includes(id)));
                    } else {
                      setSelectedDbIds(prev => Array.from(new Set([...prev, ...filteredIds])));
                    }
                  }}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap"
                >
                  {dbProducts.filter(p => p.name.toLowerCase().includes(dbSearchQuery.toLowerCase())).map(p => p.id).every(id => selectedDbIds.includes(id)) ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1 min-h-[200px]">
              {dbProducts.length === 0 ? (
                <p className="text-xs text-gray-450 italic text-center py-8">All catalog products are already active in the Manufacturing portal.</p>
              ) : (
                dbProducts
                  .filter(p => p.name.toLowerCase().includes(dbSearchQuery.toLowerCase()))
                  .map(p => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer text-xs font-semibold text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDbIds.includes(p.id)}
                        onChange={() => handleToggleSelectDbId(p.id)}
                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-900">{p.name}</p>
                        {p.model_number && <p className="text-[10px] text-gray-500 truncate">Model: {p.model_number}</p>}
                      </div>
                    </label>
                  ))
              )}
            </div>

            <div className="mt-5 flex gap-2 border-t border-gray-150 pt-3 flex-none">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-705 font-bold py-2.5 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkSelected}
                disabled={linking || selectedDbIds.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Link Selected (${selectedDbIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
