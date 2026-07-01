import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Trash2, Plus } from 'lucide-react';

export default function ManualProductGrid({ categories }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('product_type', 'Manual Product')
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  }

  const handleUpdate = async (id, field, value) => {
    // Optimistic update
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
    
    let payload = { [field]: value };
    if (field === 'base_price') {
      payload[field] = parseFloat(value) || 0;
    }

    const { error } = await supabase.from('products').update(payload).eq('id', id);
    if (error) {
      addToast("Failed to update product", "error");
      fetchProducts(); // rollback
    }
  };

  const handleDelete = async (id) => {
    // Optimistic delete
    setProducts(products.filter(p => p.id !== id));
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      addToast("Failed to delete product", "error");
      fetchProducts(); // rollback
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-bold mb-4">Manual Products Grid</h2>
      <p className="text-sm text-gray-500 mb-4">Edit values directly in the grid. Changes save automatically.</p>
      
      {loading ? (
        <div className="text-gray-500">Loading products...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3 rounded-tl-lg font-semibold w-1/3">Product Name</th>
                <th className="p-3 font-semibold w-1/4">Category</th>
                <th className="p-3 font-semibold w-1/4">List Price (₹)</th>
                <th className="p-3 rounded-tr-lg font-semibold w-12 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod) => (
                <tr key={prod.id} className="border-b border-gray-100 hover:bg-gray-50 group transition-colors">
                  <td className="p-1">
                    <input 
                      type="text" 
                      className="w-full p-2 bg-transparent border border-transparent focus:border-blue-400 focus:bg-white rounded outline-none"
                      value={prod.name}
                      onChange={(e) => setProducts(products.map(p => p.id === prod.id ? { ...p, name: e.target.value } : p))}
                      onBlur={(e) => handleUpdate(prod.id, 'name', e.target.value)}
                    />
                  </td>
                  <td className="p-1">
                    <select
                      className="w-full p-2 bg-transparent border border-transparent focus:border-blue-400 focus:bg-white rounded outline-none cursor-pointer"
                      value={prod.category_id || ''}
                      onChange={(e) => handleUpdate(prod.id, 'category_id', e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">Select Category...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input 
                      type="number" 
                      className="w-full p-2 bg-transparent border border-transparent focus:border-blue-400 focus:bg-white rounded outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={prod.base_price}
                      onChange={(e) => setProducts(products.map(p => p.id === prod.id ? { ...p, base_price: e.target.value } : p))}
                      onBlur={(e) => handleUpdate(prod.id, 'base_price', e.target.value)}
                    />
                  </td>
                  <td className="p-1 text-center">
                    <button 
                      onClick={() => handleDelete(prod.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <NewProductRow categories={categories} onAdd={fetchProducts} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewProductRow({ categories, onAdd }) {
  const { addToast } = useToastStore();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !categoryId || !price) return;
    setSaving(true);
    
    const { error } = await supabase.from('products').insert([{
      name: name.trim(),
      category_id: parseInt(categoryId),
      base_price: parseFloat(price) || 0,
      product_type: 'Manual Product'
    }]);

    if (!error) {
      setName('');
      setPrice('');
      onAdd();
    } else {
      addToast("Failed to add product", "error");
    }
    setSaving(false);
  };

  return (
    <tr className="bg-blue-50/30">
      <td className="p-1">
        <input 
          type="text" 
          placeholder="New Product Name..."
          className="w-full p-2 bg-white border border-blue-200 focus:border-blue-500 rounded outline-none placeholder:text-blue-300"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          disabled={saving}
        />
      </td>
      <td className="p-1">
        <select
          className="w-full p-2 bg-white border border-blue-200 focus:border-blue-500 rounded outline-none text-gray-700"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          onBlur={handleSave}
          disabled={saving}
        >
          <option value="">Select Category...</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="p-1">
        <input 
          type="number" 
          placeholder="Price..."
          className="w-full p-2 bg-white border border-blue-200 focus:border-blue-500 rounded outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-blue-300"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          disabled={saving}
        />
      </td>
      <td className="p-1 text-center text-blue-400">
        <Plus className="w-4 h-4 mx-auto" />
      </td>
    </tr>
  );
}
