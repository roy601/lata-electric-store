/**
 * Business analytics for the AI assistant.
 *
 * Every number the assistant reports is computed here (or in the DB) —
 * the model only explains results. Pure functions take rows already
 * loaded by the fetchers at the bottom, so they can be unit-tested.
 *
 * Definitions (stated to the model in the system prompt too):
 *   booked    = orders not cancelled and not returned
 *   delivered = orders with status 'delivered' (realised revenue)
 *   All dates are Bangladesh time (UTC+6), currency ৳ BDT.
 */
const { supabase } = require('../config/db');

const TZ_OFFSET_MS   = 6 * 3600e3;               // Asia/Dhaka, no DST
const NOT_BOOKED     = new Set(['cancelled', 'returned']);
const DAY_MS         = 24 * 3600e3;

const round2 = (n) => Math.round((+n || 0) * 100) / 100;
const isBooked = (o) => !NOT_BOOKED.has(o.status);

/* ── Dates (Bangladesh time) ─────────────────────────────────────── */

/** 'YYYY-MM-DD' of a timestamp in Dhaka time */
const dhakaDate = (ts) => new Date(new Date(ts).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
const todayDhaka = () => dhakaDate(Date.now());
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS) + 1;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Validate/normalise a date range; defaults to the last `defaultDays` days including today. */
const resolveRange = (from, to, defaultDays = 30) => {
  const end   = to   && YMD.test(to)   ? to   : todayDhaka();
  const start = from && YMD.test(from) ? from : addDays(end, -(defaultDays - 1));
  if (start > end) throw new Error('"from" must be on or before "to".');
  if (daysBetween(start, end) > 3660) throw new Error('Date range too long (max 10 years).');
  return { from: start, to: end, days: daysBetween(start, end) };
};

/** UTC ISO bounds for a Dhaka date range (end exclusive) */
const rangeToUtc = ({ from, to }) => ({
  gte: new Date(Date.parse(from + 'T00:00:00Z') - TZ_OFFSET_MS).toISOString(),
  lt:  new Date(Date.parse(addDays(to, 1) + 'T00:00:00Z') - TZ_OFFSET_MS).toISOString(),
});

/** Bucket key for a Dhaka date */
const periodKey = (ymd, grain) => {
  if (grain === 'month') return ymd.slice(0, 7);
  if (grain === 'week') {                       // ISO week, keyed by its Monday
    const d   = new Date(ymd + 'T00:00:00Z');
    const dow = (d.getUTCDay() + 6) % 7;
    return addDays(ymd, -dow);
  }
  return ymd;
};

/** Phone shown to the model: first 3 + last 3 digits */
const maskPhone = (p) => {
  const s = String(p || '');
  return s.length <= 6 ? '***' : s.slice(0, 3) + '*'.repeat(s.length - 6) + s.slice(-3);
};

/** Cart lines of an order (items JSONB) */
const lines = (o) => (Array.isArray(o.items) ? o.items : []).map(i => ({
  id: +i.id, name: i.name, price: +i.price || 0, qty: +i.qty || 0,
}));

/* ── Pure calculations ───────────────────────────────────────────── */

const salesSummary = (orders, range) => {
  const booked    = orders.filter(isBooked);
  const delivered = orders.filter(o => o.status === 'delivered');
  const sum = (arr, f) => round2(arr.reduce((s, o) => s + (+o[f] || 0), 0));

  const byStatus = {};
  orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

  const byMethod = {};
  booked.forEach(o => {
    const m = o.payment_method || 'Unknown';
    byMethod[m] = byMethod[m] || { payment_method: m, orders: 0, revenue: 0 };
    byMethod[m].orders++;
    byMethod[m].revenue = round2(byMethod[m].revenue + (+o.total || 0));
  });

  const unpaid = booked.filter(o => !o.payment_paid);
  const bookedRevenue = sum(booked, 'total');

  return {
    period: range,
    orders_placed: orders.length,
    orders_by_status: byStatus,
    booked: {
      orders:            booked.length,
      revenue:           bookedRevenue,
      product_sales:     sum(booked, 'subtotal'),
      delivery_charges:  sum(booked, 'delivery_charge'),
      coupon_discounts:  sum(booked, 'coupon_discount'),
      units_sold:        booked.reduce((s, o) => s + lines(o).reduce((a, l) => a + l.qty, 0), 0),
      avg_order_value:   booked.length ? round2(bookedRevenue / booked.length) : 0,
    },
    delivered: { orders: delivered.length, revenue: sum(delivered, 'total') },
    not_marked_paid: { orders: unpaid.length, amount: sum(unpaid, 'total') },
    by_payment_method: Object.values(byMethod).sort((a, b) => b.revenue - a.revenue),
  };
};

const salesTrend = (orders, range, grain = 'day') => {
  const buckets = new Map();
  // zero-fill every period in the range so gaps are visible
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const k = periodKey(d, grain);
    if (!buckets.has(k)) buckets.set(k, { period: k, orders: 0, booked_revenue: 0, delivered_revenue: 0, units: 0 });
  }
  orders.forEach(o => {
    const b = buckets.get(periodKey(dhakaDate(o.created_at), grain));
    if (!b) return;
    if (isBooked(o)) {
      b.orders++;
      b.booked_revenue = round2(b.booked_revenue + (+o.total || 0));
      b.units += lines(o).reduce((a, l) => a + l.qty, 0);
    }
    if (o.status === 'delivered') b.delivered_revenue = round2(b.delivered_revenue + (+o.total || 0));
  });
  return { period: range, grain, rows: [...buckets.values()] };
};

/** Units/revenue per product from booked orders */
const productSales = (orders) => {
  const m = new Map();
  orders.filter(isBooked).forEach(o => {
    const seen = new Set();
    lines(o).forEach(l => {
      const r = m.get(l.id) || { units: 0, revenue: 0, orders: 0 };
      r.units += l.qty;
      r.revenue = round2(r.revenue + l.qty * l.price);
      if (!seen.has(l.id)) { r.orders++; seen.add(l.id); }
      m.set(l.id, r);
    });
  });
  return m;
};

const productPerformance = (orders, products, range, { sort = 'revenue', limit = 10, category_id = null, include_unsold = false } = {}) => {
  const sales = productSales(orders);
  const known = new Set(products.map(p => p.id));
  let rows = products
    .filter(p => category_id == null || p.category_id === category_id)
    .map(p => {
      const s = sales.get(p.id) || { units: 0, revenue: 0, orders: 0 };
      return {
        product_id: p.id, name: p.name, category: p.categories?.name || null,
        units_sold: s.units, revenue: s.revenue, orders: s.orders,
        current_stock: p.stock, price: +p.price, is_active: p.is_active, in_catalogue: true,
      };
    })
    .filter(r => include_unsold || r.units_sold > 0);

  // Sales of products that have since been deleted still count (name from the order line)
  if (category_id == null) {
    const names = new Map();
    orders.forEach(o => lines(o).forEach(l => names.set(l.id, l.name)));
    sales.forEach((s, id) => {
      if (!known.has(id)) rows.push({
        product_id: id, name: names.get(id), category: null,
        units_sold: s.units, revenue: s.revenue, orders: s.orders,
        current_stock: null, price: null, is_active: false, in_catalogue: false,
      });
    });
  }

  const key = sort === 'units' ? 'units_sold' : 'revenue';
  rows.sort((a, b) => include_unsold && sort === 'least'
    ? a.units_sold - b.units_sold
    : b[key] - a[key] || b.units_sold - a.units_sold);

  return {
    period: range,
    sorted_by: sort,
    products_with_sales: [...sales.keys()].length,
    rows: rows.slice(0, limit),
  };
};

const categoryPerformance = (orders, products, categories, range) => {
  const sales = productSales(orders);
  const byCat = new Map(categories.map(c => [c.id, { category_id: c.id, category: c.name, products: 0, units_sold: 0, revenue: 0 }]));
  const none    = { category_id: null, category: 'Uncategorised', products: 0, units_sold: 0, revenue: 0 };
  const deleted = { category_id: null, category: 'Deleted products (category unknown)', products: 0, units_sold: 0, revenue: 0 };
  const known = new Set();
  products.forEach(p => {
    known.add(p.id);
    const c = byCat.get(p.category_id) || none;
    const s = sales.get(p.id);
    c.products++;
    if (s) { c.units_sold += s.units; c.revenue = round2(c.revenue + s.revenue); }
  });
  sales.forEach((s, id) => {
    if (known.has(id)) return;
    deleted.units_sold += s.units;
    deleted.revenue = round2(deleted.revenue + s.revenue);
  });
  const rows = [...byCat.values(), ...(none.products ? [none] : []), ...(deleted.units_sold ? [deleted] : [])]
    .sort((a, b) => b.revenue - a.revenue);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  rows.forEach(r => { r.revenue_share_pct = total ? round2(r.revenue / total * 100) : 0; });
  return { period: range, rows };
};

const inventoryStatus = (products, orders, { window_days = 30, low_threshold = 5, only = 'all', limit = 25 } = {}) => {
  const sales = productSales(orders);
  let rows = products.filter(p => p.is_active !== false).map(p => {
    const s = sales.get(p.id) || { units: 0 };
    const avgDaily = s.units / window_days;
    const stock = +p.stock || 0;
    return {
      product_id: p.id, name: p.name, category: p.categories?.name || null,
      stock, price: +p.price, stock_value: round2(stock * (+p.price || 0)),
      [`units_sold_last_${window_days}d`]: s.units,
      avg_daily_sales: round2(avgDaily),
      days_of_cover: avgDaily > 0 ? Math.floor(stock / avgDaily) : null,
      status: stock <= 0 ? 'out_of_stock' : stock <= low_threshold ? 'low' : 'ok',
    };
  });
  const totals = {
    active_products: rows.length,
    out_of_stock: rows.filter(r => r.status === 'out_of_stock').length,
    low_stock: rows.filter(r => r.status === 'low').length,
    total_units_in_stock: rows.reduce((s, r) => s + r.stock, 0),
    total_stock_value_at_selling_price: round2(rows.reduce((s, r) => s + r.stock_value, 0)),
  };
  if (only === 'low')  rows = rows.filter(r => r.status !== 'ok');
  if (only === 'out')  rows = rows.filter(r => r.status === 'out_of_stock');
  // most urgent first: out of stock, then fewest days of cover, then lowest stock
  rows.sort((a, b) => (a.stock > 0) - (b.stock > 0)
    || (a.days_of_cover ?? Infinity) - (b.days_of_cover ?? Infinity)
    || a.stock - b.stock);
  return { sales_window_days: window_days, low_stock_threshold: low_threshold, totals, rows: rows.slice(0, limit) };
};

const customerInsights = (ordersInRange, firstOrderByPhone, range, limit = 10) => {
  const m = new Map();
  ordersInRange.filter(isBooked).forEach(o => {
    const c = m.get(o.customer_phone) || { name: o.customer_name, phone: maskPhone(o.customer_phone), city: o.customer_city, orders: 0, spent: 0, last_order: o.created_at };
    c.orders++;
    c.spent = round2(c.spent + (+o.total || 0));
    if (o.created_at > c.last_order) c.last_order = o.created_at;
    m.set(o.customer_phone, c);
  });
  const phones = [...m.keys()];
  const newCustomers = phones.filter(ph => dhakaDate(firstOrderByPhone.get(ph)) >= range.from).length;
  const rows = [...m.values()].sort((a, b) => b.spent - a.spent).slice(0, limit)
    .map(c => ({ ...c, last_order: dhakaDate(c.last_order) }));
  return {
    period: range,
    customers_who_ordered: phones.length,
    new_customers: newCustomers,
    returning_customers: phones.length - newCustomers,
    repeat_buyers_in_period: [...m.values()].filter(c => c.orders > 1).length,
    top_customers: rows,
  };
};

const couponPerformance = (orders, coupons, range) => {
  const used = new Map();
  orders.filter(o => isBooked(o) && o.coupon_code).forEach(o => {
    const u = used.get(o.coupon_code) || { uses: 0, discount_given: 0, order_revenue: 0 };
    u.uses++;
    u.discount_given = round2(u.discount_given + (+o.coupon_discount || 0));
    u.order_revenue  = round2(u.order_revenue + (+o.total || 0));
    used.set(o.coupon_code, u);
  });
  const rows = coupons.map(c => ({
    code: c.code, type: c.discount_type, value: +c.discount_value, is_active: c.is_active,
    expires_at: c.expires_at ? dhakaDate(c.expires_at) : null,
    lifetime_used: c.used_count || 0, usage_limit: c.usage_limit || null,
    ...(used.get(c.code) || { uses: 0, discount_given: 0, order_revenue: 0 }),
  })).sort((a, b) => b.uses - a.uses);
  return { period: range, note: 'Per-order coupon tracking starts from orders placed after 30 Sep 2026.', rows };
};

const returnsSummary = (orders, range) => {
  const cancelled = orders.filter(o => o.status === 'cancelled');
  const returned  = orders.filter(o => o.status === 'returned');
  const sum = (arr) => round2(arr.reduce((s, o) => s + (+o.total || 0), 0));
  return {
    period: range,
    orders_placed: orders.length,
    cancelled: { orders: cancelled.length, value: sum(cancelled) },
    returned:  { orders: returned.length,  value: sum(returned) },
    return_requested_open: orders.filter(o => o.status === 'return_requested').length,
    cancel_or_return_rate_pct: orders.length ? round2((cancelled.length + returned.length) / orders.length * 100) : 0,
    return_reasons: returned.filter(o => o.return_reason).map(o => ({ order_id: o.order_id, reason: o.return_reason })),
  };
};

/**
 * Simple, explainable demand forecast: average daily units over the
 * history window × horizon. Flags whether there is enough data and
 * compares the last 7 days with the rest of the window.
 */
const demandForecast = (orders, products, { history_days = 60, horizon_days = 30, product_id = null, limit = 15, storeFirstOrder = null } = {}) => {
  const today  = todayDhaka();
  const from   = addDays(today, -(history_days - 1));
  const recentFrom = addDays(today, -6);
  const per = new Map();
  orders.filter(isBooked).forEach(o => {
    const d = dhakaDate(o.created_at);
    if (d < from || d > today) return;
    lines(o).forEach(l => {
      const r = per.get(l.id) || { units: 0, recent: 0, days: new Set() };
      r.units += l.qty;
      if (d >= recentFrom) r.recent += l.qty;
      r.days.add(d);
      per.set(l.id, r);
    });
  });

  const storeHistoryDays = storeFirstOrder ? Math.min(history_days, daysBetween(dhakaDate(storeFirstOrder), today)) : 0;
  const effectiveDays = Math.max(1, storeHistoryDays || history_days);

  let rows = products
    .filter(p => (product_id == null ? p.is_active !== false : p.id === product_id))
    .map(p => {
      const r = per.get(p.id) || { units: 0, recent: 0, days: new Set() };
      const avg = r.units / effectiveDays;
      const olderDays = effectiveDays - 7;
      const olderAvg  = olderDays > 0 ? (r.units - r.recent) / olderDays : null;
      const forecast  = Math.round(avg * horizon_days);
      return {
        product_id: p.id, name: p.name, current_stock: +p.stock || 0,
        units_sold_in_history: r.units, days_with_sales: r.days.size,
        avg_daily_units: round2(avg),
        trend_last_7d_vs_before: olderAvg == null || (olderAvg === 0 && r.recent === 0) ? 'n/a'
          : olderAvg === 0 ? 'up (new demand)'
          : (r.recent / 7) > olderAvg * 1.2 ? 'up' : (r.recent / 7) < olderAvg * 0.8 ? 'down' : 'flat',
        forecast_units_next_period: forecast,
        stockout_risk: forecast > (+p.stock || 0),
        enough_data: storeHistoryDays >= 14 && r.days.size >= 3,
      };
    })
    .filter(r => product_id != null || r.units_sold_in_history > 0)
    .sort((a, b) => b.forecast_units_next_period - a.forecast_units_next_period);

  return {
    method: `average daily units over the last ${effectiveDays} day(s) of sales history × ${horizon_days} days`,
    history_window: {
      from, to: today, store_history_days_available: storeHistoryDays,
      booked_orders_in_window: orders.filter(o => isBooked(o) && dhakaDate(o.created_at) >= from).length,
    },
    horizon_days,
    caution: storeHistoryDays < 14
      ? 'The store has less than 14 days of order history in this window — treat forecasts as very rough.'
      : null,
    rows: rows.slice(0, limit),
  };
};

/* ── Fetchers (service_role; paginated past the 1000-row default) ── */

const ORDER_COLS = 'id, order_id, created_at, status, total, subtotal, delivery_charge, coupon_code, coupon_discount, payment_method, payment_paid, customer_name, customer_phone, customer_city, customer_district, items, return_reason';

const { fetchAll } = require('../utils/fetchAll');

const fetchOrders = (range, cols = ORDER_COLS) => {
  const { gte, lt } = rangeToUtc(range);
  return fetchAll(() => supabase.from('orders').select(cols).gte('created_at', gte).lt('created_at', lt).order('id'));
};
const fetchProducts   = () => fetchAll(() => supabase.from('products').select('id, name, price, stock, category_id, is_active, categories(name)').order('id'));
const fetchCategories = async () => (await supabase.from('categories').select('id, name, is_active').order('sort_order')).data || [];
const fetchCoupons    = async () => (await supabase.from('coupons').select('*')).data || [];
const fetchFirstOrderByPhone = async () => {
  const rows = await fetchAll(() => supabase.from('orders').select('customer_phone, created_at').order('id'));
  const m = new Map();
  rows.forEach(r => { if (!m.has(r.customer_phone) || r.created_at < m.get(r.customer_phone)) m.set(r.customer_phone, r.created_at); });
  return m;
};
const fetchStoreFirstOrder = async () =>
  (await supabase.from('orders').select('created_at').order('created_at').limit(1).maybeSingle()).data?.created_at || null;

module.exports = {
  // pure
  salesSummary, salesTrend, productPerformance, categoryPerformance, inventoryStatus,
  customerInsights, couponPerformance, returnsSummary, demandForecast,
  // helpers
  resolveRange, dhakaDate, todayDhaka, addDays, maskPhone, round2, isBooked, lines,
  // fetchers
  fetchOrders, fetchProducts, fetchCategories, fetchCoupons, fetchFirstOrderByPhone, fetchStoreFirstOrder,
};
