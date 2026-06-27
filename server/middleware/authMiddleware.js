const { verifyAccessToken } = require('../utils/generateToken');
const { supabase } = require('../config/db');

/**
 * Protect routes — verifies the Bearer access token in Authorization header.
 * On success, attaches `req.admin` = { id, role }.
 */
exports.protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Session expired. Please refresh.'
      : 'Invalid token.';
    return res.status(401).json({ success: false, message: msg });
  }

  // Confirm admin still exists and is active
  const { data: admin } = await supabase
    .from('admins')
    .select('id, role, is_active')
    .eq('id', decoded.id)
    .single();

  if (!admin || !admin.is_active) {
    return res.status(401).json({ success: false, message: 'Account deactivated.' });
  }

  req.admin = { id: decoded.id, role: decoded.role };
  next();
};

/**
 * Role gate — place after `protect`.
 * Usage: authorize('super_admin') or authorize('super_admin', 'admin')
 */
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin?.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action.',
    });
  }
  next();
};
