const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');
const router   = express.Router();
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');

// Use memory storage — we stream directly to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
});

router.post(
  '/image',
  protect,
  authorize('admin', 'super_admin'),
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file or invalid type (jpeg/png/webp only).' });
    }

    const ext      = path.extname(req.file.originalname).toLowerCase();
    const filename = `products/${uuidv4()}${ext}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert:      false,
      });

    if (error) {
      return res.status(500).json({ success: false, message: `Upload failed: ${error.message}` });
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filename);

    res.status(201).json({ success: true, url: data.publicUrl });
  }
);

module.exports = router;
