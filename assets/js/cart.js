/* cart.js — lightweight localStorage cart */

const Cart = (() => {
  const KEY = 'lata_cart';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadge();
  }

  function updateBadge() {
    const total = load().reduce((sum, i) => sum + i.qty, 0);
    document.querySelectorAll('#cartCount').forEach(el => {
      el.textContent = total;
      el.style.display = total ? 'inline' : 'none';
    });
  }

  function add(product) {
    const items = load();
    const existing = items.find(i => i.id === product.id);
    if (existing) existing.qty += 1;
    else items.push({ ...product, qty: 1 });
    save(items);
  }

  function remove(id) {
    save(load().filter(i => i.id !== id));
  }

  function clear() {
    save([]);
  }

  function getAll() {
    return load();
  }

  function update(id, qty) {
    const items = load();
    const item  = items.find(i => i.id === id);
    if (item) item.qty = qty;
    save(items);
  }

  /* Run badge update on every page load */
  document.addEventListener('DOMContentLoaded', updateBadge);

  return { add, remove, update, clear, getAll };
})();
