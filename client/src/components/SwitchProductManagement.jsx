import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Plus, Save, Trash2, Tag, Palette, Bookmark, Pencil, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import * as xlsx from 'xlsx';
import { standardizeProductName, getProductRank, brandMap } from '../utils/productStandardizer';
import { UploadCloud, Loader2, Edit2, Check, X as XIcon } from 'lucide-react';
export default function SwitchProductManagement() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

  const [editingBrand, setEditingBrand] = useState({ id: null, name: '' });
  const [newBrand, setNewBrand] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  
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
  const [editingVariant, setEditingVariant] = useState(null);

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

  const handleUpdateVariant = async () => {
    if (!editingVariant) return;
    const { id, name, sub_brand, color, base_price } = editingVariant;
    
    if (!name.trim() || isNaN(parseFloat(base_price))) {
      addToast('Name and valid price are required', 'error');
      return;
    }

    const { error } = await supabase.from('products').update({
      name: name.trim(),
      sub_brand: sub_brand.trim() || null,
      color: color.trim() || null,
      base_price: parseFloat(base_price)
    }).eq('id', id);

    if (error) {
      addToast('Error updating variant', 'error');
    } else {
      setProducts(prev => prev.map(p => p.id === id ? { 
        ...p, 
        name: name.trim(), 
        sub_brand: sub_brand.trim() || null, 
        color: color.trim() || null, 
        base_price: parseFloat(base_price) 
      } : p));
      addToast('Variant updated', 'success');
      setEditingVariant(null);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = xlsx.read(data, { type: 'array' });
        
        const productsToInsert = [];
        const productsToUpdate = [];
        const seenMap = new Set();
        
        const brandDict = {};
        brands.forEach(b => brandDict[b.name.toLowerCase()] = b.id);

        for (const sheetName of workbook.SheetNames) {
          if (['Quotation', 'Preview', 'T&C'].includes(sheetName)) continue;
          const parts = sheetName.split('-');
          if (parts.length !== 2) continue;
          const brandInfo = brandMap[parts[0]];
          if (!brandInfo) continue;
          
          const brandId = brandDict[brandInfo.brand.toLowerCase()];
          if (!brandId) continue; // Brand doesn't exist in DB

          const sheet = workbook.Sheets[sheetName];
          const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
          
          for (let i = 1; i < json.length; i++) {
            const row = json[i];
            if (!row || !row[0] || isNaN(parseFloat(row[1]))) continue;
            
            const stdName = standardizeProductName(row[0]);
            const color = parts[1];
            const subBrand = brandInfo.subBrand;
            
            const key = `${brandId}|${subBrand}|${color}|${stdName}`;
            if (seenMap.has(key)) continue; // skip duplicates in excel
            seenMap.add(key);

            const existing = products.find(p => 
              p.name === stdName && 
              p.brand_id === brandId && 
              (p.sub_brand || '') === subBrand && 
              (p.color || '') === color
            );

            const payload = {
              name: stdName,
              product_type: 'Manual Product',
              brand_id: brandId,
              sub_brand: subBrand,
              color: color,
              base_price: parseFloat(row[1]),
            };

            if (existing) {
              // Only update if price changed to save DB calls
              if (existing.base_price !== payload.base_price) {
                productsToUpdate.push({ ...payload, id: existing.id });
              }
            } else {
              productsToInsert.push(payload);
            }
          }
        }

        // Process Updates
        let updatedCount = 0;
        for (let i = 0; i < productsToUpdate.length; i += 100) {
          const chunk = productsToUpdate.slice(i, i + 100);
          const { error } = await supabase.from('products').upsert(chunk);
          if (error) throw error;
          updatedCount += chunk.length;
        }

        // Process Inserts
        let insertedCount = 0;
        for (let i = 0; i < productsToInsert.length; i += 100) {
          const chunk = productsToInsert.slice(i, i + 100);
          const { error } = await supabase.from('products').insert(chunk);
          if (error) throw error;
          insertedCount += chunk.length;
        }

        addToast(`Successfully synced Excel! Updated ${updatedCount}, Added ${insertedCount} products.`, 'success');
        fetchMetadata(); // Reload DB
      } catch (error) {
        console.error(error);
        addToast('Failed to parse or sync Excel file', 'error');
      } finally {
        setImportLoading(false);
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Group products by name for display
  const groupedProducts = useMemo(() => {
    const groups = {};
    products.forEach(p => {
      if (!groups[p.name]) groups[p.name] = [];
      groups[p.name].push(p);
    });
    return groups;
  }, [products]);

  const sortedGroupNames = useMemo(() => {
    return Object.keys(groupedProducts).sort((a, b) => {
      const rankA = getProductRank(a);
      const rankB = getProductRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
  }, [groupedProducts]);

  if (loading) {
    return <div className="p-8 text-center text-gray-700">Loading...</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Bulk Import Section */}
      <div className="bg-purple-50 p-6 rounded-xl shadow-sm border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-purple-900 flex items-center gap-2 text-lg">
            <UploadCloud className="w-5 h-5" /> Sync Prices from Excel
          </h3>
          <p className="text-purple-700 text-sm mt-1">
            Upload the master <span className="font-mono bg-purple-100 px-1 rounded">Switch Quotation System.xlsx</span> file to automatically add new products and update all prices.
          </p>
        </div>
        <div>
          <label className={`relative flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg font-medium shadow hover:bg-purple-700 transition-colors cursor-pointer ${importLoading ? 'opacity-70 pointer-events-none' : ''}`}>
            {importLoading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Syncing...</>
            ) : (
              <>Upload Excel File</>
            )}
            <input 
              type="file" 
              accept=".xlsx" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
              disabled={importLoading}
            />
          </label>
        </div>
      </div>

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
          {sortedGroupNames.length === 0 ? (
            <div className="text-center text-gray-700 py-8">No switch products found.</div>
          ) : (
            <div className="space-y-6">
              {sortedGroupNames.map(name => {
                const variants = groupedProducts[name];
                return (
                  <div key={name} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-purple-50 px-4 py-2 border-l-4 border-purple-500 font-bold text-purple-900">
                      {name}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium w-48">Product Name</th>
                            <th className="text-left px-4 py-2 font-medium">Brand</th>
                            <th className="text-left px-4 py-2 font-medium">Sub-brand</th>
                            <th className="text-left px-4 py-2 font-medium">Color</th>
                            <th className="text-right px-4 py-2 font-medium">Price (₹)</th>
                            <th className="text-center px-4 py-2 font-medium w-24">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map(v => {
                            const isEditing = editingVariant?.id === v.id;
                            return (
                              <tr key={v.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${isEditing ? 'bg-blue-50/50' : ''}`}>
                                <td className="px-4 py-2">
                                  {isEditing ? (
                                    <input 
                                      type="text" 
                                      className="input-field py-1 px-2 text-sm w-full min-w-[150px]" 
                                      value={editingVariant.name} 
                                      onChange={e => setEditingVariant({...editingVariant, name: e.target.value})} 
                                    />
                                  ) : (
                                    <span className="text-gray-400 text-xs italic">Inherited</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-600">{v.brands?.name}</td>
                                <td className="px-4 py-2">
                                  {isEditing ? (
                                    <input 
                                      type="text" 
                                      className="input-field py-1 px-2 text-sm w-24" 
                                      value={editingVariant.sub_brand} 
                                      onChange={e => setEditingVariant({...editingVariant, sub_brand: e.target.value})} 
                                    />
                                  ) : (
                                    v.sub_brand || '-'
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {isEditing ? (
                                    <input 
                                      type="text" 
                                      className="input-field py-1 px-2 text-sm w-24" 
                                      value={editingVariant.color} 
                                      onChange={e => setEditingVariant({...editingVariant, color: e.target.value})} 
                                    />
                                  ) : (
                                    v.color || '-'
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right font-medium">
                                  {isEditing ? (
                                    <input 
                                      type="number" 
                                      step="0.01"
                                      className="input-field py-1 px-2 text-sm w-24 text-right" 
                                      value={editingVariant.base_price} 
                                      onChange={e => setEditingVariant({...editingVariant, base_price: e.target.value})} 
                                    />
                                  ) : (
                                    v.base_price.toFixed(2)
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    {isEditing ? (
                                      <>
                                        <button onClick={handleUpdateVariant} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Save">
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setEditingVariant(null)} className="p-1 text-gray-500 hover:bg-gray-200 rounded" title="Cancel">
                                          <XIcon className="w-4 h-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button 
                                          onClick={() => setEditingVariant({ 
                                            id: v.id, 
                                            name: v.name, 
                                            sub_brand: v.sub_brand || '', 
                                            color: v.color || '', 
                                            base_price: v.base_price 
                                          })} 
                                          className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors" 
                                          title="Edit Variant"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => setDeleteProductConfirm({ isOpen: true, id: v.id })}
                                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title="Delete Variant"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
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
