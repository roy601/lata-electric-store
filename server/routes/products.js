const express  = require('express');
const router   = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// TODO: import productController

// Public routes
router.get('/',     (req, res) => res.json({ success: true, products: [] }));
router.get('/:id',  (req, res) => res.json({ success: true, product: null }));

// Admin-only routes
router.use(protect, authorize('admin', 'super_admin'));
router.post('/',        (req, res) => res.status(201).json({ success: true, message: 'TODO' }));
router.put('/:id',      (req, res) => res.json({ success: true, message: 'TODO' }));
router.delete('/:id',   (req, res) => res.json({ success: true, message: 'TODO' }));

module.exports = router;
