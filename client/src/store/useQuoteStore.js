import { create } from 'zustand';

export const useQuoteStore = create((set, get) => ({
  // Customer Details
  customer: { name: '', phone: '', project: '' },
  
  // The Shopping Cart
  items: [],
  
  // Settings
  globalDiscount: 0,
  gstIncluded: false, // if false, GST is added on top. if true, prices already include GST, but we'll still show the breakdown. Wait, standard is "GST Extra". Let's treat gstIncluded as "GST Added to total".

  // Actions
  setCustomer: (field, value) => set((state) => ({
    customer: { ...state.customer, [field]: value }
  })),

  setGlobalDiscount: (amount) => set({ globalDiscount: Number(amount) || 0 }),
  
  toggleGst: (included) => set({ gstIncluded: included }),

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
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, quantity: Math.max(1, quantity) } : item)
  })),

  updateItemPrice: (cartItemId, price) => set((state) => ({
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, custom_price_override: Number(price) } : item)
  })),

  updateItemDiscount: (cartItemId, discount) => set((state) => ({
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, discount_override: discount === '' ? '' : Number(discount) } : item)
  })),

  removeItem: (cartItemId) => set((state) => ({
    items: state.items.filter(item => (item.cartItemId || item.id) !== cartItemId)
  })),

  clearCart: () => set({ items: [], customer: { name: '', phone: '', project: '' }, globalDiscount: 0, gstIncluded: false }),

  // Derived Calculations
  getTotals: () => {
    const { items, globalDiscount, gstIncluded } = get();
    
    // Subtotal calculates the sum after applying individual item percentage discounts
    const subtotal = items.reduce((acc, item) => {
      const price = item.custom_price_override !== null ? item.custom_price_override : item.base_price;
      const effectiveDiscount = (item.discount_override !== '' && item.discount_override !== null) 
        ? Number(item.discount_override) 
        : (Number(globalDiscount) || 0);
      const finalPrice = price - (price * (effectiveDiscount / 100));
      return acc + (finalPrice * item.quantity);
    }, 0);

    // The discount is now applied inline to each product, so no global subtraction is needed
    const afterDiscount = subtotal;
    
    // Default GST is 18%.
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