/**
 * Business reports for the admin (Phase 5).
 *  GET  /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD  → every section of the report,
 *       plus the same figures for the previous period of equal length
 *  POST /api/reports/summary { from, to, language }  → short written summary by the AI
 *
 * All figures come from ../ai/analytics.js — the same maths the AI assistant
 * uses — so a report and an AI answer never disagree.
 */
const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const A = require('../ai/analytics');
const assistant = require('../ai/assistant');
const logger = require('../utils/logger');

router.use(protect, authorize('admin', 'super_admin'));

async function buildReport(from, to) {
  const range = A.resolveRange(from, to, 7);
  const prevTo = A.addDays(range.from, -1);
  const prev = A.resolveRange(A.addDays(prevTo, -(range.days - 1)), prevTo);
  const firstOrders = A.fetchFirstOrderByPhone ? A.fetchFirstOrderByPhone() : Promise.resolve(new Map());
  const [orders, prevOrders, products, categories, recentOrders, firstByPhone] = await Promise.all([
    A.fetchOrders(range), A.fetchOrders(prev), A.fetchProducts(), A.fetchCategories(),
    A.fetchOrders(A.resolveRange(null, null, 30)), firstOrders,
  ]);
  const summary = A.salesSummary(orders, range);
  const prevSummary = A.salesSummary(prevOrders, prev);
  return {
    period: range,
    previous_period: prev,
    summary,
    previous_summary: { orders_placed: prevSummary.orders_placed, booked: prevSummary.booked, delivered: prevSummary.delivered },
    trend: A.salesTrend(orders, range, range.days > 92 ? 'week' : 'day').rows,
    products: A.productPerformance(orders, products, range, { sort: 'revenue', limit: 500 }).rows,
    categories: A.categoryPerformance(orders, products, categories, range).rows,
    customers: A.customerInsights(orders, firstByPhone, range, 50),
    returns: A.returnsSummary(orders, range),
    inventory: A.inventoryStatus(products, recentOrders, { window_days: 30, limit: 1000 }),
    orders: orders.map(o => ({
      order_id: o.order_id, created_at: o.created_at, status: o.status,
      customer: o.customer_name, phone: o.customer_phone, city: o.customer_city || o.customer_district || '',
      items: (o.items || []).reduce((s, i) => s + (+i.qty || 0), 0),
      subtotal: +o.subtotal || 0, delivery: +o.delivery_charge || 0, discount: +o.coupon_discount || 0, total: +o.total || 0,
      payment: o.payment_method, paid: !!o.payment_paid, coupon: o.coupon_code || '',
    })).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
  };
}

router.get('/', async (req, res) => {
  try { res.json({ success: true, report: await buildReport(req.query.from, req.query.to) }); }
  catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

const SUMMARY_PROMPT = `You write a short business report for the owner of Lata Electric, an electrical shop in Dhaka selling online.
You get the report figures as JSON (this period and the previous period of the same length). Write:
1. A 2–3 sentence overview: sales (booked revenue), orders, and the change versus the previous period.
2. "What went well" — 2–3 bullets.
3. "Needs attention" — 2–3 bullets (e.g. out-of-stock best sellers, unpaid orders, cancellations, products not selling).
4. "Suggested actions" — 2–3 concrete bullets for next week.
Rules: use ONLY the numbers in the JSON; never invent figures. Percent changes are given; do not compute new ones. Money in Taka as ৳1,234. If a period has very little data, say so plainly. There is no cost or profit data. Keep it under 220 words. Plain text with **bold** and "- " bullets only.`;

router.post('/summary', async (req, res) => {
  if (!assistant.isConfigured()) return res.status(503).json({ success: false, message: 'The AI assistant is not set up.' });
  try {
    const r = await buildReport(req.body?.from, req.body?.to);
    const pct = (a, b) => (b ? Math.round((a - b) / b * 100) : null);
    const facts = {
      period: r.period, previous_period: r.previous_period,
      revenue: r.summary.booked.revenue, previous_revenue: r.previous_summary.booked.revenue, revenue_change_pct: pct(r.summary.booked.revenue, r.previous_summary.booked.revenue),
      orders: r.summary.booked.orders, previous_orders: r.previous_summary.booked.orders, orders_change_pct: pct(r.summary.booked.orders, r.previous_summary.booked.orders),
      avg_order_value: r.summary.booked.avg_order_value, units_sold: r.summary.booked.units_sold,
      delivered_revenue: r.summary.delivered.revenue, not_marked_paid: r.summary.not_marked_paid, by_payment_method: r.summary.by_payment_method,
      orders_by_status: r.summary.orders_by_status,
      top_products: r.products.slice(0, 5).map(p => ({ name: p.name, units: p.units_sold, revenue: p.revenue, stock_now: p.current_stock })),
      top_categories: r.categories.filter(c => c.revenue > 0).slice(0, 5).map(c => ({ category: c.category, revenue: c.revenue })),
      customers: { total: r.customers.customers_who_ordered, new: r.customers.new_customers, returning: r.customers.returning_customers },
      cancellations_and_returns: { cancelled: r.returns.cancelled, returned: r.returns.returned, rate_pct: r.returns.cancel_or_return_rate_pct },
      inventory: r.inventory.totals,
      out_of_stock_products: r.inventory.rows.filter(x => x.status === 'out_of_stock').slice(0, 8).map(x => x.name),
    };
    const language = req.body?.language === 'bn' ? 'Bangla (বাংলা), simple everyday shop Bangla' : 'English';
    const out = await assistant.getProvider().chat({
      system: [{ type: 'text', text: SUMMARY_PROMPT }, { type: 'text', text: `Write in ${language}.` }],
      messages: [{ role: 'user', content: `Report figures (JSON):\n${JSON.stringify(facts)}` }],
      tools: [], maxTokens: 1800,
    });
    logger.info(`AI report summary for admin ${req.admin.id} via ${out.provider}`);
    res.json({ success: true, summary: out.text || '' });
  } catch (err) {
    const described = assistant.getProvider()?.describeError?.(err);
    logger.error(`Report summary failed: ${err.message}`);
    res.status(described?.status || 500).json({ success: false, message: described?.message || 'Could not write the summary. Please try again.' });
  }
});

module.exports = router;
