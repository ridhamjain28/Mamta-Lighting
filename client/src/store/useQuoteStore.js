import { create } from 'zustand';

const defaultState = {
  customer: { name: '', phone: '', project: '' },
  items: [],
  quoteId: null,
  status: 'Draft',
  globalDiscount: 0,
  gstIncluded: false, // if false, GST is added on top. if true, prices already include GST, but we'll still show the breakdown.
  hideListPrice: false,
};

export const useQuoteStore = create((set, get) => ({
  // --- SYSTEM SEPARATION ---
  systemMode: null, // 'Image Quote', 'Switch Quote', or 'Wire Quote'
  quoteType: null, // Keeps compatibility with old quoteType references

  // --- ACTIVE STATE (Spread at root so components don't need to change) ---
  ...defaultState,

  // --- BACKGROUND CACHES ---
  imageCache: { ...defaultState },
  switchCache: { ...defaultState },
  wireCache: { ...defaultState },

  setSystemMode: (mode) => set((state) => {
    if (state.systemMode === mode) return {};
    
    // Save current active state to the cache BEFORE switching
    const currentSnapshot = {
      customer: state.customer,
      items: state.items,
      quoteId: state.quoteId,
      status: state.status,
      globalDiscount: state.globalDiscount,
      gstIncluded: state.gstIncluded,
      hideListPrice: state.hideListPrice,
    };

    const updates = { 
      systemMode: mode,
      quoteType: mode
    };

    if (state.systemMode === 'Image Quote') updates.imageCache = currentSnapshot;
    if (state.systemMode === 'Switch Quote') updates.switchCache = currentSnapshot;
    if (state.systemMode === 'Wire Quote') updates.wireCache = currentSnapshot;

    // Load state from the target cache
    const targetCache = mode === 'Image Quote' ? (updates.imageCache || state.imageCache) : 
                        mode === 'Switch Quote' ? (updates.switchCache || state.switchCache) :
                        (updates.wireCache || state.wireCache);
    
    return { ...updates, ...targetCache };
  }),

  setQuoteMetadata: (metadata) => set((state) => ({ ...state, ...metadata })),

  // --- ACTIONS ---
  setCustomer: (field, value) => set((state) => ({
    customer: { ...state.customer, [field]: value }
  })),

  setGlobalDiscount: (amount) => set({ globalDiscount: Number(amount) || 0 }),
  
  toggleGst: (included) => set({ gstIncluded: included }),
  toggleHideListPrice: (hide) => set({ hideListPrice: hide }),

  addItem: (product) => set((state) => {
    // Treat different wattages of the same product as different cart items
    const compositeId = product.selected_wattage ? `${product.id}-${product.selected_wattage}` : product.id;
    
    const exists = state.items.find(item => {
      const itemCompositeId = item.selected_wattage ? `${item.id}-${item.selected_wattage}` : item.id;
      return itemCompositeId === compositeId;
    });

    if (exists) {
      return { 
        items: state.items.map(item => {
          const itemCompositeId = item.selected_wattage ? `${item.id}-${item.selected_wattage}` : item.id;
          return itemCompositeId === compositeId ? { ...item, quantity: item.quantity + 1 } : item;
        }) 
      };
    }
    return { 
      items: [...state.items, { 
        ...product, 
        cartItemId: compositeId, // We can store a unique cart item ID
        quantity: 1, 
        discount_override: '', 
        custom_price_override: product.base_price 
      }] 
    };
  }),

  updateItemQuantity: (cartItemId, quantity) => set((state) => ({
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, quantity: quantity === '' ? '' : Math.max(0, Number(quantity)) } : item)
  })),

  updateItemPrice: (cartItemId, price) => set((state) => ({
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, custom_price_override: price === '' ? null : Number(price) } : item)
  })),

  updateItemDiscount: (cartItemId, discount) => set((state) => ({
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, discount_override: discount === '' ? '' : Number(discount) } : item)
  })),

  removeItem: (cartItemId) => set((state) => ({
    items: state.items.filter(item => (item.cartItemId || item.id) !== cartItemId)
  })),

  clearCart: () => set((state) => ({ 
    ...defaultState,
    quoteType: state.systemMode // Retain the quote type to match system mode
  })),

  // Derived Calculations
  getTotals: () => {
    const { items, globalDiscount, gstIncluded } = get();
    
    const subtotal = items.reduce((acc, item) => {
      let price = item.custom_price_override;
      if (price === null || price === undefined || price === '' || Number(price) === 0) {
        price = item.base_price;
      } else {
        price = Number(price);
      }
      const effectiveDiscount = (item.discount_override !== '' && item.discount_override !== null) 
        ? Number(item.discount_override) 
        : (Number(globalDiscount) || 0);
      const finalPrice = price - (price * (effectiveDiscount / 100));
      return acc + (finalPrice * item.quantity);
    }, 0);

    const afterDiscount = subtotal;
    const gstAmount = gstIncluded ? afterDiscount * 0.18 : 0;
    const grandTotal = Math.round(afterDiscount + gstAmount);

    return {
      subtotal,
      discount_amount: 0,
      gst_amount: gstAmount,
      grand_total: grandTotal
    };
  }
}));