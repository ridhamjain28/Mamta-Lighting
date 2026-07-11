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

  customerDirectory: [], // Autocomplete directory for customers

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

  fetchCustomerDirectory: async () => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('customer_name, phone_number, project_name, created_at')
        .not('customer_name', 'is', null)
        .neq('customer_name', '')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      const seen = new Set();
      const uniqueCustomers = [];
      
      for (const row of (data || [])) {
        const nameClean = (row.customer_name || '').trim();
        const phoneClean = (row.phone_number || '').trim();
        const key = `${nameClean.toLowerCase()}-${phoneClean.toLowerCase()}`;
        if (nameClean && !seen.has(key)) {
          seen.add(key);
          uniqueCustomers.push({
            name: nameClean,
            phone: phoneClean,
            project: (row.project_name || '').trim()
          });
        }
      }
      
      set({ customerDirectory: uniqueCustomers });
    } catch (e) {
      console.error("Error fetching customer directory:", e);
    }
  },

  // --- ACTIONS ---
  setCustomer: (field, value) => set((state) => ({
    customer: { ...state.customer, [field]: value }
  })),

  setGlobalDiscount: (amount) => set({ globalDiscount: Number(amount) || 0 }),
  
  toggleGst: (included) => set({ gstIncluded: included }),
  toggleHideListPrice: (hide) => set({ hideListPrice: hide }),

  addItem: (product) => set((state) => {
    // Treat different wattages or descriptions of the same product as different cart items
    const compositeId = product.selected_wattage ? `${product.id}-${product.selected_wattage}` : product.id;
    const prodDesc = product.description || '';
    
    const exists = state.items.find(item => {
      const itemWattage = item.selected_wattage || '';
      const targetWattage = product.selected_wattage || '';
      const itemDesc = item.description || '';
      return item.id === product.id && itemWattage === targetWattage && itemDesc === prodDesc;
    });

    if (exists) {
      return { 
        items: state.items.map(item => {
          const itemWattage = item.selected_wattage || '';
          const targetWattage = product.selected_wattage || '';
          const itemDesc = item.description || '';
          if (item.id === product.id && itemWattage === targetWattage && itemDesc === prodDesc) {
            return { ...item, quantity: item.quantity + (product.quantity ?? 1) };
          }
          return item;
        }) 
      };
    }

    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const newCartItemId = `${compositeId}-${uniqueSuffix}`;

    return { 
      items: [...state.items, { 
        ...product, 
        cartItemId: newCartItemId,
        quantity: product.quantity ?? 1, 
        description: prodDesc,
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
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, discount_override: discount === '' ? '' : Number(discount), tax_paid_price: null } : item)
  })),

  updateItemDescription: (cartItemId, description) => set((state) => ({
    items: state.items.map(item => (item.cartItemId || item.id) === cartItemId ? { ...item, description } : item)
  })),

  duplicateItem: (cartItemId) => set((state) => {
    const itemToDuplicate = state.items.find(item => (item.cartItemId || item.id) === cartItemId);
    if (!itemToDuplicate) return {};
    
    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const baseId = itemToDuplicate.selected_wattage ? `${itemToDuplicate.id}-${itemToDuplicate.selected_wattage}` : itemToDuplicate.id;
    const newCartItemId = `${baseId}-${uniqueSuffix}`;
    
    const newItem = {
      ...itemToDuplicate,
      cartItemId: newCartItemId,
      description: itemToDuplicate.description ? `${itemToDuplicate.description} (Copy)` : ''
    };
    
    const index = state.items.findIndex(item => (item.cartItemId || item.id) === cartItemId);
    const newItems = [...state.items];
    newItems.splice(index + 1, 0, newItem);
    
    return { items: newItems };
  }),

  // Tax Paid Price: back-calculate discount from a GST-inclusive final price
  updateItemTaxPaidPrice: (cartItemId, taxPaidPrice) => set((state) => ({
    items: state.items.map(item => {
      if ((item.cartItemId || item.id) !== cartItemId) return item;
      
      if (taxPaidPrice === '' || taxPaidPrice === null || taxPaidPrice === undefined) {
        return { ...item, tax_paid_price: null, discount_override: '' };
      }
      
      const tpp = Number(taxPaidPrice);
      if (isNaN(tpp) || tpp <= 0) {
        return { ...item, tax_paid_price: null, discount_override: '' };
      }
      
      // Find pre-GST (net) price such that Math.ceil(net * 1.18) === tpp
      // Start with floor(tpp / 1.18) and check
      let preGst = Math.floor(tpp / 1.18);
      if (Math.ceil(preGst * 1.18) > tpp) {
        preGst = preGst - 1;
      } else if (Math.ceil((preGst + 1) * 1.18) <= tpp) {
        preGst = preGst + 1;
      }
      // Final verification: Math.ceil(preGst * 1.18) should equal tpp
      // If not exact, use the closest that doesn't exceed tpp
      if (Math.ceil(preGst * 1.18) !== tpp) {
        // Fallback: just use floor division
        preGst = Math.floor(tpp / 1.18);
      }
      
      // Get the list price for this item
      let listPrice = item.custom_price_override;
      if (listPrice === null || listPrice === undefined || listPrice === '' || Number(listPrice) === 0) {
        listPrice = item.base_price;
      } else {
        listPrice = Number(listPrice);
      }
      
      // Calculate discount percentage: how much off the list price to reach preGst
      const discountPct = listPrice > 0 ? ((listPrice - preGst) / listPrice) * 100 : 0;
      
      return { 
        ...item, 
        tax_paid_price: tpp,
        discount_override: Math.round(discountPct * 100) / 100 // round to 2 decimal places
      };
    })
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
      const netPrice = Math.ceil(Number((price - (price * (effectiveDiscount / 100))).toFixed(10)));
      return acc + (netPrice * item.quantity);
    }, 0);

    const afterDiscount = subtotal;
    const gstAmount = gstIncluded ? Math.ceil(afterDiscount * 0.18) : 0;
    const grandTotal = Math.ceil(afterDiscount + gstAmount);

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
          const finalPrice = Math.ceil(Number((itemPrice - (itemPrice * itemDisc / 100)).toFixed(10)));
          
          return {
            quotation_id: savedQuote.id,
            product_id: item.id,
            quantity: Number(item.quantity),
            base_price: item.base_price,
            discount_override: item.discount_override !== '' ? Number(item.discount_override) : null,
            custom_price_override: item.custom_price_override !== null ? Number(item.custom_price_override) : null,
            final_unit_price: finalPrice,
            line_total: finalPrice * Number(item.quantity),
            description: item.description || null
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