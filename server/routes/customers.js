const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('admin', 'super_admin'));
router.get('/',      (req, res) => res.json({ success: true, customers: [] }));
router.get('/:id',   (req, res) => res.json({ success: true, customer: null }));
router.delete('/:id',(req, res) => res.json({ success: true, message: 'TODO' }));

module.exports = router;
