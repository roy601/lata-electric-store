const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', (req, res) => res.json({ success: true, categories: [] }));

router.use(protect, authorize('admin', 'super_admin'));
router.post('/',      (req, res) => res.status(201).json({ success: true, message: 'TODO' }));
router.put('/:id',    (req, res) => res.json({ success: true, message: 'TODO' }));
router.delete('/:id', (req, res) => res.json({ success: true, message: 'TODO' }));

module.exports = router;
