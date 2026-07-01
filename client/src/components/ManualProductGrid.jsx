import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { X } from 'lucide-react';

export default function ManualProductGrid() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

  // New Row State
  const [newRow, setNewRow] = useState({ name: '', category: '', price: '' });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('product_type', 'Manual Product').order('created_at', { ascending: true }),
      supabase.from('categories').select('*')
    ]);
    
    if (!prodRes.error && prodRes.data) setProducts(prodRes.data);
    if (!catRes.error && catRes.data) setCategories(catRes.data);
    setLoading(false);
  }

  const manualCategories = categories
    .filter(c => c.name.startsWith('[M] '))
    .map(c => ({ id: c.id, name: c.name.replace('[M] ', '') }));

  const resolveCategoryId = async (categoryName) => {
    if (!categoryName || categoryName.trim() === '') return null;
    const cleanName = categoryName.trim();
    const existing = manualCategories.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing.id;

    const dbName = `[M] ${cleanName}`;
    const { data, error } = await supabase.from('categories').insert([{ name: dbName }]).select();
    if (error || !data || data.length === 0) return null;
    
    setCategories([...categories, data[0]]);
    return data[0].id;
  };

  const handleUpdateExisting = async (id, field, value) => {
    let payload = { [field]: value };
    let optimisticProducts = [...products];
    const index = optimisticProducts.findIndex(p => p.id === id);
    if (index === -1) return;

    if (field === 'category_name') {
       const catId = await resolveCategoryId(value);
       payload = { category_id: catId };
       optimisticProducts[index] = { ...optimisticProducts[index], category_id: catId, categories: { name: value ? `[M] ${value}` : null } };
    } else {
       if (field === 'base_price') payload[field] = parseFloat(value) || 0;
       optimisticProducts[index] = { ...optimisticProducts[index], [field]: value };
    }

    setProducts(optimisticProducts);
    await supabase.from('products').update(payload).eq('id', id);
  };

  const handleNewRowBlur = async () => {
    // Only save if at least name is provided
    if (!newRow.name.trim()) return;

    // Optimistically add to UI
    const tempId = Date.now();
    const catId = await resolveCategoryId(newRow.category);
    
    const newProduct = {
      id: tempId,
      name: newRow.name.trim(),
      category_id: catId,
      categories: { name: newRow.category ? `[M] ${newRow.category}` : null },
      base_price: parseFloat(newRow.price) || 0,
      product_type: 'Manual Product'
    };

    setProducts([...products, newProduct]);
    setNewRow({ name: '', category: '', price: '' }); // instantly clear so they can keep typing

    const { data, error } = await supabase.from('products').insert([{
      name: newProduct.name,
      category_id: newProduct.category_id,
      base_price: newProduct.base_price,
      product_type: 'Manual Product'
    }]).select();

    if (error) {
      addToast("Failed to add product", "error");
      setProducts(products.filter(p => p.id !== tempId)); // rollback
    } else if (data && data.length > 0) {
      // Replace temp ID with real ID silently
      setProducts(prev => prev.map(p => p.id === tempId ? { ...p, id: data[0].id } : p));
    }
  };

  const handleKeyDown = (e, isNewRow, id = null) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Triggers the onBlur save automatically
    }
  };

  const handleDelete = async (id) => {
    setProducts(products.filter(p => p.id !== id));
    await supabase.from('products').delete().eq('id', id);
  };

  return (
    <div className="bg-white p-2 md:p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-bold mb-4 px-2">Manual Products Data</h2>
      
      {/* Hidden datalist for category autocomplete without forcing a dropdown */}
      <datalist id="manual-categories">
        {manualCategories.map(c => <option key={c.id} value={c.name} />)}
      </datalist>

      {loading ? (
        <div className="text-gray-500 px-2">Loading products...</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="p-3 font-semibold border-r border-gray-200 w-[40%]">Product Name</th>
                <th className="p-3 font-semibold border-r border-gray-200 w-[30%]">Category</th>
                <th className="p-3 font-semibold border-r border-gray-200 w-[20%]">Price (₹)</th>
                <th className="p-3 font-semibold w-[10%] text-center"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod) => {
                const displayCategory = prod.categories?.name ? prod.categories.name.replace('[M] ', '') : '';
                return (
                  <tr key={prod.id} className="border-b border-gray-100 hover:bg-blue-50/30 group transition-colors">
                    <td className="p-0 border-r border-gray-100 relative">
                      <input 
                        type="text" 
                        className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500"
                        value={prod.name}
                        onChange={(e) => setProducts(products.map(p => p.id === prod.id ? { ...p, name: e.target.value } : p))}
                        onBlur={(e) => handleUpdateExisting(prod.id, 'name', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, false, prod.id)}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100 relative">
                      <input 
                        type="text" 
                        list="manual-categories"
                        placeholder="Optional"
                        className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 placeholder-gray-300"
                        defaultValue={displayCategory}
                        onBlur={(e) => handleUpdateExisting(prod.id, 'category_name', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, false, prod.id)}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100 relative">
                      <input 
                        type="number" 
                        className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={prod.base_price}
                        onChange={(e) => setProducts(products.map(p => p.id === prod.id ? { ...p, base_price: e.target.value } : p))}
                        onBlur={(e) => handleUpdateExisting(prod.id, 'base_price', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, false, prod.id)}
                      />
                    </td>
                    <td className="p-0 text-center align-middle">
                      <button 
                        onClick={() => handleDelete(prod.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all mx-auto"
                        title="Delete Row"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {/* The Always-Empty Bottom Row */}
              <tr className="bg-green-50/20">
                <td className="p-0 border-r border-gray-100 relative">
                  <input 
                    type="text" 
                    placeholder="Type to add..."
                    className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-green-500 placeholder-gray-400"
                    value={newRow.name}
                    onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                    onBlur={handleNewRowBlur}
                    onKeyDown={(e) => handleKeyDown(e, true)}
                  />
                </td>
                <td className="p-0 border-r border-gray-100 relative">
                  <input 
                    type="text" 
                    list="manual-categories"
                    placeholder="Optional category..."
                    className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-green-500 placeholder-gray-300"
                    value={newRow.category}
                    onChange={(e) => setNewRow({ ...newRow, category: e.target.value })}
                    onBlur={handleNewRowBlur}
                    onKeyDown={(e) => handleKeyDown(e, true)}
                  />
                </td>
                <td className="p-0 border-r border-gray-100 relative">
                  <input 
                    type="number" 
                    placeholder="Price..."
                    className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-green-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-gray-300"
                    value={newRow.price}
                    onChange={(e) => setNewRow({ ...newRow, price: e.target.value })}
                    onBlur={handleNewRowBlur}
                    onKeyDown={(e) => handleKeyDown(e, true)}
                  />
                </td>
                <td className="p-0 text-center">
                  {/* Empty cell for action column */}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
