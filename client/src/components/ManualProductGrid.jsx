import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import {
  DataSheetGrid,
  textColumn,
  floatColumn,
  keyColumn,
} from 'react-datasheet-grid'
import 'react-datasheet-grid/dist/style.css'

export default function ManualProductGrid() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();
  const lastSyncedProducts = useRef([]);
  const syncTimeoutRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('product_type', 'Manual Product').order('created_at', { ascending: true }),
      supabase.from('categories').select('*')
    ]);
    
    if (!prodRes.error && prodRes.data) {
      // Map Supabase rows to DataSheetGrid rows
      const gridRows = prodRes.data.map(p => ({
        id: p.id,
        name: p.name || '',
        category: p.categories?.name ? p.categories.name.replace('[M] ', '') : '',
        base_price: p.base_price || 0
      }));
      setProducts(gridRows);
      lastSyncedProducts.current = JSON.parse(JSON.stringify(gridRows));
    }
    
    if (!catRes.error && catRes.data) {
      setCategories(catRes.data);
    }
    setLoading(false);
  }

  const resolveCategoryId = async (categoryName) => {
    if (!categoryName || categoryName.trim() === '') return null;
    const cleanName = categoryName.trim();
    
    // Check local state first
    const existing = categories.find(c => c.name.toLowerCase() === `[m] ${cleanName.toLowerCase()}`);
    if (existing) return existing.id;

    // Create new category in DB
    const dbName = `[M] ${cleanName}`;
    const { data, error } = await supabase.from('categories').insert([{ name: dbName }]).select();
    if (error || !data || data.length === 0) return null;
    
    setCategories(prev => [...prev, data[0]]);
    return data[0].id;
  };

  const syncToDatabase = async (newRows) => {
    const oldRows = lastSyncedProducts.current;
    
    // 1. Identify deleted rows
    const oldIds = oldRows.filter(p => !p._isNew).map(p => p.id);
    const newIds = newRows.filter(p => !p._isNew).map(p => p.id);
    const deletedIds = oldIds.filter(id => !newIds.includes(id));

    if (deletedIds.length > 0) {
      await supabase.from('products').delete().in('id', deletedIds);
    }

    // 2. Identify inserted rows
    const insertedRows = newRows.filter(p => p._isNew && p.name && p.name.trim() !== '');
    if (insertedRows.length > 0) {
      const payload = await Promise.all(insertedRows.map(async row => ({
        name: row.name.trim(),
        base_price: parseFloat(row.base_price) || 0,
        category_id: await resolveCategoryId(row.category),
        product_type: 'Manual Product'
      })));

      const { data, error } = await supabase.from('products').insert(payload).select();
      if (!error && data) {
        setProducts(currentRows => {
          const nextRows = [...currentRows];
          insertedRows.forEach((insertedRow, idx) => {
             const matchingIndex = nextRows.findIndex(r => r.id === insertedRow.id);
             if (matchingIndex !== -1 && data[idx]) {
                nextRows[matchingIndex].id = data[idx].id;
                delete nextRows[matchingIndex]._isNew;
             }
          });
          return nextRows;
        });
      } else {
        addToast("Failed to insert some rows", "error");
      }
    }

    // 3. Identify updated rows
    const updatedRows = newRows.filter(p => !p._isNew);
    const updatePromises = [];
    
    for (const row of updatedRows) {
      const oldRow = oldRows.find(p => p.id === row.id);
      if (oldRow && (oldRow.name !== row.name || oldRow.category !== row.category || oldRow.base_price !== row.base_price)) {
        updatePromises.push(async () => {
          const catId = await resolveCategoryId(row.category);
          await supabase.from('products').update({
            name: row.name,
            base_price: parseFloat(row.base_price) || 0,
            category_id: catId
          }).eq('id', row.id);
        });
      }
    }

    if (updatePromises.length > 0) {
       await Promise.all(updatePromises.map(fn => fn()));
    }
    
    // Update baseline
    lastSyncedProducts.current = JSON.parse(JSON.stringify(newRows));
  };

  const handleChange = (newRows) => {
    // 1. Instantly update UI (fixes 500ms INP block)
    setProducts(newRows);
    
    // 2. Debounce heavy diffing and network calls
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncToDatabase(newRows);
    }, 1000);
  };

  const columns = [
    { ...keyColumn('name', textColumn), title: 'Product Name', minWidth: 300 },
    { ...keyColumn('category', textColumn), title: 'Category (Optional)', minWidth: 200 },
    { ...keyColumn('base_price', floatColumn), title: 'List Price (₹)', minWidth: 150 },
  ];

  return (
    <div className="bg-white p-2 md:p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex flex-wrap items-center justify-between mb-4 px-2 gap-4">
        <div>
           <h2 className="text-lg font-bold">Manual Products Grid</h2>
           <p className="text-sm text-gray-500 mt-1">True spreadsheet mode. Use drag-to-fill, right click to insert/delete, and Ctrl+V to paste multiple rows from Excel.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 px-2 py-8">Loading spreadsheet...</div>
      ) : (
        <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden">
          <DataSheetGrid
            value={products}
            onChange={handleChange}
            columns={columns}
            createRow={() => ({ id: Math.random().toString(36).substring(7), name: '', category: '', base_price: 0, _isNew: true })}
            duplicateRow={({ rowData }) => ({ ...rowData, id: Math.random().toString(36).substring(7), _isNew: true })}
            addRowsComponent={({ addRows }) => (
                <button 
                  onClick={() => addRows(1)} 
                  className="w-full p-2 text-sm text-gray-500 hover:bg-gray-50 bg-gray-50/50 border-t border-gray-200 text-left transition-colors"
                >
                  + Add 1 Row
                </button>
            )}
            style={{
              '--dsg-header-background': '#f9fafb',
              '--dsg-header-text-color': '#374151',
              '--dsg-cell-background': '#ffffff',
              '--dsg-selection-border-color': '#3b82f6',
              '--dsg-selection-background-color': 'rgba(59, 130, 246, 0.1)',
            }}
          />
        </div>
      )}
    </div>
  );
}
