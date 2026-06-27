/**
 * One-time seed script — creates the first super_admin account.
 * Run: npm run seed  (from /server)
 *
 * Required env vars (set in .env before running):
 *   SEED_ADMIN_EMAIL     — the admin login email
 *   SEED_ADMIN_PASSWORD  — min 8 chars, must include upper, lower, digit
 *   SEED_ADMIN_NAME      — display name (optional, defaults to "Super Admin")
 */
require('dotenv').config();
const bcrypt           = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const seed = async () => {
  /* ── Validate required env vars ── */
  const email    = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  const name     = process.env.SEED_ADMIN_NAME?.trim() || 'Super Admin';

  if (!email || !password) {
    console.error('─────────────────────────────────────────────');
    console.error('✗  Missing required environment variables:');
    if (!email)    console.error('   SEED_ADMIN_EMAIL is not set');
    if (!password) console.error('   SEED_ADMIN_PASSWORD is not set');
    console.error('\n   Add them to your .env file and retry.');
    console.error('─────────────────────────────────────────────');
    process.exit(1);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('✗  SEED_ADMIN_EMAIL is not a valid email address.');
    process.exit(1);
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    console.error('✗  SEED_ADMIN_PASSWORD must be at least 8 characters and include');
    console.error('   an uppercase letter, a lowercase letter, and a digit.');
    process.exit(1);
  }

  try {
    /* ── Check if super_admin already exists ── */
    const { data: existing } = await supabase
      .from('admins')
      .select('email')
      .eq('role', 'super_admin')
      .single();

    if (existing) {
      console.log(`Super admin already exists: ${existing.email}`);
      console.log('To reset credentials, update the admins table directly in Supabase.');
      process.exit(0);
    }

    /* ── Check email is not already taken ── */
    const { data: taken } = await supabase
      .from('admins')
      .select('email')
      .eq('email', email)
      .single();

    if (taken) {
      console.error(`✗  An admin with email "${email}" already exists.`);
      process.exit(1);
    }

    /* ── Create the account ── */
    const hashed = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from('admins')
      .insert({ name, email, password: hashed, role: 'super_admin' })
      .select('email, name')
      .single();

    if (error) throw error;

    console.log('─────────────────────────────────────────────');
    console.log('✓  Super admin created:');
    console.log(`   Name  : ${data.name}`);
    console.log(`   Email : ${data.email}`);
    console.log('   Login at: /admin/login');
    console.log('─────────────────────────────────────────────');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
