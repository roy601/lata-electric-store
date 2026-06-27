const { supabase } = require('../config/db');

/* ── GET /api/coupons — list all (admin) ── */
exports.getAllCoupons = async (req, res) => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, coupons: data });
};

/* ── POST /api/coupons — create (admin) ── */
exports.createCoupon = async (req, res) => {
  const {
    code, discount_type, discount_value,
    min_order, max_discount, usage_limit, expires_at, is_active,
  } = req.body;

  if (!code || !discount_type || discount_value == null) {
    return res.status(400).json({ success: false, message: 'code, discount_type and discount_value are required.' });
  }
  if (!['percent', 'flat'].includes(discount_type)) {
    return res.status(400).json({ success: false, message: 'discount_type must be "percent" or "flat".' });
  }
  if (discount_type === 'percent' && (discount_value <= 0 || discount_value > 100)) {
    return res.status(400).json({ success: false, message: 'Percent discount must be between 1 and 100.' });
  }

  const { data: existing } = await supabase
    .from('coupons').select('id').eq('code', code.toUpperCase().trim()).single();
  if (existing) return res.status(409).json({ success: false, message: 'A coupon with this code already exists.' });

  const { data, error } = await supabase.from('coupons').insert({
    code:           code.toUpperCase().trim(),
    discount_type,
    discount_value: +discount_value,
    min_order:      min_order   ? +min_order   : null,
    max_discount:   max_discount? +max_discount : null,
    usage_limit:    usage_limit ? +usage_limit  : null,
    used_count:     0,
    expires_at:     expires_at  || null,
    is_active:      is_active !== false,
  }).select().single();

  if (error) return res.status(500).json({ success: false, message: error.message });
  res.status(201).json({ success: true, coupon: data });
};

/* ── PUT /api/coupons/:id — update (admin) ── */
exports.updateCoupon = async (req, res) => {
  const { id } = req.params;
  const fields = ['code', 'discount_type', 'discount_value', 'min_order', 'max_discount', 'usage_limit', 'expires_at', 'is_active'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (updates.code) updates.code = updates.code.toUpperCase().trim();

  const { data, error } = await supabase.from('coupons').update(updates).eq('id', id).select().single();
  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!data)  return res.status(404).json({ success: false, message: 'Coupon not found.' });
  res.json({ success: true, coupon: data });
};

/* ── DELETE /api/coupons/:id — delete (admin) ── */
exports.deleteCoupon = async (req, res) => {
  const { error } = await supabase.from('coupons').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, message: 'Coupon deleted.' });
};

/* ── POST /api/coupons/validate — public (checkout) ── */
exports.validateCoupon = async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Coupon code is required.' });

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !data) return res.status(404).json({ success: false, message: 'Invalid or expired coupon code.' });

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return res.status(400).json({ success: false, message: 'This coupon has expired.' });
  }
  if (data.usage_limit && data.used_count >= data.usage_limit) {
    return res.status(400).json({ success: false, message: 'This coupon has reached its usage limit.' });
  }
  if (data.min_order && subtotal < data.min_order) {
    return res.status(400).json({ success: false, message: `Minimum order amount of ৳${data.min_order} required.` });
  }

  let discount = data.discount_type === 'percent'
    ? Math.round((subtotal || 0) * data.discount_value / 100)
    : data.discount_value;

  if (data.max_discount) discount = Math.min(discount, data.max_discount);

  res.json({ success: true, coupon: data, discount });
};
