import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';

// A cart line is one product + one variant choice. `key` identifies the line;
// `id` is always the product id (that's what the server prices and stocks).
const lineKey = (id, variant) => variant ? `${id}::${variant}` : String(id);

// Highest quantity allowed for a line (stock unknown → no client-side cap)
const maxQty = (stock) => (Number.isFinite(+stock) && stock !== null ? Math.max(0, +stock) : Infinity);

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      /** Adds `qty` of a product. Returns how many were actually added (0 when stock is used up). */
      add(product, qty = 1) {
        const key   = lineKey(product.id, product.variant);
        const items = get().items;
        const existing = items.find(i => (i.key || String(i.id)) === key);
        // Stock is shared by every variant line of the same product
        const inCart = items.filter(i => i.id === product.id).reduce((s, i) => s + i.qty, 0);
        const room   = maxQty(product.stock ?? existing?.stock) - inCart;
        const addQty = Math.max(0, Math.min(qty, room));
        if (addQty === 0) return 0;

        if (existing) {
          set({ items: items.map(i => (i.key || String(i.id)) === key ? { ...i, ...product, key, qty: i.qty + addQty } : i) });
        } else {
          set({ items: [...items, { ...product, key, qty: addQty }] });
        }
        return addQty;
      },

      remove(key) {
        set({ items: get().items.filter(i => (i.key || String(i.id)) !== String(key)) });
      },

      update(key, qty) {
        if (qty < 1) { get().remove(key); return; }
        const items = get().items;
        const line  = items.find(i => (i.key || String(i.id)) === String(key));
        if (!line) return;
        const others = items.filter(i => i.id === line.id && i !== line).reduce((s, i) => s + i.qty, 0);
        const capped = Math.min(qty, Math.max(1, maxQty(line.stock) - others));
        set({ items: items.map(i => i === line ? { ...i, qty: capped } : i) });
      },

      /** Replace the whole cart (used to re-sync prices/stock with the database). */
      replace(items) { set({ items }); },

      clear() { set({ items: [] }); },
    }),
    { name: 'lata-cart' }
  )
);

/**
 * Shared "Add to Cart" used by every product button: respects stock,
 * tells the customer when the limit is reached, and opens the cart drawer.
 */
export function addToCart(p, { price, qty = 1, variant = '', open = true } = {}) {
  if (!(p.stock > 0)) { toast.error('Sorry, this product is out of stock'); return 0; }
  const added = useCartStore.getState().add({
    id: p.id,
    name: p.name,
    price: price ?? (p.flash_sale && p.flash_price ? p.flash_price : p.price),
    image: p.image,
    stock: p.stock,
    variant: variant || undefined,
  }, qty);
  if (added === 0) {
    toast.error(`Only ${p.stock} in stock — all of them are already in your cart`);
  } else {
    if (added < qty) toast(`Only ${added} more could be added (stock limit)`);
    if (open) window.dispatchEvent(new CustomEvent('lata:open-cart'));
  }
  return added;
}

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
