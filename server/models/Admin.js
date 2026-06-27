const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      maxlength: 60,
    },
    email: {
      type:     String,
      required: [true, 'Email is required'],
      unique:   true,
      lowercase: true,
      trim:     true,
      match:    [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type:     String,
      required: [true, 'Password is required'],
      minlength: 8,
      select:   false,  // never returned in queries by default
    },
    role: {
      type:    String,
      enum:    ['super_admin', 'admin'],
      default: 'admin',
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    // ── Login security ──────────────────────────────────────
    loginAttempts: { type: Number, default: 0 },
    lockUntil:     { type: Date },
    lastLoginAt:   { type: Date },
    lastLoginIP:   { type: String },
    // ── Refresh token (hashed SHA-256) ──────────────────────
    refreshTokenHash: {
      type:   String,
      select: false,
    },
    // ── Password reset ──────────────────────────────────────
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
  },
  { timestamps: true }
);

/* ── Virtual: is the account currently locked? ── */
adminSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

/* ── Hash password before save ── */
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ── Instance: compare plain password with stored hash ── */
adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/* ── Instance: record a failed login attempt, lock if threshold hit ── */
adminSchema.methods.recordFailedAttempt = async function () {
  const MAX    = +process.env.LOGIN_MAX_ATTEMPTS    || 5;
  const LOCK   = +process.env.ACCOUNT_LOCKOUT_MINUTES || 30;

  this.loginAttempts += 1;
  if (this.loginAttempts >= MAX) {
    this.lockUntil = new Date(Date.now() + LOCK * 60 * 1000);
  }
  await this.save();
};

/* ── Instance: clear lock + attempts on successful login ── */
adminSchema.methods.recordSuccessfulLogin = async function (ip) {
  this.loginAttempts = 0;
  this.lockUntil     = undefined;
  this.lastLoginAt   = new Date();
  this.lastLoginIP   = ip;
  await this.save();
};

/* ── Instance: generate + store password-reset token ── */
adminSchema.methods.createPasswordResetToken = function () {
  const raw   = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  this.passwordResetToken   = hashed;
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 min
  return raw; // send this via email
};

/* ── Don't leak internals in JSON ── */
adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokenHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Admin', adminSchema);
