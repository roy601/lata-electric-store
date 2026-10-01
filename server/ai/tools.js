/**
 * Tools the admin assistant may call. All are READ-ONLY.
 *
 * Rules:
 *  • The model never chooses tables or writes queries — each tool is a fixed,
 *    validated backend operation with row limits.
 *  • Numbers come from ./analytics.js or the DB, never from the model.
 *  • Customer phone numbers are masked; addresses are never sent to the model.
 *  • Each tool may return `display` — a table rendered in the admin UI straight
 *    from backend data, so figures shown are never retyped by the model.
 */
const { supabase } = require('../config/db');
const A            = require('./analytics');
const { calculate } = require('./calculator');

/* ── Input validation helpers ────────────────────────────────────── */
const int = (v, def, min, max) => {
  if (v === undefined || v === null || v === '') return def;
  const n = Math.trunc(+v);
  if (!Number.isFinite(n)) throw new Error(`Expected a whole number, got "${v}".`);
  return Math.min(max, Math.max(min, n));
};
const oneOf = (v, allowed, def) => {
  if (v === undefined || v === null || v === '') return def;
  if (!allowed.includes(v)) throw new Error(`Must be one of: ${allowed.join(', ')}.`);
  return v;
};
const str = (v, max = 200) => (v === undefined || v === null ? null : String(v).slice(0, max).trim() || null);
const bool = (v) => (v === undefined || v === null ? null : v === true || v === 'true');

const DATE = { type: 'string', description: 'YYYY-MM-DD (Bangladesh date)' };
const RANGE_PROPS = {
  from: { ...DATE, description: 'Start date YYYY-MM-DD (inclusive). Default: 30 days ago.' },
  to:   { ...DATE, description: 'End date YYYY-MM-DD (inclusive). Default: today.' },
};
const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

const table = (title, rows, columns) => ({
  title,
  columns: columns || (rows[0] ? Object.keys(rows[0]) : []),
  rows: rows.map(r => (columns || Object.keys(r)).map(c => r[c] ?? null)),
});

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];

/* ── Tool definitions ────────────────────────────────────────────── */
const TOOLS = [
  {
    name: 'get_store_overview',
    description: 'Quick snapshot: store info, product/category counts, stock alerts, and sales for today, the last 7 days and the last 30 days. Good first call for broad questions.',
    input_schema: schema(),
    run: async () => {
      const [settings, products, cats] = await Promise.all([
        supabase.from('settings').select('site_name, phone, address, hours, flash_sale_active, flash_sale_ends').eq('id', 1).maybeSingle(),
        A.fetchProducts(), A.fetchCategories(),
      ]);
      const r30 = A.resolveRange(null, null, 30);
      const orders = await A.fetchOrders(r30);
      const today = A.todayDhaka(), d7 = A.addDays(today, -6);
      const inRange = (from) => orders.filter(o => A.dhakaDate(o.created_at) >= from);
      const s = (arr, range) => { const x = A.salesSummary(arr, range); return { orders: x.orders_placed, booked_revenue: x.booked.revenue, delivered_revenue: x.delivered.revenue }; };
      const inv = A.inventoryStatus(products, [], { only: 'all' }).totals;
      const result = {
        store: settings.data,
        catalogue: { products: products.length, active_products: products.filter(p => p.is_active !== false).length, categories: cats.length },
        stock: { out_of_stock: inv.out_of_stock, low_stock_5_or_less: inv.low_stock },
        sales: {
          today:        s(inRange(today), { from: today, to: today }),
          last_7_days:  s(inRange(d7), { from: d7, to: today }),
          last_30_days: s(orders, r30),
        },
      };
      return { result, display: table('Sales snapshot', [
        { period: 'Today', ...result.sales.today },
        { period: 'Last 7 days', ...result.sales.last_7_days },
        { period: 'Last 30 days', ...result.sales.last_30_days },
      ]) };
    },
  },
  {
    name: 'sales_summary',
    description: 'Totals for a date range: orders by status, booked revenue, delivered revenue, product sales, delivery charges, coupon discounts, units, average order value, unpaid orders, and revenue by payment method.',
    input_schema: schema(RANGE_PROPS),
    run: async (i) => {
      const range = A.resolveRange(i.from, i.to);
      const result = A.salesSummary(await A.fetchOrders(range), range);
      return { result, display: table(`Sales ${range.from} → ${range.to}`, [
        { metric: 'Orders placed', value: result.orders_placed },
        { metric: 'Booked orders (excl. cancelled/returned)', value: result.booked.orders },
        { metric: 'Booked revenue ৳', value: result.booked.revenue },
        { metric: 'Delivered revenue ৳', value: result.delivered.revenue },
        { metric: 'Product sales ৳', value: result.booked.product_sales },
        { metric: 'Delivery charges ৳', value: result.booked.delivery_charges },
        { metric: 'Coupon discounts ৳', value: result.booked.coupon_discounts },
        { metric: 'Units sold', value: result.booked.units_sold },
        { metric: 'Average order value ৳', value: result.booked.avg_order_value },
        { metric: 'Not marked paid ৳', value: result.not_marked_paid.amount },
      ]) };
    },
  },
  {
    name: 'sales_trend',
    description: 'Revenue and orders per day, week (Monday start) or month across a date range, zero-filled, for spotting trends.',
    input_schema: schema({ ...RANGE_PROPS, grain: { type: 'string', enum: ['day', 'week', 'month'], description: 'Default day.' } }),
    run: async (i) => {
      const range = A.resolveRange(i.from, i.to);
      const grain = oneOf(i.grain, ['day', 'week', 'month'], 'day');
      if (grain === 'day' && range.days > 120) throw new Error('Use grain "week" or "month" for ranges over 120 days.');
      const result = A.salesTrend(await A.fetchOrders(range), range, grain);
      return { result, display: table(`Sales by ${grain}`, result.rows) };
    },
  },
  {
    name: 'product_performance',
    description: 'Best (or worst) selling products in a date range by revenue or units. Includes products that were later deleted (in_catalogue=false). Set include_unsold=true with sort="least" to find products with no/low sales.',
    input_schema: schema({
      ...RANGE_PROPS,
      sort: { type: 'string', enum: ['revenue', 'units', 'least'] },
      limit: { type: 'integer', description: '1-50, default 10' },
      category_id: { type: 'integer' },
      include_unsold: { type: 'boolean' },
    }),
    run: async (i) => {
      const range = A.resolveRange(i.from, i.to);
      const [orders, products] = await Promise.all([A.fetchOrders(range), A.fetchProducts()]);
      const result = A.productPerformance(orders, products, range, {
        sort: oneOf(i.sort, ['revenue', 'units', 'least'], 'revenue'),
        limit: int(i.limit, 10, 1, 50),
        category_id: i.category_id == null ? null : int(i.category_id, null, 1, 1e9),
        include_unsold: !!bool(i.include_unsold),
      });
      return { result, display: table('Product performance', result.rows,
        ['product_id', 'name', 'category', 'units_sold', 'revenue', 'orders', 'current_stock', 'in_catalogue']) };
    },
  },
  {
    name: 'category_performance',
    description: 'Revenue, units and revenue share per category in a date range.',
    input_schema: schema(RANGE_PROPS),
    run: async (i) => {
      const range = A.resolveRange(i.from, i.to);
      const [orders, products, cats] = await Promise.all([A.fetchOrders(range), A.fetchProducts(), A.fetchCategories()]);
      const result = A.categoryPerformance(orders, products, cats, range);
      return { result, display: table('Category performance', result.rows) };
    },
  },
  {
    name: 'inventory_status',
    description: 'Stock levels with sales velocity: units sold in a recent window, average daily sales, days of stock cover, and status (out_of_stock/low/ok). Sorted most urgent first.',
    input_schema: schema({
      only: { type: 'string', enum: ['all', 'low', 'out'], description: 'Default "low" (low + out of stock).' },
      low_stock_threshold: { type: 'integer', description: 'Default 5' },
      sales_window_days: { type: 'integer', description: 'Days of sales used for velocity, 7-180, default 30' },
      limit: { type: 'integer', description: '1-60, default 25' },
    }),
    run: async (i) => {
      const window_days = int(i.sales_window_days, 30, 7, 180);
      const [products, orders] = await Promise.all([A.fetchProducts(), A.fetchOrders(A.resolveRange(null, null, window_days))]);
      const result = A.inventoryStatus(products, orders, {
        window_days, low_threshold: int(i.low_stock_threshold, 5, 0, 1000),
        only: oneOf(i.only, ['all', 'low', 'out'], 'low'), limit: int(i.limit, 25, 1, 60),
      });
      return { result, display: table('Inventory', result.rows) };
    },
  },
  {
    name: 'demand_forecast',
    description: 'Statistical demand forecast per product (average daily units × horizon) with trend and stock-out risk. Always report the method and the enough_data flag / caution to the user.',
    input_schema: schema({
      product_id: { type: 'integer', description: 'Optional: one product' },
      history_days: { type: 'integer', description: '14-365, default 60' },
      horizon_days: { type: 'integer', description: '7-90, default 30' },
      limit: { type: 'integer', description: '1-30, default 15' },
    }),
    run: async (i) => {
      const history_days = int(i.history_days, 60, 14, 365);
      const [orders, products, storeFirstOrder] = await Promise.all([
        A.fetchOrders(A.resolveRange(null, null, history_days)), A.fetchProducts(), A.fetchStoreFirstOrder(),
      ]);
      const result = A.demandForecast(orders, products, {
        history_days, horizon_days: int(i.horizon_days, 30, 7, 90),
        product_id: i.product_id == null ? null : int(i.product_id, null, 1, 1e9),
        limit: int(i.limit, 15, 1, 30), storeFirstOrder,
      });
      return { result, display: table(`Demand forecast (next ${result.horizon_days} days)`, result.rows) };
    },
  },
  {
    name: 'search_products',
    description: 'Find products by name/brand/SKU text, category, stock level, flags or active state. Returns key fields (not full descriptions).',
    input_schema: schema({
      query: { type: 'string' },
      category_id: { type: 'integer' },
      is_active: { type: 'boolean' },
      max_stock: { type: 'integer', description: 'Only products with stock <= this' },
      flag: { type: 'string', enum: ['featured', 'top_sell', 'trending', 'flash_sale'] },
      limit: { type: 'integer', description: '1-50, default 20' },
    }),
    run: async (i) => {
      let q = supabase.from('products')
        .select('id, name, brand, sku, price, original_price, stock, is_active, featured, top_sell, trending, flash_sale, flash_price, category_id, categories(name)')
        .order('name').limit(int(i.limit, 20, 1, 50));
      const text = str(i.query, 80);
      if (text) {
        const safe = text.replace(/[%_,()"\\*:]/g, ' ');   // keep it a plain value inside the PostgREST or() filter
        q = q.or(`name.ilike.%${safe}%,brand.ilike.%${safe}%,sku.ilike.%${safe}%`);
      }
      if (i.category_id != null) q = q.eq('category_id', int(i.category_id, null, 1, 1e9));
      if (bool(i.is_active) !== null) q = q.eq('is_active', bool(i.is_active));
      if (i.max_stock != null) q = q.lte('stock', int(i.max_stock, 0, 0, 1e9));
      if (i.flag) q = q.eq(oneOf(i.flag, ['featured', 'top_sell', 'trending', 'flash_sale']), true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = data.map(p => ({ ...p, category: p.categories?.name || null, categories: undefined }));
      return { result: { count: rows.length, products: rows }, display: table('Products', rows,
        ['id', 'name', 'brand', 'sku', 'price', 'stock', 'category', 'is_active']) };
    },
  },
  {
    name: 'get_product',
    description: 'Full details of one product: description, specifications, variants, pricing, flags, stock, sales in the last 90 days, and recent stock movements.',
    input_schema: schema({ product_id: { type: 'integer' } }, ['product_id']),
    run: async (i) => {
      const id = int(i.product_id, null, 1, 1e9);
      const { data: p, error } = await supabase.from('products').select('*, categories(name)').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!p) return { result: { found: false, message: `No product with id ${id}.` } };
      const range = A.resolveRange(null, null, 90);
      const [orders, movements] = await Promise.all([
        A.fetchOrders(range),
        supabase.from('inventory_movements').select('change, stock_after, reason, created_at').eq('product_id', id).order('created_at', { ascending: false }).limit(10),
      ]);
      const sales = A.productPerformance(orders, [p], range, { include_unsold: true, limit: 1 }).rows[0];
      return { result: {
        ...p, category: p.categories?.name || null, categories: undefined,
        description: p.description ? String(p.description).slice(0, 3000) : null,
        sales_last_90_days: { units: sales?.units_sold || 0, revenue: sales?.revenue || 0, orders: sales?.orders || 0 },
        recent_stock_movements: movements.error ? 'not available yet' : movements.data,
      } };
    },
  },
  {
    name: 'list_categories',
    description: 'All categories with their product counts and subcategory groups.',
    input_schema: schema(),
    run: async () => {
      const [cats, subs] = await Promise.all([
        supabase.from('categories').select('id, name, is_active, sort_order, products(count)').order('sort_order'),
        supabase.from('subcategories').select('category_id, header, items').order('sort_order'),
      ]);
      if (cats.error) throw new Error(cats.error.message);
      const rows = cats.data.map(c => ({
        id: c.id, name: c.name, is_active: c.is_active, products: c.products?.[0]?.count ?? 0,
        subcategory_groups: (subs.data || []).filter(s => s.category_id === c.id).map(s => ({ header: s.header, items: s.items })),
      }));
      return { result: { categories: rows }, display: table('Categories', rows, ['id', 'name', 'is_active', 'products']) };
    },
  },
  {
    name: 'search_orders',
    description: 'List orders filtered by status, date range, payment method, paid flag, customer phone or order ID. Customer phones are masked; addresses are not included.',
    input_schema: schema({
      ...RANGE_PROPS,
      status: { type: 'string', enum: STATUSES },
      payment_method: { type: 'string' },
      paid: { type: 'boolean' },
      customer_phone: { type: 'string', description: 'Exact phone number as typed by the admin' },
      order_id: { type: 'string', description: 'e.g. LEWIAWTS' },
      limit: { type: 'integer', description: '1-50, default 20' },
    }),
    run: async (i) => {
      let q = supabase.from('orders')
        .select('order_id, created_at, status, total, payment_method, payment_paid, customer_name, customer_phone, customer_city, items')
        .order('created_at', { ascending: false }).limit(int(i.limit, 20, 1, 50));
      if (i.from || i.to) {
        const range = A.resolveRange(i.from, i.to, 3660);
        const { gte, lt } = { gte: new Date(Date.parse(range.from + 'T00:00:00+06:00')).toISOString(), lt: new Date(Date.parse(A.addDays(range.to, 1) + 'T00:00:00+06:00')).toISOString() };
        q = q.gte('created_at', gte).lt('created_at', lt);
      }
      if (i.status) q = q.eq('status', oneOf(i.status, STATUSES));
      if (i.payment_method) q = q.eq('payment_method', str(i.payment_method, 40));
      if (bool(i.paid) !== null) q = q.eq('payment_paid', bool(i.paid));
      if (i.customer_phone) q = q.eq('customer_phone', str(i.customer_phone, 20));
      if (i.order_id) q = q.eq('order_id', str(i.order_id, 20).toUpperCase());
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = data.map(o => ({
        order_id: o.order_id, date: A.dhakaDate(o.created_at), status: o.status, total: +o.total,
        payment_method: o.payment_method, paid: o.payment_paid,
        customer: o.customer_name, phone: A.maskPhone(o.customer_phone), city: o.customer_city,
        items: A.lines(o).reduce((s, l) => s + l.qty, 0),
      }));
      return { result: { count: rows.length, orders: rows }, display: table('Orders', rows) };
    },
  },
  {
    name: 'get_order',
    description: 'One order in detail: line items, totals, coupon, payment, status and status history. Phone masked, no address.',
    input_schema: schema({ order_id: { type: 'string', description: 'e.g. LEWIAWTS' } }, ['order_id']),
    run: async (i) => {
      const { data: o, error } = await supabase.from('orders').select('*').eq('order_id', str(i.order_id, 20).toUpperCase()).maybeSingle();
      if (error) throw new Error(error.message);
      if (!o) return { result: { found: false, message: `No order ${i.order_id}.` } };
      const hist = await supabase.from('order_status_history').select('status, changed_at').eq('order_id', o.id).order('changed_at');
      return { result: {
        order_id: o.order_id, placed: o.created_at, status: o.status,
        customer: o.customer_name, phone: A.maskPhone(o.customer_phone), city: o.customer_city, district: o.customer_district,
        items: A.lines(o), subtotal: +o.subtotal, delivery_charge: +o.delivery_charge,
        coupon_code: o.coupon_code || null, coupon_discount: +o.coupon_discount || 0, total: +o.total,
        payment_method: o.payment_method, payment_paid: o.payment_paid,
        customer_notes: o.notes || null, return_reason: o.return_reason || null,
        status_history: hist.error ? 'not available yet' : hist.data,
      }, display: table(`Order ${o.order_id}`, A.lines(o).map(l => ({ ...l, line_total: A.round2(l.price * l.qty) }))) };
    },
  },
  {
    name: 'customer_insights',
    description: 'Customers who ordered in a date range: new vs returning, repeat buyers, and top customers by spend (phones masked).',
    input_schema: schema({ ...RANGE_PROPS, limit: { type: 'integer', description: '1-50, default 10' } }),
    run: async (i) => {
      const range = A.resolveRange(i.from, i.to);
      const [orders, first] = await Promise.all([A.fetchOrders(range), A.fetchFirstOrderByPhone()]);
      const result = A.customerInsights(orders, first, range, int(i.limit, 10, 1, 50));
      return { result, display: table('Top customers', result.top_customers) };
    },
  },
  {
    name: 'coupon_performance',
    description: 'Each coupon: settings, lifetime uses, and uses / discount given / order revenue within a date range.',
    input_schema: schema(RANGE_PROPS),
    run: async (i) => {
      const range = A.resolveRange(i.from, i.to);
      const [orders, coupons] = await Promise.all([A.fetchOrders(range), A.fetchCoupons()]);
      const result = A.couponPerformance(orders, coupons, range);
      return { result, display: table('Coupons', result.rows) };
    },
  },
  {
    name: 'returns_and_cancellations',
    description: 'Cancelled and returned orders in a date range: counts, value, rate, open return requests and return reasons.',
    input_schema: schema(RANGE_PROPS),
    run: async (i) => {
      const range = A.resolveRange(i.from, i.to);
      return { result: A.returnsSummary(await A.fetchOrders(range), range) };
    },
  },
  {
    name: 'get_store_settings',
    description: 'Store policies and configuration customers ask about: contact, hours, shipping rates and delivery times, free-delivery threshold, payment methods, flash sale status.',
    input_schema: schema(),
    run: async () => {
      const { data, error } = await supabase.from('settings')
        .select('site_name, phone, email, address, hours, shipping_inside, shipping_outside, free_delivery_threshold, delivery_time_inside, delivery_time_outside, payment_methods, flash_sale_active, flash_sale_ends')
        .eq('id', 1).maybeSingle();
      if (error) throw new Error(error.message);
      return { result: { ...data, inside_dhaka_districts: require('../services/orderPricing').INSIDE_DHAKA } };
    },
  },
  {
    name: 'calculate',
    description: 'Evaluate an arithmetic expression exactly (+ - * / % ^ and parentheses). Use this for ANY maths not already returned by another tool — never calculate in your head.',
    input_schema: schema({ expression: { type: 'string', description: 'e.g. (4480-3380)/4480*100' } }, ['expression']),
    run: async (i) => ({ result: { expression: i.expression, value: calculate(i.expression) } }),
  },
];

const BY_NAME = new Map(TOOLS.map(t => [t.name, t]));

/** Definitions in the shape the model API expects (no handlers). */
const toolDefinitions = () => TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));

/** Run one tool; never throws — errors become a result the model can read. */
const runTool = async (name, input) => {
  const tool = BY_NAME.get(name);
  if (!tool) return { ok: false, error: `Unknown tool "${name}".` };
  try {
    const { result, display } = await tool.run(input && typeof input === 'object' ? input : {});
    return { ok: true, result, display };
  } catch (err) {
    return { ok: false, error: err.message || 'Tool failed.' };
  }
};

module.exports = { toolDefinitions, runTool, TOOLS };
