const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Public: read public settings (shipping rates, payment methods)
router.get('/public', (req, res) => res.json({ success: true, settings: {} }));

router.use(protect, authorize('admin', 'super_admin'));
router.get('/',    (req, res) => res.json({ success: true, settings: {} }));
router.patch('/',  (req, res) => res.json({ success: true, message: 'TODO' }));

module.exports = router;
