/* store.js — shared localStorage data store for Lata Electric
   Works for both customer (assets/js/store.js) and admin (../../assets/js/store.js)
*/

const Store = (() => {
  const K = {
    products:   'lata_products',
    categories: 'lata_categories',
    orders:     'lata_orders',
    customers:  'lata_customers',
    settings:   'lata_settings',
    wishlist:   'lata_wishlist',
    seeded:     'lata_seeded'
  };

  const read  = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---- detect base path for fetching JSON ---- */
  function basePath() {
    const depth = location.pathname.replace(/\/[^/]*$/, '').split('/').filter(Boolean).length;
    const isAdmin = location.pathname.includes('/admin');
    if (isAdmin) {
      const adminDepth = location.pathname.split('/admin')[1].split('/').filter(Boolean).length;
      return '../'.repeat(adminDepth + 1);
    }
    return depth === 0 ? '' : '../'.repeat(depth);
  }

  /* ---- seed on first ever load ---- */
  async function init() {
    if (read(K.seeded)) return;
    const base = basePath();
    try {
      const [cats, prods] = await Promise.all([
        fetch(base + 'data/categories.json').then(r => r.json()),
        fetch(base + 'data/products.json').then(r => r.json())
      ]);
      write(K.categories, cats);
      write(K.products, prods);
    } catch(e) {
      write(K.categories, []);
      write(K.products, []);
    }
    if (!read(K.orders))    write(K.orders, []);
    if (!read(K.customers)) write(K.customers, []);
    if (!read(K.settings)) {
      write(K.settings, {
        siteName: 'Lata Electric',
        phone: '01700-000000',
        address: 'Ka/6 Nadda, Gulshan, Dhaka-1212',
        email: 'info@lataelectric.com',
        freeDeliveryThreshold: 1000,
        shipping: { inside: 60, outside: 120 },
        paymentMethods: ['Cash on Delivery', 'bKash', 'Nagad'],
        bkashNumber: '',
        nagadNumber: '',
        adminPassword: 'admin123',
        heroTitle: "Bangladesh's Trusted Electrical & Hardware Shop",
        heroSubtitle: 'Quality electrical products, tools, lighting, fans, CCTV & more — all under one roof in Gulshan, Dhaka.',
        announcementBar: 'Free Delivery on Orders Above ৳1000',
        flashSaleActive: false,
        flashSaleEnds: ''
      });
    }
    write(K.seeded, true);
  }

  /* =========== PRODUCTS =========== */
  const products = {
    all:         ()     => read(K.products) || [],
    featured:    ()     => (read(K.products)||[]).filter(p => p.featured),
    topSells:    ()     => (read(K.products)||[]).filter(p => p.topSell),
    flashSale:   ()     => (read(K.products)||[]).filter(p => p.flashSale),
    byCategory:  id     => (read(K.products)||[]).filter(p => p.categoryId === +id),
    byId:        id     => (read(K.products)||[]).find(p => p.id === +id),
    search:      q      => { const s = q.toLowerCase(); return (read(K.products)||[]).filter(p => p.name.toLowerCase().includes(s) || (p.brand||'').toLowerCase().includes(s)); },

    add(p) {
      const list = read(K.products) || [];
      const id   = list.length ? Math.max(...list.map(x => x.id)) + 1 : 1;
      const item = { ...p, id, createdAt: Date.now() };
      list.push(item);
      write(K.products, list);
      return id;
    },
    update(id, data) {
      const list = read(K.products) || [];
      const i    = list.findIndex(p => p.id === +id);
      if (i !== -1) { list[i] = { ...list[i], ...data }; write(K.products, list); }
    },
    delete(id) {
      write(K.products, (read(K.products)||[]).filter(p => p.id !== +id));
    }
  };

  /* =========== CATEGORIES =========== */
  const categories = {
    all:    ()  => read(K.categories) || [],
    byId:   id  => (read(K.categories)||[]).find(c => c.id === +id),
    update(id, data) {
      const list = read(K.categories) || [];
      const i    = list.findIndex(c => c.id === +id);
      if (i !== -1) { list[i] = { ...list[i], ...data }; write(K.categories, list); }
    },
    add(cat) {
      const list = read(K.categories) || [];
      const id   = list.length ? Math.max(...list.map(c => c.id)) + 1 : 1;
      list.push({ ...cat, id });
      write(K.categories, list);
      return id;
    },
    delete(id) {
      write(K.categories, (read(K.categories)||[]).filter(c => c.id !== +id));
    }
  };

  /* =========== ORDERS =========== */
  const orders = {
    all:   ()  => (read(K.orders) || []).sort((a,b) => b.createdAt - a.createdAt),
    byId:  id  => (read(K.orders)||[]).find(o => o.id === id),

    place(orderData) {
      const list = read(K.orders) || [];
      const id   = 'LE' + Date.now();
      const order = { ...orderData, id, status: 'pending', createdAt: Date.now() };
      list.unshift(order);
      write(K.orders, list);
      /* Deduct stock */
      (orderData.items || []).forEach(item => {
        const p = products.byId(item.id);
        if (p) products.update(item.id, { stock: Math.max(0, p.stock - item.qty) });
      });
      return id;
    },
    updateStatus(id, status) {
      const list = read(K.orders) || [];
      const i    = list.findIndex(o => o.id === id);
      if (i !== -1) { list[i].status = status; write(K.orders, list); }
    },
    delete(id) { write(K.orders, (read(K.orders)||[]).filter(o => o.id !== id)); },

    stats() {
      const list = read(K.orders) || [];
      return {
        total:    list.length,
        pending:  list.filter(o => o.status === 'pending').length,
        shipped:  list.filter(o => o.status === 'shipped').length,
        delivered:list.filter(o => o.status === 'delivered').length,
        cancelled:list.filter(o => o.status === 'cancelled').length,
        revenue:  list.filter(o => o.status !== 'cancelled').reduce((s,o) => s + (o.total||0), 0)
      };
    }
  };

  /* =========== CUSTOMERS =========== */
  const customers = {
    all:  () => read(K.customers) || [],
    byId: id => (read(K.customers)||[]).find(c => c.id === +id),
    add(c) {
      const list = read(K.customers) || [];
      const id   = list.length ? Math.max(...list.map(x => x.id)) + 1 : 1;
      list.push({ ...c, id, createdAt: Date.now() });
      write(K.customers, list);
      return id;
    },
    delete(id) { write(K.customers, (read(K.customers)||[]).filter(c => c.id !== +id)); }
  };

  /* =========== SETTINGS =========== */
  const settings = {
    get:    ()     => read(K.settings) || {},
    update: data   => write(K.settings, { ...(read(K.settings)||{}), ...data })
  };

  /* =========== WISHLIST =========== */
  const wishlist = {
    all:    ()   => read(K.wishlist) || [],
    has:    id   => (read(K.wishlist)||[]).includes(+id),
    toggle: id   => {
      const list = read(K.wishlist) || [];
      const i    = list.indexOf(+id);
      i === -1 ? list.push(+id) : list.splice(i, 1);
      write(K.wishlist, list);
      return i === -1;
    }
  };

  /* =========== AUTH =========== */
  const auth = {
    login:     pw  => { const ok = pw === (settings.get().adminPassword || 'admin123'); if (ok) sessionStorage.setItem('lata_admin', '1'); return ok; },
    logout:    ()  => sessionStorage.removeItem('lata_admin'),
    isLoggedIn:()  => sessionStorage.getItem('lata_admin') === '1'
  };

  return { init, products, categories, orders, customers, settings, wishlist, auth };
})();
