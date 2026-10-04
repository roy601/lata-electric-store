const { supabase } = require('../config/db');

/**
 * Storefront customers sign in with Supabase Auth and send their access token
 * as `Authorization: Bearer <token>`. Separate from admin auth (our own JWTs).
 *
 * Orders belong to an account by its id (orders.customer_user_id), so a new
 * account works straight away — no confirmation email needed. Matching old
 * guest orders by email is only done when Google/Facebook vouch for the email
 * (`emailVerified`), because a plain email sign-up proves nothing about it.
 */
const VERIFYING_PROVIDERS = ['google', 'facebook'];

const readCustomer = async (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return { error: 'missing' };
  const { data, error } = await supabase.auth.getUser(header.split(' ')[1]);
  if (error || !data?.user) return { error: 'invalid' };
  const u = data.user;
  const providers = u.app_metadata?.providers || [u.app_metadata?.provider].filter(Boolean);
  return {
    customer: {
      id: u.id,
      email: u.email ? String(u.email).toLowerCase() : null,
      emailVerified: !!u.email && !!(u.email_confirmed_at || u.confirmed_at) && providers.some(p => VERIFYING_PROVIDERS.includes(p)),
    },
  };
};

/** Requires a signed-in customer. Attaches `req.customer`. */
exports.protectCustomer = async (req, res, next) => {
  const { customer, error } = await readCustomer(req);
  if (error === 'missing') return res.status(401).json({ success: false, message: 'Please sign in.' });
  if (error)               return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
  req.customer = customer;
  next();
};

/** Attaches `req.customer` when a valid token is sent; never blocks the request. */
exports.optionalCustomer = async (req, res, next) => {
  try {
    const { customer } = await readCustomer(req);
    if (customer) req.customer = customer;
  } catch { /* guest */ }
  next();
};
