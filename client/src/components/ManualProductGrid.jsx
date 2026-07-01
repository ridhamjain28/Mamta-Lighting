import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Plus, Save, Trash2, Edit2, X } from 'lucide-react';

export default function ManualProductGrid() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

  const [selectedType, setSelectedType] = useState('Switch'); // 'Switch' or 'Wire'
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  
  // Suggested colors for datalist
  const presetColors = ['White', 'Black', 'Grey', 'Silver', 'Gold', 'Red', 'Blue', 'Yellow', 'Green'];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [prodRes, catRes, brandRes] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('product_type', 'Manual Product').order('created_at', { ascending: true }),
      supabase.from('categories').select('*'),
      supabase.from('brands').select('*').order('name')
    ]);
    
    if (!prodRes.error && prodRes.data) {
      setProducts(prodRes.data);
    }
    if (!catRes.error && catRes.data) {
      setCategories(catRes.data);
    }
    if (!brandRes.error && brandRes.data) {
      setBrands(brandRes.data);
      if (brandRes.data.length > 0) setSelectedBrand(brandRes.data[0].id);
    }
    setLoading(false);
  }

  // Auto-create missing category for [M] Switch or [M] Wire
  const resolveCategoryId = async (typeName) => {
    const dbName = `[M] ${typeName}`;
    const existing = categories.find(c => c.name.toLowerCase() === dbName.toLowerCase());
    if (existing) return existing.id;

    const { data, error } = await supabase.from('categories').insert([{ name: dbName }]).select();
    if (error || !data || data.length === 0) return null;
    
    setCategories(prev => [...prev, data[0]]);
    return data[0].id;
  };

  // Filter products for the current view
  const currentCategoryName = `[M] ${selectedType}`;
  const filteredProducts = products.filter(p => {
    const matchesCategory = p.categories?.name === currentCategoryName;
    const matchesBrand = selectedBrand ? p.brand_id === selectedBrand : true;
    const matchesColor = selectedColor ? (p.description || '').toLowerCase() === selectedColor.toLowerCase() : (!p.description);
    return matchesCategory && matchesBrand && matchesColor;
  });

  const handleUpdateProduct = async (id, field, value) => {
    // Optimistic UI
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value, isDirty: true } : p));
  };

  const handleSaveProduct = async (prod) => {
    const catId = await resolveCategoryId(selectedType);
    const { error } = await supabase.from('products').update({
      name: prod.name,
      base_price: parseFloat(prod.base_price) || 0,
      brand_id: selectedBrand || null,
      description: selectedColor || null,
      category_id: catId
    }).eq('id', prod.id);

    if (error) {
      addToast("Error saving product", "error");
    } else {
      addToast("Saved", "success");
      setProducts(products.map(p => p.id === prod.id ? { ...p, isDirty: false } : p));
    }
  };

  const handleAddProduct = async () => {
    if (!selectedBrand && brands.length > 0) {
      addToast("Please select a brand first", "error");
      return;
    }
    const catId = await resolveCategoryId(selectedType);
    const newProduct = {
      name: `New ${selectedType}`,
      base_price: 0,
      product_type: 'Manual Product',
      category_id: catId,
      brand_id: selectedBrand || null,
      description: selectedColor || null
    };

    const { data, error } = await supabase.from('products').insert([newProduct]).select('*, categories(name)');
    if (!error && data) {
      setProducts([...products, data[0]]);
    } else {
      addToast("Error adding product", "error");
    }
  };

  const handleDeleteProduct = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      setProducts(products.filter(p => p.id !== id));
    } else {
      addToast("Error deleting product", "error");
    }
  };

  return (
    <div className="bg-white p-2 md:p-6 rounded-xl shadow-sm border border-gray-200">
      
      {/* Top Level Wizard Selector */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-bold mb-4">Manual Product Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
            <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden">
              <button 
                onClick={() => setSelectedType('Switch')}
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${selectedType === 'Switch' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Switch
              </button>
              <button 
                onClick={() => setSelectedType('Wire')}
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors border-l border-gray-300 ${selectedType === 'Wire' ? 'bg-blue-600 text-white border-l-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Wire
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <select 
              value={selectedBrand} 
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color (Optional)</label>
            <input 
              type="text" 
              list="colors"
              value={selectedColor} 
              onChange={(e) => setSelectedColor(e.target.value)}
              placeholder="e.g. White"
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
            <datalist id="colors">
              {presetColors.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 py-8 text-center">Loading products...</div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">
              {selectedBrand ? brands.find(b=>b.id===selectedBrand)?.name : ''} {selectedColor} {selectedType}s
            </h3>
            <button 
              onClick={handleAddProduct}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm">
                  <th className="p-3 border-b border-gray-200 font-semibold">Product Name</th>
                  <th className="p-3 border-b border-gray-200 font-semibold w-48">Base Price (₹)</th>
                  <th className="p-3 border-b border-gray-200 font-semibold w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-gray-500 bg-white">
                      No products found for this combination. Click "Add Item" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(prod => (
                    <tr key={prod.id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors group">
                      <td className="p-2">
                        <input 
                          type="text" 
                          value={prod.name} 
                          onChange={(e) => handleUpdateProduct(prod.id, 'name', e.target.value)}
                          onBlur={() => prod.isDirty && handleSaveProduct(prod)}
                          onKeyDown={(e) => e.key === 'Enter' && prod.isDirty && handleSaveProduct(prod)}
                          className="w-full p-2 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md outline-none bg-transparent focus:bg-white transition-all"
                          placeholder="e.g. 1 Way Switch"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          value={prod.base_price} 
                          onChange={(e) => handleUpdateProduct(prod.id, 'base_price', e.target.value)}
                          onBlur={() => prod.isDirty && handleSaveProduct(prod)}
                          onKeyDown={(e) => e.key === 'Enter' && prod.isDirty && handleSaveProduct(prod)}
                          className="w-full p-2 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md outline-none bg-transparent focus:bg-white transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <button 
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
