import { create } from 'zustand';
import { supabase } from '../supabase';
import { useToastStore } from './useToastStore';

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

  switchCompareColumns: [
    { brandId: '', subBrand: '', color: '', discount: '', gstIncluded: false },
    { brandId: '', subBrand: '', color: '', discount: '', gstIncluded: false },
    { brandId: '', subBrand: '', color: '', discount: '', gstIncluded: false }
  ],
  setSwitchCompareColumns: (updater) => set((state) => ({ 
    switchCompareColumns: typeof updater === 'function' ? updater(state.switchCompareColumns) : updater 
  })),

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
          return itemCompositeId === compositeId ? { ...item, quantity: item.quantity + (product.quantity ?? 1) } : item;
        }) 
      };
    }
    return { 
      items: [...state.items, { 
        ...product, 
        cartItemId: compositeId, // We can store a unique cart item ID
        quantity: product.quantity ?? 1, 
        discount_override: product.discount_override ?? '', 
        custom_price_override: product.custom_price_override ?? product.base_price 
      }] 
    };
  }),

  updateItemQuantity: (cartItemId, quantity) => set((state) => ({
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, quantity: quantity === '' ? '' : Math.max(0, Number(quantity)) } : item)
  })),

  updateItemPrice: (cartItemId, price) => set((state) => ({
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, custom_price_override: (price === '' || price === null || price === undefined) ? null : Number(price) } : item)
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
      if (price === null || price === undefined || price === '') {
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
  },

  saveQuoteToDatabase: async (finalStatus = null, pdfUrl = null, typeOverride = null) => {
    const state = get();
    const { items, customer, getTotals, quoteId, quoteType, status, setQuoteMetadata, globalDiscount, gstIncluded } = state;
    
    const stat = finalStatus || status;
    const finalQuoteType = typeOverride || quoteType;

    if (items.length === 0) {
      useToastStore.getState().addToast("Cart is empty", "error");
      return null;
    }

    const activeItems = items.filter(item => Number(item.quantity) > 0);
    
    if (activeItems.length === 0) {
      useToastStore.getState().addToast("Cart has no items with a quantity > 0", "error");
      return null;
    }
    
    const { subtotal, discount_amount, gst_amount, grand_total } = getTotals();

    const payload = {
      customer_name: customer.name || '',
      phone_number: customer.phone,
      project_name: customer.project,
      subtotal,
      tax_amount: gst_amount,
      total_discount: discount_amount,
      grand_total,
      quote_type: finalQuoteType,
      status: stat,
      updated_at: new Date().toISOString()
    };

    if (pdfUrl) {
      payload.pdf_url = pdfUrl;
    }

    try {
      let savedQuote;
      if (quoteId) {
        const { data, error } = await supabase
          .from('quotations')
          .update(payload)
          .eq('id', quoteId)
          .select()
          .single();
        if (error) throw error;
        savedQuote = data;
        
        await supabase.from('quotation_items').delete().eq('quotation_id', savedQuote.id);
      } else {
        payload.quote_number = 'QT-' + Math.floor(100000 + Math.random() * 900000).toString();
        const { data, error } = await supabase
          .from('quotations')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        savedQuote = data;
      }
      
      if (activeItems.length > 0) {
        const itemsPayload = activeItems.map(item => {
          let itemPrice = item.custom_price_override;
          if (itemPrice === null || itemPrice === undefined || itemPrice === '') {
            itemPrice = item.base_price;
          } else {
            itemPrice = Number(itemPrice);
          }
          const itemDisc = (item.discount_override !== '' && item.discount_override !== null) 
              ? Number(item.discount_override) 
              : (Number(globalDiscount) || 0);
          const finalPrice = itemPrice - (itemPrice * itemDisc / 100);
          
          return {
            quotation_id: savedQuote.id,
            product_id: item.id,
            quantity: Number(item.quantity),
            base_price: item.base_price,
            discount_override: item.discount_override !== '' ? Number(item.discount_override) : null,
            custom_price_override: item.custom_price_override !== null ? Number(item.custom_price_override) : null,
            final_unit_price: finalPrice,
            line_total: finalPrice * Number(item.quantity)
          };
        });
        
        const { error: itemsError } = await supabase.from('quotation_items').insert(itemsPayload);
        if (itemsError) throw itemsError;
      }
      
      setQuoteMetadata({ quoteId: savedQuote.id, status: savedQuote.status });
      return savedQuote;
    } catch (error) {
      console.error("Save error:", error);
      useToastStore.getState().addToast("Failed to save quotation: " + error.message, "error");
      return null;
    }
  },
}));