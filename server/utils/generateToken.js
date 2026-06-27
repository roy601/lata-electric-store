const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Short-lived access token — sent in response body, held in memory on client.
 */
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    issuer:    'lata-electric',
    audience:  'lata-electric-admin',
  });

/**
 * Long-lived refresh token — stored as httpOnly, Secure, SameSite=Strict cookie.
 * Also persisted (hashed) in DB so it can be invalidated.
 */
const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
    issuer:    'lata-electric',
    audience:  'lata-electric-admin',
  });

const verifyAccessToken  = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET,  { issuer: 'lata-electric', audience: 'lata-electric-admin' });

const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET, { issuer: 'lata-electric', audience: 'lata-electric-admin' });

/** Secure one-way hash for storing refresh token in DB */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

/** Cookie config for the refresh token */
const refreshCookieOptions = () => ({
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'Strict',
  maxAge:    7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path:      '/api/auth',              // only sent to auth routes
});

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  refreshCookieOptions,
};
