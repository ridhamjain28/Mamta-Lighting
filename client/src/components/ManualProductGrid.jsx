import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { X, ArrowUp, ArrowDown, Copy } from 'lucide-react';

export default function ManualProductGrid() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
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

  const createProduct = async (name, catName, price) => {
    const catId = await resolveCategoryId(catName);
    const tempId = Date.now() + Math.random();
    
    const newProduct = {
      id: tempId,
      name: name.trim(),
      category_id: catId,
      categories: { name: catName ? `[M] ${catName}` : null },
      base_price: parseFloat(price) || 0,
      product_type: 'Manual Product'
    };

    const { data, error } = await supabase.from('products').insert([{
      name: newProduct.name,
      category_id: newProduct.category_id,
      base_price: newProduct.base_price,
      product_type: 'Manual Product'
    }]).select();

    return { error, data: data ? data[0] : null, tempId, newProduct };
  };

  const handleNewRowBlur = async () => {
    if (!newRow.name.trim()) return;

    const { name, category, price } = newRow;
    setNewRow({ name: '', category: '', price: '' }); // instantly clear
    
    const tempId = Date.now();
    const catId = await resolveCategoryId(category);
    const newProduct = {
      id: tempId,
      name: name.trim(),
      category_id: catId,
      categories: { name: category ? `[M] ${category}` : null },
      base_price: parseFloat(price) || 0,
      product_type: 'Manual Product'
    };
    
    setProducts(prev => [...prev, newProduct]);

    const res = await supabase.from('products').insert([{
      name: newProduct.name,
      category_id: newProduct.category_id,
      base_price: newProduct.base_price,
      product_type: 'Manual Product'
    }]).select();

    if (res.error) {
      addToast("Failed to add product", "error");
      setProducts(prev => prev.filter(p => p.id !== tempId));
    } else if (res.data) {
      setProducts(prev => prev.map(p => p.id === tempId ? { ...p, id: res.data[0].id } : p));
    }
  };

  // Keyboard Navigation
  const handleKeyDown = (e, rowIndex, colIndex, isNewRow, id = null) => {
    if (e.key === 'Enter') {
      e.target.blur(); 
      // Focus same column in next row if possible
      const nextRow = rowIndex + 1;
      const nextInput = document.querySelector(`input[data-row="${nextRow}"][data-col="${colIndex}"]`);
      if (nextInput) nextInput.focus();
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      let targetRow = rowIndex;
      let targetCol = colIndex;

      if (e.key === 'ArrowUp') targetRow = Math.max(0, rowIndex - 1);
      if (e.key === 'ArrowDown') targetRow = rowIndex + 1;
      
      // If pressing left/right, only navigate cells if cursor is at the very beginning or very end of the text
      if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
        targetCol = Math.max(0, colIndex - 1);
      } else if (e.key === 'ArrowRight' && e.target.selectionEnd === e.target.value.length) {
        targetCol = Math.min(2, colIndex + 1);
      } else {
        return; // Let normal text navigation happen
      }

      const nextInput = document.querySelector(`input[data-row="${targetRow}"][data-col="${targetCol}"]`);
      if (nextInput) {
        e.preventDefault();
        nextInput.focus();
      }
    }
  };

  // Bulk Paste
  const handlePaste = async (e) => {
    // Only intercept if we are pasting into the table itself, not into the top search bar (if any)
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('Text');
    if (!pastedText) return;

    // Check if it's multiple rows (TSV)
    const rows = pastedText.split(/\r?\n/).filter(r => r.trim());
    if (rows.length <= 1) return; // Let default paste handle single cell paste

    e.preventDefault();
    addToast(`Pasting ${rows.length} rows...`, "info");
    
    let optimisticAdditions = [];
    
    // Parse TSV: Assuming Product Name | Category (optional) | Price
    const promises = rows.map(async (rowStr, index) => {
      const cols = rowStr.split('\t');
      const name = cols[0] || `Pasted Product ${index}`;
      const cat = cols[1] || '';
      const price = cols[2] || '0';
      return createProduct(name, cat, price);
    });

    const results = await Promise.all(promises);
    
    const successful = results.filter(r => !r.error).map(r => r.data);
    if (successful.length > 0) {
      setProducts(prev => [...prev, ...successful]);
      addToast(`Successfully added ${successful.length} products`, "success");
    } else {
      addToast("Failed to paste products", "error");
    }
  };

  // Bulk Copy
  const handleCopySelected = () => {
    if (selectedIds.length === 0) return;
    const selectedProducts = products.filter(p => selectedIds.includes(p.id));
    const tsvData = selectedProducts.map(p => {
      const cat = p.categories?.name ? p.categories.name.replace('[M] ', '') : '';
      return `${p.name}\t${cat}\t${p.base_price}`;
    }).join('\n');
    
    navigator.clipboard.writeText(tsvData).then(() => {
      addToast(`Copied ${selectedProducts.length} rows to clipboard`, "success");
    });
  };

  // Bulk Move (Reorder)
  const syncOrderToDB = async (orderedList) => {
    // Update created_at timestamps to lock in the new order
    const baseTime = Date.now();
    const updates = orderedList.map((p, idx) => {
      return supabase.from('products')
        .update({ created_at: new Date(baseTime + idx * 1000).toISOString() })
        .eq('id', p.id);
    });
    await Promise.all(updates);
  };

  const handleMoveUp = () => {
    if (selectedIds.length === 0) return;
    let newProducts = [...products];
    for (let i = 1; i < newProducts.length; i++) {
      if (selectedIds.includes(newProducts[i].id) && !selectedIds.includes(newProducts[i-1].id)) {
        // Swap
        const temp = newProducts[i-1];
        newProducts[i-1] = newProducts[i];
        newProducts[i] = temp;
      }
    }
    setProducts(newProducts);
    syncOrderToDB(newProducts);
  };

  const handleMoveDown = () => {
    if (selectedIds.length === 0) return;
    let newProducts = [...products];
    for (let i = newProducts.length - 2; i >= 0; i--) {
      if (selectedIds.includes(newProducts[i].id) && !selectedIds.includes(newProducts[i+1].id)) {
        // Swap
        const temp = newProducts[i+1];
        newProducts[i+1] = newProducts[i];
        newProducts[i] = temp;
      }
    }
    setProducts(newProducts);
    syncOrderToDB(newProducts);
  };

  const handleDelete = async (id) => {
    setProducts(products.filter(p => p.id !== id));
    setSelectedIds(selectedIds.filter(selId => selId !== id));
    await supabase.from('products').delete().eq('id', id);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setProducts(products.filter(p => !selectedIds.includes(p.id)));
    const { error } = await supabase.from('products').delete().in('id', selectedIds);
    if (error) {
      addToast("Failed to delete selected products", "error");
      fetchData(); // rollback
    } else {
      setSelectedIds([]);
      addToast(`Deleted ${selectedIds.length} products`, "success");
    }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(products.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selId => selId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="bg-white p-2 md:p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex flex-wrap items-center justify-between mb-4 px-2 gap-4">
        <h2 className="text-lg font-bold">Manual Products Data</h2>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button onClick={handleMoveUp} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors" title="Move Up">
              <ArrowUp className="w-4 h-4" />
            </button>
            <button onClick={handleMoveDown} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors" title="Move Down">
              <ArrowDown className="w-4 h-4" />
            </button>
            <button onClick={handleCopySelected} className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-200 flex items-center gap-2 transition-colors">
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 flex items-center gap-2 transition-colors">
              <X className="w-4 h-4" /> Delete ({selectedIds.length})
            </button>
          </div>
        )}
      </div>
      
      <datalist id="manual-categories">
        {manualCategories.map(c => <option key={c.id} value={c.name} />)}
      </datalist>

      {loading ? (
        <div className="text-gray-500 px-2">Loading products...</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg" onPaste={handlePaste}>
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="p-3 font-semibold border-r border-gray-200 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={toggleSelectAll}
                    checked={products.length > 0 && selectedIds.length === products.length}
                  />
                </th>
                <th className="p-3 font-semibold border-r border-gray-200 w-[40%]">Product Name</th>
                <th className="p-3 font-semibold border-r border-gray-200 w-[30%]">Category</th>
                <th className="p-3 font-semibold border-r border-gray-200 w-[20%]">Price (₹)</th>
                <th className="p-3 font-semibold w-[10%] text-center"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod, rowIndex) => {
                const displayCategory = prod.categories?.name ? prod.categories.name.replace('[M] ', '') : '';
                return (
                  <tr key={prod.id} className={`border-b border-gray-100 hover:bg-blue-50/30 group transition-colors ${selectedIds.includes(prod.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-0 border-r border-gray-100 text-center align-middle">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.includes(prod.id)}
                        onChange={() => toggleSelectRow(prod.id)}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100 relative">
                      <input 
                        type="text" 
                        data-row={rowIndex}
                        data-col={0}
                        className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500"
                        value={prod.name}
                        onChange={(e) => setProducts(products.map(p => p.id === prod.id ? { ...p, name: e.target.value } : p))}
                        onBlur={(e) => handleUpdateExisting(prod.id, 'name', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 0, false, prod.id)}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100 relative">
                      <input 
                        type="text" 
                        list="manual-categories"
                        placeholder="Optional"
                        data-row={rowIndex}
                        data-col={1}
                        className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 placeholder-gray-300"
                        defaultValue={displayCategory}
                        onBlur={(e) => handleUpdateExisting(prod.id, 'category_name', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 1, false, prod.id)}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100 relative">
                      <input 
                        type="number" 
                        data-row={rowIndex}
                        data-col={2}
                        className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={prod.base_price}
                        onChange={(e) => setProducts(products.map(p => p.id === prod.id ? { ...p, base_price: e.target.value } : p))}
                        onBlur={(e) => handleUpdateExisting(prod.id, 'base_price', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 2, false, prod.id)}
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
              
              <tr className="bg-green-50/20">
                <td className="p-0 border-r border-gray-100 text-center"></td>
                <td className="p-0 border-r border-gray-100 relative">
                  <input 
                    type="text" 
                    placeholder="Type to add..."
                    data-row={products.length}
                    data-col={0}
                    className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-green-500 placeholder-gray-400"
                    value={newRow.name}
                    onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                    onBlur={handleNewRowBlur}
                    onKeyDown={(e) => handleKeyDown(e, products.length, 0, true)}
                  />
                </td>
                <td className="p-0 border-r border-gray-100 relative">
                  <input 
                    type="text" 
                    list="manual-categories"
                    placeholder="Optional category..."
                    data-row={products.length}
                    data-col={1}
                    className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-green-500 placeholder-gray-300"
                    value={newRow.category}
                    onChange={(e) => setNewRow({ ...newRow, category: e.target.value })}
                    onBlur={handleNewRowBlur}
                    onKeyDown={(e) => handleKeyDown(e, products.length, 1, true)}
                  />
                </td>
                <td className="p-0 border-r border-gray-100 relative">
                  <input 
                    type="number" 
                    placeholder="Price..."
                    data-row={products.length}
                    data-col={2}
                    className="w-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-green-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-gray-300"
                    value={newRow.price}
                    onChange={(e) => setNewRow({ ...newRow, price: e.target.value })}
                    onBlur={handleNewRowBlur}
                    onKeyDown={(e) => handleKeyDown(e, products.length, 2, true)}
                  />
                </td>
                <td className="p-0 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
