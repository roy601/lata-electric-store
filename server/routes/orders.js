const express  = require('express');
const router   = express.Router();
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const { protectCustomer }    = require('../middleware/customerAuthMiddleware');
const { validId }            = require('../utils/crudRouter');
const { priceOrder, PricingError } = require('../services/orderPricing');

const genOrderId = () => 'LE' + Date.now().toString(36).toUpperCase().slice(-6);

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];

/* ── Public: place order ────────────────────────────────────────── */
router.post('/', async (req, res) => {
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
    supabase.from('products').select('id, name, price, flash_sale, flash_price, variants, image, is_active').in('id', ids),
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
      customer_email:    customer_email ? String(customer_email).trim().toLowerCase() : null,
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
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_email', String(req.customer.email).toLowerCase())
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, orders: data });
});

/* ── Admin routes (protected) ───────────────────────────────────── */
router.use(protect, authorize('admin', 'super_admin'));

router.get('/', async (req, res) => {
  const { status } = req.query;
  let q = supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, orders: data });
});

router.patch('/:id/status', validId, async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
  const { error } = await supabase.from('orders').update({ status }).eq('id', req.params.id);
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true });
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
    return res.status(400).json({ success: false, message: error.message });
  }
  res.json({ success: true });
});

module.exports = router;
