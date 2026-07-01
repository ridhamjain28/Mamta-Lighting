import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Plus, Save, Trash2, Tag, Palette } from 'lucide-react';

export default function SwitchProductManagement() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

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

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this variant?')) return;
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
    <div className="space-y-6">
      {/* Add Product Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
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
                              onClick={() => handleDelete(v.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
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
    </div>
  );
}
