const express  = require('express');
const router   = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} = require('../controllers/couponsController');

/* Public — validate a coupon code at checkout */
router.post('/validate', validateCoupon);

/* Admin only */
router.use(protect, authorize('admin', 'super_admin'));
router.get('/',      getAllCoupons);
router.post('/',     createCoupon);
router.put('/:id',   updateCoupon);
router.delete('/:id',deleteCoupon);

module.exports = router;
