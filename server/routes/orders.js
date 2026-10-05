const express  = require('express');
const router   = express.Router();
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const { protectCustomer, optionalCustomer } = require('../middleware/customerAuthMiddleware');
const { validId }            = require('../utils/crudRouter');
const { priceOrder, PricingError } = require('../services/orderPricing');
const { fetchAll } = require('../utils/fetchAll');
const rateLimit    = require('express-rate-limit');

// Adding past orders needs order ID + phone — limit guessing
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

const genOrderId = () => 'LE' + Date.now().toString(36).toUpperCase().slice(-6);

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];

/* ── Public: place order ────────────────────────────────────────── */
router.post('/', optionalCustomer, async (req, res) => {
  const {
    customer_name, customer_phone, customer_address,
    customer_city, customer_district, customer_email, order_notes,
    items, total, payment_method, transaction_id, coupon_code,
  } = req.body;

  if (!customer_name || !customer_phone || !customer_address) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return res.status(400).json({ success: false, message: 'No items in order' });
  }

  // Load everything the price check needs from the DB — never trust the client's numbers
  const ids  = [...new Set(items.map(i => +i.id).filter(Number.isInteger))];
  const code = coupon_code ? String(coupon_code).toUpperCase().trim() : null;
  const [prodRes, setRes, couponRes] = await Promise.all([
    supabase.from('products').select('id, name, price, flash_sale, flash_price, variants, image, is_active, stock').in('id', ids),
    supabase.from('settings').select('shipping_inside, shipping_outside, free_delivery_threshold, payment_methods').eq('id', 1).maybeSingle(),
    code ? supabase.from('coupons').select('*').eq('code', code).maybeSingle() : Promise.resolve({ data: undefined }),
  ]);
  if (prodRes.error || setRes.error) {
    return res.status(500).json({ success: false, message: 'Could not place order. Please try again.' });
  }

  const method  = payment_method || 'Cash on Delivery';
  const allowed = setRes.data?.payment_methods?.length ? setRes.data.payment_methods : ['Cash on Delivery'];
  if (!allowed.includes(method)) {
    return res.status(400).json({ success: false, message: 'This payment method is not available.' });
  }

  let priced;
  try {
    priced = priceOrder({
      items,
      products:    new Map(prodRes.data.map(p => [p.id, p])),
      settings:    setRes.data,
      coupon:      code ? (couponRes.data || null) : undefined,
      district:    customer_district,
      clientTotal: total,
    });
  } catch (err) {
    if (err instanceof PricingError) return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
    throw err;
  }

  const orderId = genOrderId();
  const { error } = await supabase.rpc('create_order_atomic', {
    p_order: {
      order_id:          orderId,
      customer_name:     String(customer_name).trim(),
      customer_phone:    String(customer_phone).trim(),
      customer_address:  String(customer_address).trim(),
      customer_city:     customer_city     || 'Dhaka',
      customer_district: customer_district || 'Dhaka',
      customer_email:    customer_email ? String(customer_email).trim().toLowerCase() : (req.customer?.email || null),
      // Signed in → the order belongs to that account (shows under My Orders)
      customer_user_id:  req.customer?.id || null,
      notes:             order_notes || null,
      items:             priced.lines,
      subtotal:          priced.subtotal,
      delivery_charge:   priced.delivery,
      coupon_code:       code,
      coupon_discount:   priced.discount,
      total:             priced.total,
      payment_method:    method,
      transaction_id:    transaction_id || null,
    },
  });

  if (error) {
    if (error.message?.includes('COUPON_UNAVAILABLE')) {
      return res.status(409).json({ success: false, code: 'COUPON_USED_UP', message: 'This coupon has reached its usage limit.' });
    }
    // Someone bought the last units between the price check and now
    const oos = error.message?.match(/OUT_OF_STOCK:?(.*)/);
    if (oos) {
      return res.status(409).json({ success: false, code: 'OUT_OF_STOCK', message: `Sorry, ${oos[1] ? `"${oos[1].trim()}"` : 'an item in your cart'} just sold out. Please update your cart.` });
    }
    return res.status(400).json({ success: false, message: error.message });
  }

  res.status(201).json({ success: true, order_id: orderId, total: priced.total });
});

/* ── Public: track order — requires order ID *and* phone ───────── */
router.get('/track/:orderId', async (req, res) => {
  const phone = String(req.query.phone || '').trim();
  if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id', req.params.orderId.trim().toUpperCase())
    .eq('customer_phone', phone)
    .maybeSingle();

  if (error) return res.status(400).json({ success: false, message: error.message });
  if (!data)  return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, order: data });
});

/* ── Signed-in customer: own orders ─────────────────────────────── */
router.get('/mine', protectCustomer, async (req, res) => {
  const c = req.customer;
  const [own, byEmail] = await Promise.all([
    supabase.from('orders').select('*').eq('customer_user_id', c.id).order('created_at', { ascending: false }),
    // Guest orders with the same email — only when Google/Facebook verified that email
    c.emailVerified && c.email
      ? supabase.from('orders').select('*').is('customer_user_id', null).eq('customer_email', c.email).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const err = own.error || byEmail.error;
  if (err) return res.status(400).json({ success: false, message: err.message });
  const orders = [...own.data, ...byEmail.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, orders });
});

/* ── Signed-in customer: add an earlier guest order to the account ──
   Needs the order ID and the phone number used for it (same proof as tracking). */
router.post('/claim', claimLimiter, protectCustomer, async (req, res) => {
  const orderId = String(req.body?.order_id || '').trim().toUpperCase();
  const phone   = String(req.body?.phone || '').replace(/\D/g, '');
  if (!orderId || phone.length < 10) return res.status(400).json({ success: false, message: 'Enter the order ID and the phone number used for that order.' });

  const { data: order, error } = await supabase.from('orders')
    .select('id, customer_phone, customer_user_id').eq('order_id', orderId).maybeSingle();
  if (error) return res.status(400).json({ success: false, message: error.message });
  if (!order || String(order.customer_phone || '').replace(/\D/g, '') !== phone) {
    return res.status(404).json({ success: false, message: 'No order found with that order ID and phone number.' });
  }
  if (order.customer_user_id === req.customer.id) return res.json({ success: true, message: 'This order is already in your account.' });
  if (order.customer_user_id) return res.status(409).json({ success: false, message: 'This order already belongs to another account.' });

  const { error: upErr } = await supabase.from('orders')
    .update({ customer_user_id: req.customer.id }).eq('id', order.id).is('customer_user_id', null);
  if (upErr) return res.status(400).json({ success: false, message: upErr.message });
  res.json({ success: true, message: 'Order added to your account.' });
});

/* ── Admin routes (protected) ───────────────────────────────────── */
router.use(protect, authorize('admin', 'super_admin'));

router.get('/', async (req, res) => {
  const { status } = req.query;
  try {
    const orders = await fetchAll(() => {
      let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).order('id', { ascending: false });
      if (status && status !== 'all') q = q.eq('status', status);
      return q;
    });
    res.json({ success: true, orders });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/status', validId, async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
  // set_order_status (migration 08) also puts items back in stock on cancel and takes them out on reopen
  const { error } = await supabase.rpc('set_order_status', { p_id: +req.params.id, p_status: status });
  if (error) {
    if (error.code === 'PGRST202' || /set_order_status/.test(error.message || '')) {
      // Migration 08 not run yet: change the status only
      const r = await supabase.from('orders').update({ status }).eq('id', req.params.id);
      if (r.error) return res.status(400).json({ success: false, message: r.error.message });
      return res.json({ success: true, stockAdjusted: false });
    }
    const short = error.message?.match(/INSUFFICIENT_STOCK:(.*)/);
    if (short) return res.status(409).json({ success: false, message: `Not enough stock to reopen this order: ${short[1].trim()}` });
    if (error.message?.includes('ORDER_NOT_FOUND')) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.status(400).json({ success: false, message: error.message });
  }
  res.json({ success: true, stockAdjusted: true });
});

// Status timeline for one order (recorded by a trigger, migration 03)
router.get('/:id/history', validId, async (req, res) => {
  const { data, error } = await supabase.from('order_status_history').select('status, changed_at')
    .eq('order_id', +req.params.id).order('changed_at', { ascending: true });
  if (error) return res.json({ success: true, history: [] });
  res.json({ success: true, history: data || [] });
});

router.patch('/:id/paid', validId, async (req, res) => {
  const { error } = await supabase.from('orders').update({ payment_paid: true }).eq('id', req.params.id);
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true });
});

// Mark returned + restock, atomically (see process_return in supabase/migrations)
router.patch('/:id/return', validId, async (req, res) => {
  const { error } = await supabase.rpc('process_return', { p_id: +req.params.id, p_reason: req.body.return_reason || '' });
  if (error) {
    if (error.message?.includes('ORDER_NOT_FOUND'))  return res.status(404).json({ success: false, message: 'Order not found' });
    if (error.message?.includes('ALREADY_RETURNED')) return res.status(409).json({ success: false, message: 'This order was already returned.' });
    if (error.message?.includes('ORDER_CANCELLED'))  return res.status(409).json({ success: false, message: 'This order was cancelled; its items are already back in stock.' });
    return res.status(400).json({ success: false, message: error.message });
  }
  res.json({ success: true });
});

module.exports = router;
