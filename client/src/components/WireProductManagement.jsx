import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToastStore } from '../store/useToastStore';
import { Loader2, Zap } from 'lucide-react';

export default function WireProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
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

  // Group wires by thickness
  const groupedWires = React.useMemo(() => {
    const groups = {
      '0.75 SQ MM': [],
      '1 SQ MM': [],
      '1.5 SQ MM': [],
      '2.5 SQ MM': [],
      '4 SQ MM': [],
      '6 SQ MM': [],
      'Other': []
    };

    products.forEach(p => {
      const name = p.name.toUpperCase();
      if (name.includes('0.75 SQ MM')) groups['0.75 SQ MM'].push(p);
      else if (name.includes('1.5 SQ MM')) groups['1.5 SQ MM'].push(p);
      else if (name.includes('2.5 SQ MM')) groups['2.5 SQ MM'].push(p);
      else if (name.includes('1 SQ MM')) groups['1 SQ MM'].push(p);
      else if (name.includes('4 SQ MM')) groups['4 SQ MM'].push(p);
      else if (name.includes('6 SQ MM')) groups['6 SQ MM'].push(p);
      else groups['Other'].push(p);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
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
        <p className="text-gray-500 text-sm mt-1">
          Click any price below to update it instantly.
        </p>
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
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-500">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={product.base_price}
                          onBlur={(e) => {
                            if (parseFloat(e.target.value) !== product.base_price) {
                              handlePriceUpdate(product.id, e.target.value);
                            }
                          }}
                          className="w-28 text-right border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-500 outline-none"
                        />
                        {savingId === product.id && <Loader2 className="w-4 h-4 animate-spin text-green-600" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
