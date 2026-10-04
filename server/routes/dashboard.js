const express      = require('express');
const router       = express.Router();
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const { fetchAll } = require('../utils/fetchAll');

router.use(protect, authorize('admin', 'super_admin'));

router.get('/', async (req, res) => {
  let orders;
  const [ordersRes, totalRes, lowCountRes, lowRes] = await Promise.all([
    fetchAll(() => supabase.from('orders').select('id, total, status, created_at, order_id, customer_name').order('id')).then(d => ({ data: d }), e => ({ error: e })),
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).lte('stock', 5),
    supabase.from('products').select('id, name, stock, price, image').lte('stock', 5).order('stock').order('id').limit(6),
  ]);
  const failed = ordersRes.error || totalRes.error || lowCountRes.error || lowRes.error;
  if (failed) return res.status(400).json({ success: false, message: failed.message });
  orders = ordersRes.data;

  // "Today" in Bangladesh time (UTC+6), not the server's timezone
  const todayStart = new Date(); todayStart.setUTCHours(-6, 0, 0, 0);
  if (Date.now() - todayStart >= 24 * 3600e3) todayStart.setUTCDate(todayStart.getUTCDate() + 1);


  res.json({
    success: true,
    stats: {
      totalOrders:   orders.length,
      todayOrders:   orders.filter(o => new Date(o.created_at) >= todayStart).length,
      revenue:       orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (+o.total || 0), 0),
      totalProducts: totalRes.count || 0,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      lowStockCount: lowCountRes.count || 0,
    },
    recentOrders: [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8),
    lowStock:     lowRes.data,
  });
});

module.exports = router;
