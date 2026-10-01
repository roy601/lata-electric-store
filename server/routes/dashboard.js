const express      = require('express');
const router       = express.Router();
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('admin', 'super_admin'));

router.get('/', async (req, res) => {
  const [ordersRes, productsRes] = await Promise.all([
    supabase.from('orders').select('id, total, status, created_at, order_id, customer_name'),
    supabase.from('products').select('id, name, stock, price, image'),
  ]);
  if (ordersRes.error || productsRes.error) {
    return res.status(400).json({ success: false, message: (ordersRes.error || productsRes.error).message });
  }
  const orders   = ordersRes.data;
  const products = productsRes.data;

  // "Today" in Bangladesh time (UTC+6), not the server's timezone
  const todayStart = new Date(); todayStart.setUTCHours(-6, 0, 0, 0);
  if (Date.now() - todayStart >= 24 * 3600e3) todayStart.setUTCDate(todayStart.getUTCDate() + 1);

  const lowStock = products.filter(p => p.stock <= 5).sort((a, b) => a.stock - b.stock);

  res.json({
    success: true,
    stats: {
      totalOrders:   orders.length,
      todayOrders:   orders.filter(o => new Date(o.created_at) >= todayStart).length,
      revenue:       orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (+o.total || 0), 0),
      totalProducts: products.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      lowStockCount: lowStock.length,
    },
    recentOrders: [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8),
    lowStock:     lowStock.slice(0, 6),
  });
});

module.exports = router;
