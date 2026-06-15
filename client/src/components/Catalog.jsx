import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuoteStore } from '../store/useQuoteStore';
import { supabase } from '../supabase';
import { Search, Plus, X } from 'lucide-react';

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const addItem = useQuoteStore(state => state.addItem);

  const [showWattageModal, setShowWattageModal] = useState(false);
  const [selectedProductForWattage, setSelectedProductForWattage] = useState(null);

  const handleAddToCartClick = (product) => {
    if (product.wattages && product.wattages.trim() !== '') {
      setSelectedProductForWattage(product);
      setShowWattageModal(true);
    } else {
      addItem(product);
    }
  };

  const handleWattageSelect = (wattage) => {
    if (selectedProductForWattage) {
      addItem({ ...selectedProductForWattage, selected_wattage: wattage.trim() });
    }
    setShowWattageModal(false);
    setSelectedProductForWattage(null);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          brands (name),
          categories (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.model_number && p.model_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Search Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search products by name or model..."
            className="input-field pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="bg-gray-200 aspect-square rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            No products found.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <div key={product.id} className="card group hover:shadow-md transition-shadow flex flex-col">
                <div className="aspect-square bg-gray-100 overflow-hidden relative">
                  {product.primary_image_url ? (
                    <img 
                      src={product.primary_image_url} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-medium text-gray-700 shadow-sm">
                    {product.categories?.name || 'Uncategorized'}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="text-sm text-gray-500 mb-1">{product.brands?.name || 'No Brand'}</div>
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                  {product.model_number && (
                    <p className="text-xs text-gray-500 mb-2">Model: {product.model_number}</p>
                  )}
                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <span className="font-bold text-blue-600">₹{product.base_price.toLocaleString()}</span>
                    <button 
                      onClick={() => handleAddToCartClick(product)}
                      className="bg-gray-100 hover:bg-blue-600 hover:text-white p-2 rounded-lg transition-colors text-gray-700"
                      title="Add to Quote"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wattage Selection Modal */}
      {showWattageModal && selectedProductForWattage && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-900">Select Wattage</h3>
              <button onClick={() => setShowWattageModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Please select a wattage for <strong>{selectedProductForWattage.name}</strong>:</p>
              <div className="grid grid-cols-2 gap-3">
                {selectedProductForWattage.wattages.split(',').map((w, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleWattageSelect(w)}
                    className="py-2 px-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-gray-700 font-medium transition-colors"
                  >
                    {w.trim()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
