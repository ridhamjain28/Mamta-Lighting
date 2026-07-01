import React, { useState, useEffect, useMemo } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { useToastStore } from '../store/useToastStore';
import { supabase } from '../supabase';
import { Search, Loader2, CheckCircle2 } from 'lucide-react';
import QuoteSummary from './QuoteSummary';

export default function ManualQuotePage() {
  const {
    customer, setCustomer,
    items,
    globalDiscount,
    addItem, removeItem,
    updateItemQuantity, updateItemPrice, updateItemDiscount
  } = useQuoteStore();

  const addToast = useToastStore((s) => s.addToast);

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Local state for per-product overrides (qty, manual price, disc %)
  // Keyed by product id
  const [localOverrides, setLocalOverrides] = useState({});

  // ─── Fetch products ───────────────────────────────────────────
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, brands (name), categories (name)')
      .eq('product_type', 'Manual Product')
      .order('name', { ascending: true });

    if (error) {
      addToast('Failed to load products', 'error');
      console.error(error);
    } else {
      setAllProducts(data || []);
      // Initialize local overrides from existing store items
      const overrides = {};
      (data || []).forEach((p) => {
        const existingItem = items.find((it) => it.id === p.id);
        if (existingItem) {
          overrides[p.id] = {
            qty: existingItem.quantity,
            manualPrice: existingItem.custom_price_override ?? p.base_price,
            disc: existingItem.discount_override !== '' && existingItem.discount_override != null
              ? existingItem.discount_override
              : '',
          };
        }
      });
      setLocalOverrides(overrides);
    }
    setLoading(false);
  }

  // ─── Helpers ──────────────────────────────────────────────────
  function getOverride(productId) {
    return localOverrides[productId] || { qty: 0, manualPrice: null, disc: '' };
  }

  function setOverride(productId, patch) {
    setLocalOverrides((prev) => ({
      ...prev,
      [productId]: { ...getOverride(productId), ...patch },
    }));
  }

  // ─── Sync a product with the store ────────────────────────────
  function syncProductToStore(product, qty, manualPrice, disc) {
    const existingItem = useQuoteStore.getState().items.find((it) => it.id === product.id);

    if (qty > 0) {
      if (!existingItem) {
        // Add the item to the store
        addItem({
          ...product,
          quantity: qty,
          custom_price_override: manualPrice ?? product.base_price,
          discount_override: disc !== '' ? disc : '',
        });
        // After adding, update quantity/price/discount if addItem sets qty=1
        setTimeout(() => {
          const freshItems = useQuoteStore.getState().items;
          const added = freshItems.find((it) => it.id === product.id);
          if (added) {
            if (qty !== 1) updateItemQuantity(added.cartItemId, qty);
            updateItemPrice(added.cartItemId, manualPrice ?? product.base_price);
            if (disc !== '') updateItemDiscount(added.cartItemId, disc);
          }
        }, 0);
      } else {
        updateItemQuantity(existingItem.cartItemId, qty);
        updateItemPrice(existingItem.cartItemId, manualPrice ?? product.base_price);
        updateItemDiscount(existingItem.cartItemId, disc !== '' ? disc : '');
      }
    } else {
      if (existingItem) {
        removeItem(existingItem.cartItemId);
      }
    }
  }

  // ─── Event handlers ───────────────────────────────────────────
  function handleQtyChange(product, value) {
    const qty = Math.max(0, parseInt(value, 10) || 0);
    const ov = getOverride(product.id);
    const manualPrice = ov.manualPrice ?? product.base_price;
    const disc = ov.disc;
    setOverride(product.id, { qty, manualPrice });
    syncProductToStore(product, qty, manualPrice, disc);
  }

  function handlePriceChange(product, value) {
    const price = parseFloat(value) || 0;
    const ov = getOverride(product.id);
    setOverride(product.id, { manualPrice: price });
    if (ov.qty > 0) {
      syncProductToStore(product, ov.qty, price, ov.disc);
    }
  }

  function handleDiscChange(product, value) {
    const disc = value === '' ? '' : Math.min(100, Math.max(0, parseFloat(value) || 0));
    const ov = getOverride(product.id);
    setOverride(product.id, { disc });
    if (ov.qty > 0) {
      syncProductToStore(product, ov.qty, ov.manualPrice ?? product.base_price, disc);
    }
  }

  // ─── Compute row total ────────────────────────────────────────
  function rowTotal(product) {
    const ov = getOverride(product.id);
    const qty = ov.qty || 0;
    const price = ov.manualPrice ?? product.base_price ?? 0;
    const disc = ov.disc !== '' ? parseFloat(ov.disc) || 0 : (Number(globalDiscount) || 0);
    return (price - price * disc / 100) * qty;
  }

  // ─── Filtered & grouped products ─────────────────────────────
  const groupedProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = allProducts.filter((p) =>
      !query || p.name?.toLowerCase().includes(query) || (p.brands?.name && p.brands.name.toLowerCase().includes(query))
    );

    // Group by category
    const groups = {};
    filtered.forEach((p) => {
      const catName = p.categories?.name || 'Uncategorized';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    });

    // Sort within each category: active (qty>0) first, then alphabetical
    Object.keys(groups).forEach((cat) => {
      groups[cat].sort((a, b) => {
        const aQty = getOverride(a.id).qty || 0;
        const bQty = getOverride(b.id).qty || 0;
        if (aQty > 0 && bQty === 0) return -1;
        if (aQty === 0 && bQty > 0) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
    });

    // Sort category names alphabetically
    const sortedCats = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedCats.map((cat) => ({ category: cat, products: groups[cat] }));
  }, [allProducts, searchQuery, localOverrides]);

  // ─── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        <span className="ml-3 text-gray-500">Loading products…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      {/* ─── Customer Details ────────────────────────────────────── */}
      <div className="bg-white border-b shadow-sm px-5 py-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Customer Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={customer.name || ''}
            onChange={(e) => setCustomer('name', e.target.value)}
            placeholder="Customer Name *"
            className="input-field"
          />
          <input
            type="text"
            value={customer.phone || ''}
            onChange={(e) => setCustomer('phone', e.target.value)}
            placeholder="Phone Number"
            className="input-field"
          />
          <input
            type="text"
            value={customer.project || ''}
            onChange={(e) => setCustomer('project', e.target.value)}
            placeholder="Project Name"
            className="input-field"
          />
        </div>
      </div>

      {/* ─── Search Bar ──────────────────────────────────────────── */}
      <div className="bg-white border-b px-5 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or brand…"
            className="input-field pl-10 py-2 text-sm"
          />
        </div>
      </div>

      {/* ─── Product Table ───────────────────────────────────────── */}
      <div className="flex-1 px-2 md:px-4 py-3">
        {groupedProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No manual products found. Add products in the Products tab first.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="text-left px-3 py-2.5 font-semibold">Product Name</th>
                  <th className="text-left px-2 py-2.5 font-semibold w-24">Brand</th>
                  <th className="text-right px-2 py-2.5 font-semibold w-24">List ₹</th>
                  <th className="text-center px-2 py-2.5 font-semibold w-20">Qty</th>
                  <th className="text-right px-2 py-2.5 font-semibold w-28">Price ₹</th>
                  <th className="text-center px-2 py-2.5 font-semibold w-20">Disc %</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {groupedProducts.map((group) => (
                  <React.Fragment key={group.category}>
                    {/* Category Header */}
                    <tr>
                      <td colSpan={7} className="px-0 py-0">
                        <div className="flex items-center border-l-4 border-purple-500 bg-purple-50 px-3 py-2 mt-1">
                          <span className="font-bold text-purple-800 text-xs uppercase tracking-wide">
                            {group.category}
                          </span>
                          <span className="ml-2 text-xs text-purple-500">
                            ({group.products.length} item{group.products.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Product Rows */}
                    {group.products.map((product) => {
                      const ov = getOverride(product.id);
                      const qty = ov.qty || 0;
                      const manualPrice = ov.manualPrice ?? product.base_price ?? 0;
                      const disc = ov.disc;
                      const total = rowTotal(product);
                      const isActive = qty > 0;

                      return (
                        <tr
                          key={product.id}
                          className={`border-b border-gray-100 transition-colors ${
                            isActive
                              ? 'bg-purple-50/70 hover:bg-purple-100/60'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Product Name */}
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              {isActive && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              )}
                              <span className={`${isActive ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                                {product.name}
                              </span>
                            </div>
                          </td>
                          {/* Brand */}
                          <td className="px-2 py-1.5 text-gray-500 text-xs">{product.brands?.name || '—'}</td>
                          {/* List Price */}
                          <td className="px-2 py-1.5 text-right text-gray-400 tabular-nums">
                            {(product.base_price ?? 0).toFixed(2)}
                          </td>
                          {/* Qty */}
                          <td className="px-2 py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) => handleQtyChange(product, e.target.value)}
                              placeholder="0"
                              className={`w-16 text-center text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-purple-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isActive
                                  ? 'border-purple-300 bg-white font-bold text-purple-700'
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            />
                          </td>
                          {/* Manual Price */}
                          <td className="px-2 py-1 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={manualPrice}
                              onChange={(e) => handlePriceChange(product, e.target.value)}
                              className={`w-24 text-right text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-purple-400 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isActive
                                  ? 'border-purple-300 bg-white'
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            />
                          </td>
                          {/* Disc % */}
                          <td className="px-2 py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={disc}
                              onChange={(e) => handleDiscChange(product, e.target.value)}
                              placeholder="—"
                              className={`w-16 text-center text-sm border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-red-300 text-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isActive
                                  ? 'border-purple-300 bg-white'
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            />
                          </td>
                          {/* Total */}
                          <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${isActive ? 'text-gray-900 font-bold' : 'text-gray-300'}`}>
                            {isActive ? `₹${total.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Summary & Actions (QuoteSummary handles totals, save, PDF) ─── */}
      <QuoteSummary />
    </div>
  );
}
