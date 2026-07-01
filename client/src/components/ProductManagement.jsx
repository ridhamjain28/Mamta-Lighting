import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { useQuoteStore } from '../store/useQuoteStore';
import { Plus, Save, Pencil, Trash2, X, Image as ImageIcon, Tag, Bookmark } from 'lucide-react';

export default function ProductManagement() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const systemMode = useQuoteStore(state => state.systemMode);

  const initialForm = {
    name: '',
    model_number: '',
    brand_id: '',
    category_id: '',
    base_price: '',
    description: '',
    variants: [],
    product_type: systemMode === 'Manual Quote' ? 'Manual Product' : 'Image Product'
  };
  const [formData, setFormData] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);

  const [editingCategory, setEditingCategory] = useState({ id: null, name: '' });
  const [editingBrand, setEditingBrand] = useState({ id: null, name: '' });
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchMetadata();
    fetchProducts();
  }, [systemMode]);

  async function fetchMetadata() {
    const { data: catData } = await supabase.from('categories').select('*');
    const { data: brandData } = await supabase.from('brands').select('*');
    if (catData) {
      setCategories(catData.sort((a,b)=>a.name.localeCompare(b.name)));
    }
    if (brandData) setBrands(brandData.sort((a,b)=>a.name.localeCompare(b.name)));
  }

  async function fetchProducts() {
    let query = supabase.from('products').select(`
      *,
      brands ( name ),
      categories ( name )
    `);
    
    if (systemMode === 'Manual Quote') {
      query = query.eq('product_type', 'Manual Product');
    } else {
      query = query.or('product_type.eq.Image Product,product_type.is.null');
    }
    
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setProducts(data);
  }

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleEdit = (prod) => {
    setEditingId(prod.id);
    setFormData({
      name: prod.name || '',
      model_number: prod.model_number || '',
      brand_id: prod.brand_id || '',
      category_id: prod.category_id || '',
      base_price: prod.base_price || '',
      description: prod.description || '',
      variants: prod.variants || [],
      product_type: prod.product_type || (systemMode === 'Manual Quote' ? 'Manual Product' : 'Image Product')
    });
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(initialForm);
    setImageFile(null);
  };

  const handleDelete = async (id) => {
    // Optimistic UI update to fix INP (Interaction to Next Paint) delay
    setProducts(products.filter(p => p.id !== id));
    
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        fetchProducts(); // rollback
        throw error;
      }
    } catch (e) {
      addToast("Error deleting product", "error");
    }
  };

  // Metadata CRUD
  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    const { data, error } = await supabase.from('categories').insert([{ name: newCategory.trim() }]).select();
    if (!error && data) { setCategories([...categories, data[0]].sort((a,b)=>a.name.localeCompare(b.name))); setNewCategory(''); }
  };
  const handleDeleteCategory = async (id) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) { setCategories(categories.filter(c => c.id !== id)); fetchProducts(); }
  };
  const handleUpdateCategory = async (id) => {
    if (!editingCategory.name.trim()) return;
    const { error } = await supabase.from('categories').update({ name: editingCategory.name.trim() }).eq('id', id);
    if (!error) { 
       setCategories(categories.map(c => c.id === id ? { ...c, name: editingCategory.name.trim() } : c).sort((a,b)=>a.name.localeCompare(b.name))); 
       fetchProducts();
    }
    setEditingCategory({ id: null, name: '' });
  };

  const handleAddBrand = async () => {
    if (!newBrand.trim()) return;
    const { data, error } = await supabase.from('brands').insert([{ name: newBrand.trim() }]).select();
    if (!error && data) { setBrands([...brands, data[0]].sort((a,b)=>a.name.localeCompare(b.name))); setNewBrand(''); }
  };
  const handleDeleteBrand = async (id) => {
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (!error) { setBrands(brands.filter(b => b.id !== id)); fetchProducts(); }
  };
  const handleUpdateBrand = async (id) => {
    if (!editingBrand.name.trim()) return;
    const { error } = await supabase.from('brands').update({ name: editingBrand.name.trim() }).eq('id', id);
    if (!error) { 
       setBrands(brands.map(b => b.id === id ? { ...b, name: editingBrand.name.trim() } : b).sort((a,b)=>a.name.localeCompare(b.name))); 
       fetchProducts();
    }
    setEditingBrand({ id: null, name: '' });
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
      } else if (!editingId) {
        primary_image_url = null;
      }

      // 2. Prepare payload
      const payload = {
        name: formData.name,
        model_number: formData.model_number,
        brand_id: formData.brand_id ? parseInt(formData.brand_id) : null,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        base_price: parseFloat(formData.base_price) || 0,
        description: formData.description,
        variants: formData.variants,
        product_type: formData.product_type
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
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-2 rounded-t-xl">
        <button 
          onClick={() => setActiveTab('image')}
          className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'image' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Image Products (Catalog)
        </button>
        <button 
          onClick={() => setActiveTab('manual')}
          className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Manual Products (Spreadsheet)
        </button>
      </div>

      {activeTab === 'manual' ? (
        <ManualProductGrid categories={categories} />
      ) : (
        <>
          {/* Metadata Management Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Categories */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Tag className="w-5 h-5 text-blue-600"/> Manage Categories</h3>
              <div className="flex gap-2 mb-4">
                <input type="text" className="input-field py-1.5 text-sm flex-1" placeholder="New Category..." value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
                <button onClick={handleAddCategory} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium">Add</button>
              </div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors group">
                    {editingCategory.id === c.id ? (
                      <input type="text" autoFocus className="input-field py-1 text-sm bg-white" value={editingCategory.name} onChange={e => setEditingCategory({...editingCategory, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleUpdateCategory(c.id)} onBlur={() => handleUpdateCategory(c.id)} />
                    ) : (
                      <span className="text-sm text-gray-700 font-medium px-1">{c.name}</span>
                    )}
                    <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingCategory({id: c.id, name: c.name})} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDeleteCategory(c.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Brands */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Bookmark className="w-5 h-5 text-blue-600"/> Manage Brands</h3>
              <div className="flex gap-2 mb-4">
                <input type="text" className="input-field py-1.5 text-sm flex-1" placeholder="New Brand..." value={newBrand} onChange={e => setNewBrand(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddBrand()} />
                <button onClick={handleAddBrand} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium">Add</button>
              </div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {brands.map(b => (
                  <div key={b.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors group">
                    {editingBrand.id === b.id ? (
                      <input type="text" autoFocus className="input-field py-1 text-sm bg-white" value={editingBrand.name} onChange={e => setEditingBrand({...editingBrand, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleUpdateBrand(b.id)} onBlur={() => handleUpdateBrand(b.id)} />
                    ) : (
                      <span className="text-sm text-gray-700 font-medium px-1">{b.name}</span>
                    )}
                    <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingBrand({id: b.id, name: b.name})} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDeleteBrand(b.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
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
                <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium">
                  <X className="w-4 h-4" /> Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Number</label>
                  <input type="text" className="input-field" value={formData.model_number} onChange={e => setFormData({...formData, model_number: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select className="input-field" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <select className="input-field" value={formData.brand_id} onChange={e => setFormData({...formData, brand_id: e.target.value})}>
                    <option value="">Select Brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₹) *</label>
                  <input required type="number" step="0.01" className="input-field" value={formData.base_price} onChange={e => setFormData({...formData, base_price: e.target.value})} />
                </div>
                {systemMode !== 'Manual Quote' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingId ? 'Update Image (Optional)' : 'Product Image *'}
                    </label>
                    <input required={!editingId} type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                  </div>
                )}
                
                {/* Product Variations */}
                <div className="md:col-span-2 mt-4 p-5 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-800">Product Variations</h3>
                      <p className="text-xs text-gray-500">Add variations like wattages (7W, 12W) and their custom prices.</p>
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
                            <span className="absolute left-3 top-2.5 text-gray-500 font-medium">₹</span>
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
                    <div className="text-sm text-gray-500 italic text-center py-4 bg-white rounded border border-dashed border-gray-300">
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
                  <tr className="bg-gray-50 border-y border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                    {systemMode !== 'Manual Quote' && <th className="py-3 px-4 font-medium w-16">Image</th>}
                    <th className="py-3 px-4 font-medium">Product Details</th>
                    <th className="py-3 px-4 font-medium">Category / Brand</th>
                    <th className="py-3 px-4 font-medium">Base Price</th>
                    <th className="py-3 px-4 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={systemMode !== 'Manual Quote' ? "5" : "4"} className="py-8 text-center text-gray-500">No products found. Add one above!</td>
                    </tr>
                  ) : (
                    products.map(product => (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        {systemMode !== 'Manual Quote' && (
                          <td className="py-3 px-4 text-center">
                            {product.primary_image_url ? (
                              <img src={product.primary_image_url} alt={product.name} className="w-12 h-12 object-contain rounded bg-white border border-gray-200" />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-500">Model: {product.model_number || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-700">{product.categories?.name || '-'}</div>
                          <div className="text-xs text-gray-500">{product.brands?.name || '-'}</div>
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
      )}
    </div>
  );
}
