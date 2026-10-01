const express      = require('express');
const router       = express.Router();
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('admin', 'super_admin'));

// Customers are derived from orders, grouped by phone number
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_name, customer_phone, customer_city, total, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ success: false, message: error.message });

  const map = new Map();
  (data || []).forEach(o => {
    if (!map.has(o.customer_phone)) {
      map.set(o.customer_phone, { name: o.customer_name, phone: o.customer_phone, city: o.customer_city, orderCount: 0, totalSpent: 0, lastOrder: o.created_at });
    }
    const c = map.get(o.customer_phone);
    c.orderCount++;
    c.totalSpent += +o.total || 0;
  });
  res.json({ success: true, customers: [...map.values()] });
});

// Deletes every order for this phone number (same as the old admin page did)
router.delete('/:phone', async (req, res) => {
  const { error } = await supabase.from('orders').delete().eq('customer_phone', req.params.phone);
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true });
});

module.exports = router;
