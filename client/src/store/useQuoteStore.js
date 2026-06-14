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
    const exists = state.items.find(item => item.id === product.id);
    if (exists) {
      return { 
        items: state.items.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        ) 
      };
    }
    return { 
      items: [...state.items, { ...product, quantity: 1, discount_override: 0, custom_price_override: product.base_price }] 
    };
  }),

  updateItemQuantity: (id, quantity) => set((state) => ({
    items: state.items.map(item => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item)
  })),

  updateItemPrice: (id, price) => set((state) => ({
    items: state.items.map(item => item.id === id ? { ...item, custom_price_override: Number(price) } : item)
  })),

  updateItemDiscount: (id, discount) => set((state) => ({
    items: state.items.map(item => item.id === id ? { ...item, discount_override: Number(discount) } : item)
  })),

  removeItem: (id) => set((state) => ({
    items: state.items.filter(item => item.id !== id)
  })),

  clearCart: () => set({ items: [], customer: { name: '', phone: '', project: '' }, globalDiscount: 0, gstIncluded: false }),

  // Derived Calculations
  getTotals: () => {
    const { items, globalDiscount, gstIncluded } = get();
    
    // Subtotal calculates the sum after applying individual item percentage discounts
    const subtotal = items.reduce((acc, item) => {
      const price = item.custom_price_override !== null ? item.custom_price_override : item.base_price;
      const discountPercentage = item.discount_override || 0;
      const finalPrice = price - (price * (discountPercentage / 100));
      return acc + (finalPrice * item.quantity);
    }, 0);

    // Global discount is now a percentage applied to the subtotal
    const discountAmount = subtotal * (globalDiscount / 100);
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    
    // Default GST is 18%.
    const gstAmount = gstIncluded ? afterDiscount * 0.18 : 0;
    const grandTotal = Math.round(afterDiscount + gstAmount);

    return {
      subtotal,
      discount_amount: discountAmount,
      gst_amount: gstAmount,
      grand_total: grandTotal
    };
  }
}));