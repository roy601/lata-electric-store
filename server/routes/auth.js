const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const {
  login,
  refresh,
  logout,
  getMe,
  changePassword,
} = require('../controllers/authController');

const { protect }       = require('../middleware/authMiddleware');
const { loginLimiter }  = require('../middleware/rateLimiter');

/* ── Validation rules ── */
const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email required.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password required.')
    .isLength({ max: 128 })
    .withMessage('Password too long.'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password required.'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Must include uppercase, lowercase, and a number.'),
];

/* ── Routes ── */
router.post('/login',    loginLimiter,     loginValidation,          login);
router.post('/refresh',                                               refresh);
router.post('/logout',                                                logout);
router.get ('/me',       protect,                                     getMe);
router.patch('/change-password', protect, changePasswordValidation,  changePassword);

module.exports = router;
