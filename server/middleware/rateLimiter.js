const rateLimit = require('express-rate-limit');

/** Strict limiter for the login endpoint */
exports.loginLimiter = rateLimit({
  windowMs:          (+process.env.LOGIN_WINDOW_MINUTES || 15) * 60 * 1000,
  max:               +process.env.LOGIN_MAX_ATTEMPTS    || 5,
  standardHeaders:   true,
  legacyHeaders:     false,
  skipSuccessfulRequests: true,        // only count failures
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  keyGenerator: (req) => req.ip,       // per IP
});

/** General API limiter */
exports.apiLimiter = rateLimit({
  windowMs:        60 * 1000,          // 1 minute
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many requests. Slow down.',
  },
});
