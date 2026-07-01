import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Plus, Save, Trash2, Tag, Palette, Bookmark, Pencil, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function SwitchProductManagement() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

  const [editingBrand, setEditingBrand] = useState({ id: null, name: '' });
  const [newBrand, setNewBrand] = useState('');
  
  const [deleteBrandConfirm, setDeleteBrandConfirm] = useState({ isOpen: false, id: null });
  const [deleteProductConfirm, setDeleteProductConfirm] = useState({ isOpen: false, id: null });

  const [formData, setFormData] = useState({
    name: '',
    brand_id: '',
    sub_brand: '',
    color: '',
    base_price: ''
  });

  const [nameSearch, setNameSearch] = useState('');
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  async function fetchMetadata() {
    setLoading(true);
    const { data: brandData } = await supabase.from('brands').select('*').order('name');
    if (brandData) setBrands(brandData);

    const { data: productData } = await supabase
      .from('products')
      .select('*, brands(name)')
      .eq('product_type', 'Manual Product')
      .order('name');
    
    if (productData) setProducts(productData);
    setLoading(false);
  }

  const uniqueProductNames = useMemo(() => {
    const names = new Set(products.map(p => p.name));
    return Array.from(names).sort();
  }, [products]);

  const filteredNames = uniqueProductNames.filter(name => 
    name.toLowerCase().includes(nameSearch.toLowerCase())
  );

  async function handleAddProduct(e) {
    e.preventDefault();
    if (!formData.name || !formData.brand_id || !formData.base_price) {
      addToast('Please fill required fields (Name, Brand, Price)', 'error');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      brand_id: parseInt(formData.brand_id),
      sub_brand: formData.sub_brand.trim() || null,
      color: formData.color.trim() || null,
      base_price: parseFloat(formData.base_price),
      product_type: 'Manual Product'
    };

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select('*, brands(name)')
      .single();

    if (error) {
      addToast('Error adding product', 'error');
    } else {
      setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      addToast('Product added successfully', 'success');
      setFormData(prev => ({
        ...prev,
        color: '',
        base_price: ''
      }));
    }
  }

  const handleAddBrand = async () => {
    if (!newBrand.trim()) return;
    const { data, error } = await supabase.from('brands').insert([{ name: newBrand.trim() }]).select();
    if (!error && data) { 
      setBrands([...brands, data[0]].sort((a,b)=>a.name.localeCompare(b.name))); 
      setNewBrand(''); 
    }
  };

  const handleDeleteBrand = async (id) => {
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (!error) { 
      setBrands(brands.filter(b => b.id !== id)); 
      fetchMetadata(); 
    }
  };

  const handleUpdateBrand = async (id) => {
    if (!editingBrand.name.trim()) return;
    const { error } = await supabase.from('brands').update({ name: editingBrand.name.trim() }).eq('id', id);
    if (!error) { 
       setBrands(brands.map(b => b.id === id ? { ...b, name: editingBrand.name.trim() } : b).sort((a,b)=>a.name.localeCompare(b.name))); 
       fetchMetadata();
    }
    setEditingBrand({ id: null, name: '' });
  };

  async function handleDelete(id) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      addToast('Error deleting product', 'error');
    } else {
      setProducts(prev => prev.filter(p => p.id !== id));
      addToast('Product deleted', 'success');
    }
  }

  // Group products by name for display
  const groupedProducts = useMemo(() => {
    const groups = {};
    products.forEach(p => {
      if (!groups[p.name]) groups[p.name] = [];
      groups[p.name].push(p);
    });
    return groups;
  }, [products]);

  if (loading) {
    return <div className="p-8 text-center text-gray-700">Loading...</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Brands Management Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Bookmark className="w-5 h-5 text-purple-600"/> Manage Brands</h3>
        <div className="flex gap-2 mb-4">
          <input type="text" className="input-field py-1.5 text-sm flex-1" placeholder="New Brand..." value={newBrand} onChange={e => setNewBrand(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddBrand()} />
          <button onClick={handleAddBrand} className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-purple-700 transition-colors font-medium">Add</button>
        </div>
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
          {brands.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-purple-200 transition-colors group">
              {editingBrand.id === b.id ? (
                <input type="text" autoFocus className="input-field py-1 text-sm bg-white" value={editingBrand.name} onChange={e => setEditingBrand({...editingBrand, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleUpdateBrand(b.id)} onBlur={() => handleUpdateBrand(b.id)} />
              ) : (
                <span className="text-sm text-gray-700 font-medium px-1">{b.name}</span>
              )}
              <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditingBrand({id: b.id, name: b.name})} className="p-1.5 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded"><Pencil className="w-3.5 h-3.5"/></button>
                <button onClick={() => setDeleteBrandConfirm({ isOpen: true, id: b.id })} className="p-1.5 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-purple-600" />
          Add Switch / Accessory Variant
        </h2>
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Product Name with Autocomplete */}
            <div className="relative col-span-1 lg:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Product Name *</label>
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => {
                  setNameSearch(e.target.value);
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  setShowNameDropdown(true);
                }}
                onFocus={() => setShowNameDropdown(true)}
                onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                placeholder="e.g. 1 Way Switch"
                className="input-field"
                required
              />
              {showNameDropdown && filteredNames.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredNames.map(name => (
                    <div
                      key={name}
                      className="px-4 py-2 hover:bg-purple-50 cursor-pointer text-sm"
                      onClick={() => {
                        setNameSearch(name);
                        setFormData(prev => ({ ...prev, name }));
                        setShowNameDropdown(false);
                      }}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Brand *</label>
              <select
                value={formData.brand_id}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_id: e.target.value }))}
                className="input-field"
                required
              >
                <option value="">Select Brand</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sub-brand (Optional)</label>
              <input
                type="text"
                value={formData.sub_brand}
                onChange={(e) => setFormData(prev => ({ ...prev, sub_brand: e.target.value }))}
                placeholder="e.g. Fabio"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Color (Optional)</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                placeholder="e.g. White"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">List Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => setFormData(prev => ({ ...prev, base_price: e.target.value }))}
                placeholder="0.00"
                className="input-field"
                required
              />
            </div>

            <div className="lg:col-span-5 flex justify-end">
              <button type="submit" className="btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Variant
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Product List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-900">Existing Products & Variants</h3>
        </div>
        <div className="p-4">
          {Object.entries(groupedProducts).length === 0 ? (
            <div className="text-center text-gray-700 py-8">No switch products found.</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedProducts).map(([name, variants]) => (
                <div key={name} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-purple-50 px-4 py-2 border-l-4 border-purple-500 font-bold text-purple-900">
                    {name}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Brand</th>
                        <th className="text-left px-4 py-2 font-medium">Sub-brand</th>
                        <th className="text-left px-4 py-2 font-medium">Color</th>
                        <th className="text-right px-4 py-2 font-medium">Price (₹)</th>
                        <th className="text-center px-4 py-2 font-medium w-16">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map(v => (
                        <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-2">{v.brands?.name}</td>
                          <td className="px-4 py-2">{v.sub_brand || '-'}</td>
                          <td className="px-4 py-2">{v.color || '-'}</td>
                          <td className="px-4 py-2 text-right font-medium">
                            {v.base_price.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => setDeleteProductConfirm({ isOpen: true, id: v.id })}
                              className="text-gray-400 hover:text-red-600 transition-colors p-2"
                              title="Delete Variant"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteBrandConfirm.isOpen}
        title="Delete Brand"
        message="Are you sure? This will delete the brand and potentially cause errors for products using it."
        onConfirm={() => {
          handleDeleteBrand(deleteBrandConfirm.id);
          setDeleteBrandConfirm({ isOpen: false, id: null });
        }}
        onCancel={() => setDeleteBrandConfirm({ isOpen: false, id: null })}
        confirmText="Delete Brand"
      />

      <ConfirmModal
        isOpen={deleteProductConfirm.isOpen}
        title="Delete Variant"
        message="Are you sure you want to delete this variant?"
        onConfirm={() => {
          handleDelete(deleteProductConfirm.id);
          setDeleteProductConfirm({ isOpen: false, id: null });
        }}
        onCancel={() => setDeleteProductConfirm({ isOpen: false, id: null })}
        confirmText="Delete Variant"
      />
    </div>
  );
}
