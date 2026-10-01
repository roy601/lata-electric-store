const express      = require('express');
const router       = express.Router();
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const { pick }     = require('../utils/crudRouter');

// Single settings row (id = 1). The storefront reads it directly (public read via RLS).
const FIELDS = [
  'site_name', 'store_name_bn', 'store_tagline', 'logo_url', 'logo_bg_color',
  'phone', 'email', 'address', 'hours', 'map_url', 'map_embed_src',
  'hero_title', 'hero_subtitle', 'announcement_bar',
  'facebook', 'whatsapp', 'youtube',
  'shipping_inside', 'shipping_outside', 'free_delivery_threshold',
  'delivery_time_inside', 'delivery_time_outside',
  'payment_methods', 'bkash_number', 'nagad_number', 'bkash_instructions', 'nagad_instructions',
  'flash_sale_active', 'flash_sale_ends',
];

router.use(protect, authorize('admin', 'super_admin'));

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, settings: data || {} });
});

// Partial update — each admin page sends only its own fields
router.patch('/', async (req, res) => {
  const payload = pick(req.body, FIELDS);
  if (!Object.keys(payload).length) return res.status(400).json({ success: false, message: 'Nothing to update.' });
  const { data, error } = await supabase.from('settings')
    .upsert({ id: 1, ...payload }, { onConflict: 'id' }).select().single();
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, settings: data });
});

module.exports = router;
