const express  = require('express');
const router   = express.Router();
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');

const genOrderId = () => 'LE' + Date.now().toString(36).toUpperCase().slice(-6);

/* ── Public: place order ────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, customer_phone, customer_address,
      customer_city, customer_district,
      items, subtotal, delivery_charge, total,
      payment_method, transaction_id,
    } = req.body;

    if (!customer_name || !customer_phone || !customer_address) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    const orderId = genOrderId();

    // 1. Insert order
    const { error: orderErr } = await supabase.from('orders').insert({
      order_id:          orderId,
      customer_name,
      customer_phone,
      customer_address,
      customer_city:     customer_city     || 'Dhaka',
      customer_district: customer_district || 'Dhaka',
      items:             items.map(i => ({ id: +i.id, name: i.name, price: +i.price, qty: +i.qty, image: i.image || null })),
      subtotal:          +subtotal,
      delivery_charge:   +delivery_charge,
      total:             +total,
      payment_method:    payment_method || 'Cash on Delivery',
      transaction_id:    transaction_id || null,
      status:            'pending',
      payment_paid:      false,
    });

    if (orderErr) return res.status(400).json({ success: false, message: orderErr.message });

    // 2. Decrement stock for each item (service_role bypasses RLS)
    for (const item of items) {
      const productId = +item.id;
      const qty       = +item.qty;

      const { data: prod } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .maybeSingle();

      if (prod !== null) {
        const newStock = Math.max(0, (prod.stock || 0) - qty);
        await supabase.from('products').update({ stock: newStock }).eq('id', productId);
      }
    }

    res.status(201).json({ success: true, order_id: orderId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Public: track order by order_id string ────────────────────── */
router.get('/track/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('order_id, status, customer_name, customer_city, created_at, items, total, payment_method, payment_paid')
      .eq('order_id', req.params.id)
      .maybeSingle();

    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!data)  return res.status(404).json({ success: false, message: 'Order not found' });

    res.json({ success: true, order: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Admin routes (protected) ───────────────────────────────────── */
router.use(protect, authorize('admin', 'super_admin'));

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, orders: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { error } = await supabase.from('orders').update({ status }).eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/return', async (req, res) => {
  try {
    const { return_reason } = req.body;

    // Get order items
    const { data: order } = await supabase.from('orders').select('items').eq('id', req.params.id).maybeSingle();
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Update order status
    await supabase.from('orders').update({ status: 'returned', return_reason: return_reason || null }).eq('id', req.params.id);

    // Restock each item
    for (const item of (order.items || [])) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', +item.id).maybeSingle();
      if (prod !== null) {
        await supabase.from('products').update({ stock: (prod.stock || 0) + +item.qty }).eq('id', +item.id);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
