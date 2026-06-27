const logger = require('../utils/logger');

/* ── 404 handler ── */
exports.notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

/* ── Global error handler ── */
exports.errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message    = err.message    || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message    = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  { statusCode = 401; message = 'Invalid token.'; }
  if (err.name === 'TokenExpiredError')  { statusCode = 401; message = 'Token expired.'; }
  if (err.name === 'CastError')          { statusCode = 400; message = `Invalid ${err.path}: ${err.value}`; }

  if (statusCode >= 500) {
    logger.error(`${statusCode} ${req.method} ${req.originalUrl} — ${message}`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
