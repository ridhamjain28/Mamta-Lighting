import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Save, Pencil, Trash2, X, Image as ImageIcon } from 'lucide-react';

export default function ProductManagement() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const initialForm = {
    name: '',
    model_number: '',
    brand_id: '',
    category_id: '',
    base_price: '',
    description: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    fetchMetadata();
    fetchProducts();
  }, []);

  async function fetchMetadata() {
    const { data: catData } = await supabase.from('categories').select('*');
    const { data: brandData } = await supabase.from('brands').select('*');
    if (catData) setCategories(catData);
    if (brandData) setBrands(brandData);
  }

  async function fetchProducts() {
    const { data } = await supabase.from('products').select(`
      *,
      brands ( name ),
      categories ( name )
    `).order('created_at', { ascending: false });
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
      description: prod.description || ''
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
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (e) {
      alert("Error deleting product: " + e.message);
    }
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
        description: formData.description
      };

      if (primary_image_url !== undefined) {
        payload.primary_image_url = primary_image_url;
      }

      // 3. Save to DB
      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
        alert("Product updated successfully!");
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        alert("Product added successfully!");
      }

      cancelEdit();
      fetchProducts();
    } catch (error) {
      console.error(error);
      alert("Error saving product: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editingId ? 'Update Image (Optional)' : 'Product Image'}
              </label>
              <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
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
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Manage Products</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4 font-medium w-16">Image</th>
                <th className="py-3 px-4 font-medium">Product Details</th>
                <th className="py-3 px-4 font-medium">Category / Brand</th>
                <th className="py-3 px-4 font-medium">Base Price</th>
                <th className="py-3 px-4 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-500">No products found. Add one above!</td>
                </tr>
              ) : (
                products.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-center">
                      {product.primary_image_url ? (
                        <img src={product.primary_image_url} alt={product.name} className="w-12 h-12 object-contain rounded bg-white border border-gray-200" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                    </td>
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
    </div>
  );
}
