import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      add(product) {
        const items = get().items;
        const existing = items.find(i => i.id === product.id);
        if (existing) {
          set({ items: items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) });
        } else {
          set({ items: [...items, { ...product, qty: 1 }] });
        }
      },

      remove(id) {
        set({ items: get().items.filter(i => i.id !== id) });
      },

      update(id, qty) {
        if (qty < 1) { get().remove(id); return; }
        set({ items: get().items.map(i => i.id === id ? { ...i, qty } : i) });
      },

      clear() { set({ items: [] }); },

      get count()  { return get().items.reduce((s, i) => s + i.qty, 0); },
      get total()  { return get().items.reduce((s, i) => s + i.qty * (i.flash_price || i.price), 0); },
    }),
    { name: 'lata-cart' }
  )
);

export const useWishlistStore = create(
  persist(
    (set, get) => ({
      ids: [],
      toggle(id) {
        const ids = get().ids;
        set({ ids: ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id] });
      },
      has(id) { return get().ids.includes(id); },
    }),
    { name: 'lata-wishlist' }
  )
);
