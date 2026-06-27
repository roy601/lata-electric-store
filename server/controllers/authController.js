const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/db');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshCookieOptions,
} = require('../utils/generateToken');
const logger = require('../utils/logger');

/* ─── helpers ──────────────────────────────────────────────────── */

const sendTokens = (res, admin, statusCode = 200) => {
  const payload      = { id: admin.id, role: admin.role };
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  res.cookie('lata_rt', refreshToken, refreshCookieOptions());

  res.status(statusCode).json({
    success:     true,
    accessToken,
    admin: {
      id:          admin.id,
      name:        admin.name,
      email:       admin.email,
      role:        admin.role,
      lastLoginAt: admin.last_login_at,
    },
  });
};

/* ─── POST /api/auth/login ──────────────────────────────────────── */

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  // 1. Fetch admin record
  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !admin || !admin.is_active) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  // 2. Check account lock
  if (admin.lock_until && new Date(admin.lock_until) > new Date()) {
    const waitMin = Math.ceil((new Date(admin.lock_until) - Date.now()) / 60000);
    logger.warn(`Locked login attempt: ${email} from ${req.ip}`);
    return res.status(429).json({
      success: false,
      message: `Account locked. Try again in ${waitMin} minute${waitMin !== 1 ? 's' : ''}.`,
    });
  }

  // 3. Verify password
  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    const MAX      = +process.env.LOGIN_MAX_ATTEMPTS || 5;
    const LOCK_MIN = +process.env.ACCOUNT_LOCKOUT_MINUTES || 30;
    const newCount = (admin.login_attempts || 0) + 1;
    const lockUntil = newCount >= MAX
      ? new Date(Date.now() + LOCK_MIN * 60 * 1000).toISOString()
      : null;

    await supabase
      .from('admins')
      .update({ login_attempts: newCount, lock_until: lockUntil })
      .eq('id', admin.id);

    logger.warn(`Failed login (attempt ${newCount}): ${email} from ${req.ip}`);
    const remaining = MAX - newCount;
    return res.status(401).json({
      success: false,
      message: remaining > 0
        ? `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Account locked due to too many failed attempts.',
    });
  }

  // 4. Issue tokens & persist refresh token hash
  const refreshToken = signRefreshToken({ id: admin.id, role: admin.role });

  await supabase
    .from('admins')
    .update({
      login_attempts:     0,
      lock_until:         null,
      last_login_at:      new Date().toISOString(),
      last_login_ip:      req.ip,
      refresh_token_hash: hashToken(refreshToken),
    })
    .eq('id', admin.id);

  logger.info(`Admin login: ${email} from ${req.ip}`);

  res.cookie('lata_rt', refreshToken, refreshCookieOptions());
  res.status(200).json({
    success:     true,
    accessToken: signAccessToken({ id: admin.id, role: admin.role }),
    admin: {
      id:          admin.id,
      name:        admin.name,
      email:       admin.email,
      role:        admin.role,
      lastLoginAt: admin.last_login_at,
    },
  });
};

/* ─── POST /api/auth/refresh ────────────────────────────────────── */

exports.refresh = async (req, res) => {
  const token = req.cookies.lata_rt;
  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token.' });
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('id, role, is_active, refresh_token_hash')
    .eq('id', decoded.id)
    .single();

  if (!admin || !admin.is_active || admin.refresh_token_hash !== hashToken(token)) {
    res.clearCookie('lata_rt', { path: '/api/auth' });
    return res.status(401).json({ success: false, message: 'Session revoked. Please log in again.' });
  }

  const newAccessToken = signAccessToken({ id: admin.id, role: admin.role });
  res.status(200).json({ success: true, accessToken: newAccessToken });
};

/* ─── POST /api/auth/logout ─────────────────────────────────────── */

exports.logout = async (req, res) => {
  const token = req.cookies.lata_rt;
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      await supabase
        .from('admins')
        .update({ refresh_token_hash: null })
        .eq('id', decoded.id);
    } catch { /* expired — harmless */ }
  }
  res.clearCookie('lata_rt', { path: '/api/auth' });
  res.status(200).json({ success: true, message: 'Logged out.' });
};

/* ─── GET /api/auth/me ──────────────────────────────────────────── */

exports.getMe = async (req, res) => {
  const { data: admin } = await supabase
    .from('admins')
    .select('id, name, email, role, last_login_at, created_at')
    .eq('id', req.admin.id)
    .single();

  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
  res.status(200).json({ success: true, admin });
};

/* ─── PATCH /api/auth/change-password ──────────────────────────── */

exports.changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  const { data: admin } = await supabase
    .from('admins')
    .select('password')
    .eq('id', req.admin.id)
    .single();

  const valid = await bcrypt.compare(currentPassword, admin.password);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await supabase
    .from('admins')
    .update({ password: hashed, refresh_token_hash: null })
    .eq('id', req.admin.id);

  res.clearCookie('lata_rt', { path: '/api/auth' });
  res.status(200).json({ success: true, message: 'Password updated. Please log in again.' });
};
