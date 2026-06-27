const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

/**
 * Server-side Supabase client using service_role key.
 * Bypasses Row Level Security — safe only on the server, never expose to browser.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

const connectDB = async () => {
  // Ping the DB to confirm connectivity on startup
  const { error } = await supabase.from('settings').select('id').limit(1);
  if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  logger.info(`Supabase connected: ${process.env.SUPABASE_URL}`);
};

module.exports = { supabase, connectDB };
