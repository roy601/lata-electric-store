const { supabase } = require('../config/db');

/**
 * Verifies a storefront customer's Supabase Auth access token
 * (sent as `Authorization: Bearer <token>`). Attaches `req.customer`.
 * Separate from admin auth, which uses our own JWTs.
 */
exports.protectCustomer = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Please sign in.' });
  }
  const { data, error } = await supabase.auth.getUser(header.split(' ')[1]);
  if (error || !data?.user) {
    return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
  }
  req.customer = { id: data.user.id, email: data.user.email };
  next();
};
