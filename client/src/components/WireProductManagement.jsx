import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Loader2, Zap, Plus, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function WireProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState({ isOpen: false, id: null });
  const [newWire, setNewWire] = useState({ name: '', sub_brand: '', base_price: '' });
  const [adding, setAdding] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_type', 'Wire Product')
      .order('name', { ascending: true });

    if (error) {
      addToast('Failed to load wire products', 'error');
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }

  async function handlePriceUpdate(id, newPrice) {
    setSavingId(id);
    const priceNum = parseFloat(newPrice) || 0;
    
    const { error } = await supabase
      .from('products')
      .update({ base_price: priceNum })
      .eq('id', id);

    if (error) {
      addToast('Failed to update price', 'error');
    } else {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, base_price: priceNum } : p));
      addToast('Price updated successfully', 'success');
    }
    setSavingId(null);
  }

  async function handleDeleteWire(id) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      addToast('Failed to delete product', 'error');
    } else {
      setProducts(prev => prev.filter(p => p.id !== id));
      addToast('Product deleted', 'success');
    }
  }

  async function handleAddWire(e) {
    e.preventDefault();
    if (!newWire.name || !newWire.sub_brand || !newWire.base_price) {
      addToast('Please fill all fields', 'error');
      return;
    }
    setAdding(true);
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: newWire.name,
        sub_brand: newWire.sub_brand,
        base_price: parseFloat(newWire.base_price),
        product_type: 'Wire Product'
      })
      .select()
      .single();

    if (error) {
      addToast('Failed to add wire', 'error');
    } else {
      setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      addToast('Wire added successfully', 'success');
      setNewWire({ name: '', sub_brand: '', base_price: '' });
    }
    setAdding(false);
  }

  // Group wires by sub_brand
  const groupedWires = React.useMemo(() => {
    const groups = {};

    products.forEach(p => {
      const cat = p.sub_brand || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });

    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([_, items]) => items.length > 0);
  }, [products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-700">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-600" />
          Wire Price Management
        </h2>
        <p className="text-gray-700 text-sm mt-1">
          Click any price below to update it instantly.
        </p>
      </div>

      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <form onSubmit={handleAddWire} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={newWire.name}
              onChange={(e) => setNewWire({ ...newWire, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="e.g. 1.0 Sqmm Wire"
            />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
            <input
              type="text"
              value={newWire.sub_brand}
              onChange={(e) => setNewWire({ ...newWire, sub_brand: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="e.g. 1 SQ MM"
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">List Price</label>
            <input
              type="number"
              step="0.01"
              value={newWire.base_price}
              onChange={(e) => setNewWire({ ...newWire, base_price: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="0.00"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Wire
          </button>
        </form>
      </div>

      <div className="p-0">
        {groupedWires.map(([groupName, items]) => (
          <div key={groupName} className="border-b border-gray-100 last:border-0">
            <div className="bg-green-50 px-4 py-2 border-l-4 border-green-500 font-bold text-green-800 text-sm">
              {groupName}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {items.map(product => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-700">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={product.base_price}
                          onBlur={(e) => {
                            if (parseFloat(e.target.value) !== product.base_price) {
                              handlePriceUpdate(product.id, e.target.value);
                            }
                          }}
                          className="w-28 text-right border border-gray-300 rounded px-2 py-1 text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                        />
                        {savingId === product.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, id: product.id })}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete Wire"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Wire"
        message="Are you sure you want to delete this wire product?"
        onConfirm={() => {
          handleDeleteWire(deleteConfirm.id);
          setDeleteConfirm({ isOpen: false, id: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
        confirmText="Delete Wire"
      />
    </div>
  );
}
