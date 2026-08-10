import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { useQuoteStore } from '../store/useQuoteStore';
import { Plus, Save, Pencil, Trash2, X, Image as ImageIcon, Tag, Bookmark, UploadCloud, ImagePlus, Clipboard } from 'lucide-react';
import { toTitleCase } from '../utils/textFormatters';

export default function ProductManagement() {
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const systemMode = useQuoteStore(state => state.systemMode);

  const initialForm = {
    name: '',
    model_number: '',
    brand_id: '',
    base_price: '',
    description: '',
    variants: [],
    product_type: systemMode === 'Manual Quote' ? 'Manual Product' : 'Image Product',
    unit_type: '',
    primary_image_url: null
  };
  const [formData, setFormData] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const fileInputRef = useRef(null);

  const [editingBrand, setEditingBrand] = useState({ id: null, name: '' });
  const [newBrand, setNewBrand] = useState('');
  const [unitTypes, setUnitTypes] = useState([]);
  const [editingUnitType, setEditingUnitType] = useState({ id: null, name: '' });
  const [newUnitType, setNewUnitType] = useState('');
  const { addToast } = useToastStore();

  // Handle global paste event for images when on this tab
  useEffect(() => {
    if (systemMode === 'Manual Quote') return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const ext = blob.type.split('/')[1] || 'png';
            const pastedFile = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type });
            
            setImageFile(pastedFile);
            setRemoveExistingImage(false);
            addToast("Image pasted from clipboard!", "success");
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [systemMode, addToast]);

  useEffect(() => {
    fetchMetadata();
    fetchProducts();
  }, [systemMode]);

  async function fetchMetadata() {
    const { data: brandData } = await supabase.from('brands').select('*');
    if (brandData) setBrands(brandData.sort((a,b)=>a.name.localeCompare(b.name)));

    const { data: unitTypeData } = await supabase.from('unit_types').select('*');
    if (unitTypeData) setUnitTypes(unitTypeData.sort((a,b)=>a.name.localeCompare(b.name)));
  }

  async function fetchProducts() {
    let query = supabase.from('products').select(`
      *,
      brands ( name )
    `).or('product_type.eq.Image Product,product_type.is.null')
      .eq('show_in_image_quote', true);
    
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setProducts(data);
  }

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setRemoveExistingImage(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('image/')) {
        setImageFile(droppedFile);
        setRemoveExistingImage(false);
        addToast("Image dropped!", "success");
      } else {
        addToast("Please drop a valid image file", "error");
      }
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setRemoveExistingImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const previewUrl = useMemo(() => {
    if (imageFile) {
      return URL.createObjectURL(imageFile);
    }
    if (formData.primary_image_url && !removeExistingImage) {
      return formData.primary_image_url;
    }
    return null;
  }, [imageFile, formData.primary_image_url, removeExistingImage]);

  const handleEdit = (prod) => {
    setEditingId(prod.id);
    setFormData({
      name: prod.name || '',
      model_number: prod.model_number || '',
      brand_id: prod.brand_id || '',
      base_price: prod.base_price || '',
      description: prod.description || '',
      variants: prod.variants || [],
      product_type: prod.product_type || (systemMode === 'Manual Quote' ? 'Manual Product' : 'Image Product'),
      unit_type: prod.unit_type || '',
      primary_image_url: prod.primary_image_url || null
    });
    setImageFile(null);
    setRemoveExistingImage(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(initialForm);
    setImageFile(null);
    setRemoveExistingImage(false);
  };

  const handleDelete = async (id) => {
    const originalProducts = [...products];
    setProducts(products.filter(p => p.id !== id));
    
    try {
      const { data: checkProd } = await supabase.from('products').select('show_in_manufacturing').eq('id', id).single();
      if (checkProd && checkProd.show_in_manufacturing) {
        // If active in manufacturing portal, only toggle show_in_image_quote off
        const { error } = await supabase.from('products').update({ show_in_image_quote: false }).eq('id', id);
        if (error) throw error;
      } else {
        // Otherwise, perform permanent delete
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
      }
    } catch (e) {
      setProducts(originalProducts); // rollback
      addToast("Error deleting product", "error");
    }
  };

  // Metadata CRUD
  const handleAddBrand = async () => {
    if (!newBrand.trim()) return;
    const { data, error } = await supabase.from('brands').insert([{ name: toTitleCase(newBrand.trim()) }]).select();
    if (!error && data) { setBrands([...brands, data[0]].sort((a,b)=>a.name.localeCompare(b.name))); setNewBrand(''); }
  };
  const handleDeleteBrand = async (id) => {
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (!error) { setBrands(brands.filter(b => b.id !== id)); fetchProducts(); }
  };
  const handleUpdateBrand = async (id) => {
    if (!editingBrand.name.trim()) return;
    const { error } = await supabase.from('brands').update({ name: toTitleCase(editingBrand.name.trim()) }).eq('id', id);
    if (!error) { 
       setBrands(brands.map(b => b.id === id ? { ...b, name: toTitleCase(editingBrand.name.trim()) } : b).sort((a,b)=>a.name.localeCompare(b.name))); 
       fetchProducts();
    }
    setEditingBrand({ id: null, name: '' });
  };

  const handleAddUnitType = async () => {
    if (!newUnitType.trim()) return;
    const { data, error } = await supabase.from('unit_types').insert([{ name: newUnitType.trim() }]).select();
    if (error) {
       addToast("Error adding unit type: " + error.message, "error");
       console.error("Add unit type error:", error);
    }
    if (!error && data) { 
       setUnitTypes([...unitTypes, data[0]].sort((a,b)=>a.name.localeCompare(b.name))); 
       setNewUnitType(''); 
       addToast("Unit type added successfully", "success");
    }
  };
  const handleDeleteUnitType = async (id) => {
    const { error } = await supabase.from('unit_types').delete().eq('id', id);
    if (error) {
       addToast("Error deleting unit type: " + error.message, "error");
    } else {
       setUnitTypes(unitTypes.filter(u => u.id !== id)); 
       fetchProducts(); 
       addToast("Unit type deleted", "success");
    }
  };
  const handleUpdateUnitType = async (id) => {
    if (!editingUnitType.name.trim()) return;
    const { error } = await supabase.from('unit_types').update({ name: editingUnitType.name.trim() }).eq('id', id);
    if (error) {
       addToast("Error updating unit type: " + error.message, "error");
    } else { 
       setUnitTypes(unitTypes.map(u => u.id === id ? { ...u, name: editingUnitType.name.trim() } : u).sort((a,b)=>a.name.localeCompare(b.name))); 
       fetchProducts();
       addToast("Unit type updated", "success");
    }
    setEditingUnitType({ id: null, name: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let primary_image_url = undefined;

      // 1. Upload image if a new one is selected
      if (imageFile) {
        const formDataPayload = new FormData();
        formDataPayload.append('image', imageFile);

        const res = await fetch(import.meta.env.VITE_API_URL + '/api/upload-image', {
          method: 'POST',
          body: formDataPayload
        });
        const uploadData = await res.json();
        if (!res.ok) throw new Error(uploadData.error || 'Failed to upload image');
        primary_image_url = uploadData.url;
      } else if (removeExistingImage) {
        primary_image_url = null;
      } else if (!editingId) {
        primary_image_url = null;
      }

      // 2. Prepare payload
      const payload = {
        name: toTitleCase(formData.name),
        model_number: formData.model_number,
        brand_id: (formData.brand_id && !isNaN(parseInt(formData.brand_id))) ? parseInt(formData.brand_id) : null,
        base_price: parseFloat(formData.base_price) || 0,
        description: formData.description,
        variants: formData.variants,
        product_type: formData.product_type,
        unit_type: formData.unit_type || null
      };

      if (primary_image_url !== undefined) {
        payload.primary_image_url = primary_image_url;
      }

      // 3. Save to DB
      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
        addToast("Product updated successfully!", "success");
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        addToast("Product added successfully!", "success");
      }

      cancelEdit();
      fetchProducts();
    } catch (error) {
      console.error(error);
      addToast("Error saving product: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const displayProducts = products;

  return (
    <div className="space-y-6 pb-12">
      <>
          {/* Metadata Management Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Brands */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Bookmark className="w-5 h-5 text-blue-600"/> Manage Brands</h3>
              <div className="flex gap-2 mb-4">
                <input spellCheck={true} type="text" className="input-field py-1.5 text-sm flex-1" placeholder="New Brand..." value={newBrand} onChange={e => setNewBrand(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddBrand()} />
                <button onClick={handleAddBrand} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium">Add</button>
              </div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {brands.map(b => (
                  <div key={b.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors group">
                    {editingBrand.id === b.id ? (
                      <input spellCheck={true} type="text" autoFocus className="input-field py-1 text-sm bg-white" value={editingBrand.name} onChange={e => setEditingBrand({...editingBrand, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleUpdateBrand(b.id)} onBlur={() => handleUpdateBrand(b.id)} />
                    ) : (
                      <span className="text-sm text-gray-700 font-medium px-1">{b.name}</span>
                    )}
                    <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingBrand({id: b.id, name: b.name})} className="p-1.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDeleteBrand(b.id)} className="p-1.5 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Unit Types */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Tag className="w-5 h-5 text-blue-600"/> Manage Unit Types</h3>
              <div className="flex gap-2 mb-4">
                <input type="text" className="input-field py-1.5 text-sm flex-1" placeholder="New Unit Type..." value={newUnitType} onChange={e => setNewUnitType(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddUnitType()} />
                <button onClick={handleAddUnitType} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium">Add</button>
              </div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {unitTypes.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors group">
                    {editingUnitType.id === u.id ? (
                      <input type="text" autoFocus className="input-field py-1 text-sm bg-white" value={editingUnitType.name} onChange={e => setEditingUnitType({...editingUnitType, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleUpdateUnitType(u.id)} onBlur={() => handleUpdateUnitType(u.id)} />
                    ) : (
                      <span className="text-sm text-gray-700 font-medium px-1">{u.name}</span>
                    )}
                    <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingUnitType({id: u.id, name: u.name})} className="p-1.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDeleteUnitType(u.id)} className="p-1.5 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <div className="flex items-center gap-3">
                {editingId ? <Pencil className="text-blue-600" /> : <Plus className="text-blue-600" />}
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Edit Product' : 'Add New Product'}
                </h2>
              </div>
              {editingId && (
                <button onClick={cancelEdit} className="text-gray-700 hover:text-gray-700 flex items-center gap-1 text-sm font-medium">
                  <X className="w-4 h-4" /> Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input spellCheck={true} required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} onBlur={e => setFormData({...formData, name: toTitleCase(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Number</label>
                  <input type="text" className="input-field" value={formData.model_number} onChange={e => setFormData({...formData, model_number: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <select className="input-field" value={formData.brand_id} onChange={e => setFormData({...formData, brand_id: e.target.value})}>
                    <option value="">Select Brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type *</label>
                  <select required className="input-field" value={formData.unit_type} onChange={e => setFormData({...formData, unit_type: e.target.value})}>
                    <option value="" disabled>Select Unit Type</option>
                    {unitTypes.length === 0 ? (
                       <>
                         <option value="N">N</option>
                         <option value="per metre">per metre</option>
                         <option value="per kg">per kg</option>
                       </>
                    ) : (
                       unitTypes.map(u => <option key={u.id} value={u.name}>{u.name}</option>)
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₹) *</label>
                  <input required type="number" step="0.01" className="input-field" value={formData.base_price} onChange={e => setFormData({...formData, base_price: e.target.value})} />
                </div>
                {systemMode !== 'Manual Quote' && (
                  <div className="col-span-1 md:col-span-2 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingId ? 'Product Image (Optional)' : 'Product Image (Optional)'}
                    </label>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      accept="image/*" 
                      onChange={handleImageChange} 
                      className="hidden" 
                    />

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[140px] ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50/80 scale-[1.01] shadow-md'
                          : previewUrl
                          ? 'border-blue-200 bg-blue-50/30 hover:border-blue-400'
                          : 'border-gray-300 bg-gray-50 hover:bg-gray-100/80 hover:border-blue-400'
                      }`}
                    >
                      {previewUrl ? (
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-between px-2">
                          <div className="flex items-center gap-4">
                            <img 
                              src={previewUrl} 
                              alt="Product Preview" 
                              className="w-20 h-20 object-contain rounded-lg bg-white border border-gray-200 shadow-sm p-1"
                            />
                            <div className="text-left">
                              <p className="text-sm font-semibold text-gray-900">
                                {imageFile ? imageFile.name : 'Current Image'}
                              </p>
                              <p className="text-xs text-gray-700 mt-0.5">
                                {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : 'Uploaded to product'}
                              </p>
                              <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-100 font-medium px-2 py-0.5 rounded mt-1.5">
                                <ImagePlus className="w-3 h-3" /> Click or drop new image to replace
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current && fileInputRef.current.click()}
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Remove image"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 py-2">
                          <div className="flex items-center justify-center gap-2 text-blue-600">
                            <UploadCloud className="w-8 h-8" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              Drag & drop photo here, or <span className="text-blue-600 font-semibold underline">browse</span>
                            </p>
                            <p className="text-xs text-gray-700 mt-1">Supports PNG, JPG, JPEG, WebP</p>
                          </div>
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full mt-2">
                            <Clipboard className="w-3.5 h-3.5" />
                            Press <kbd className="font-mono bg-purple-100 px-1 rounded text-[11px]">Ctrl+V</kbd> or <kbd className="font-mono bg-purple-100 px-1 rounded text-[11px]">Cmd+V</kbd> anywhere to paste copied image
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Product Variations */}
                <div className="col-span-1 md:col-span-2 mt-4 p-5 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-800">Product Variations</h3>
                      <p className="text-xs text-gray-700">Add variations like wattages (7W, 12W) and their custom prices.</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, variants: [...formData.variants, { name: '', price: '' }]})}
                      className="bg-white border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Variation
                    </button>
                  </div>
                  
                  {formData.variants.length > 0 ? (
                    <div className="space-y-3">
                      {formData.variants.map((variant, index) => (
                        <div key={index} className="flex gap-3 items-start">
                          <div className="flex-1">
                            <input 
                              type="text" 
                              placeholder="Name (e.g. 7W)" 
                              className="input-field py-2"
                              value={variant.name}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[index].name = e.target.value;
                                setFormData({...formData, variants: newVariants});
                              }}
                            />
                          </div>
                          <div className="flex-1 relative">
                            <span className="absolute left-3 top-2.5 text-gray-700 font-medium">₹</span>
                            <input 
                              type="number" 
                              placeholder="Custom Price" 
                              className="input-field py-2 pl-7"
                              value={variant.price}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[index].price = e.target.value;
                                setFormData({...formData, variants: newVariants});
                              }}
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              const newVariants = [...formData.variants];
                              newVariants.splice(index, 1);
                              setFormData({...formData, variants: newVariants});
                            }}
                            className="bg-red-50 text-red-600 p-2.5 rounded-md border border-red-100 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700 italic text-center py-4 bg-white rounded border border-dashed border-gray-300">
                      No variations added. The product will use the Base Price.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows="3" className="input-field" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>

              <button disabled={loading} type="submit" className="btn-primary w-full flex justify-center items-center gap-2">
                {loading ? 'Saving...' : <><Save className="w-4 h-4"/> {editingId ? 'Update Product' : 'Save Product'}</>}
              </button>
            </form>
          </div>

          {/* Product List Section */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">
              {systemMode === 'Manual Quote' ? 'Manual Products' : 'Image Products'}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-y border-gray-200 text-sm text-gray-700 uppercase tracking-wider">
                    {systemMode !== 'Manual Quote' && <th className="py-3 px-4 font-medium w-16">Image</th>}
                    <th className="py-3 px-4 font-medium">Product Details</th>
                    <th className="py-3 px-4 font-medium">Brand</th>
                    <th className="py-3 px-4 font-medium">Base Price</th>
                    <th className="py-3 px-4 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={systemMode !== 'Manual Quote' ? "5" : "4"} className="py-8 text-center text-gray-700">No products found. Add one above!</td>
                    </tr>
                  ) : (
                    products.map(product => (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        {systemMode !== 'Manual Quote' && (
                          <td className="py-3 px-4 text-center">
                            {product.primary_image_url ? (
                              <img src={product.primary_image_url} alt={product.name} className="w-12 h-12 object-contain rounded bg-white border border-gray-200" />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-600">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-700">Model: {product.model_number || 'N/A'} • Unit: {product.unit_type || 'N'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs text-gray-700">{product.brands?.name || '-'}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">
                          ₹{product.base_price.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleEdit(product)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(product.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
    </div>
  );
}
