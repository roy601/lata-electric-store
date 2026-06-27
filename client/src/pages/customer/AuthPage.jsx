import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, Zap } from 'lucide-react';
import { useCustomerAuth } from '../../context/CustomerAuthContext';

/* ─── Brand icon SVGs (lucide doesn't carry brand logos) ─── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
  </svg>
);

/* ─── Design tokens — match main site theme ─── */
const A   = '#1E88E5';   // primary blue (matches site)
const AH  = '#1565C0';   // hover (matches site nav hover)

/* ─── Shared micro-styles ─── */
const inputBase = {
  width: '100%', padding: '12px 14px', border: '1.5px solid #E2E8F0',
  borderRadius: 10, fontSize: 14, color: '#1A202C', outline: 'none',
  background: '#FAFBFC', boxSizing: 'border-box', transition: 'border-color .2s, box-shadow .2s',
  fontFamily: 'inherit',
};
const focusIn  = e => { e.target.style.borderColor = A; e.target.style.boxShadow = '0 0 0 3px rgba(30,136,229,.12)'; };
const focusOut = e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; };

const labelSt = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
const fieldSt = { marginBottom: 16 };
const primaryBtn = {
  width: '100%', padding: '13px', background: A, color: '#fff', border: 'none',
  borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  letterSpacing: .3, fontFamily: 'inherit', transition: 'background .15s, opacity .15s',
};

/* ─── Password strength helper ─── */
function strength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  return s; // 0–3
}
const STRENGTH_COLORS = ['#E2E8F0', '#DC3545', '#F59E0B', '#22C55E'];
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Strong'];

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, signInWithGoogle, signInWithFacebook, forgotPassword } = useCustomerAuth();

  /* Tab / view state — default to signup tab if ?tab=signup */
  const [tab,  setTab]  = useState(searchParams.get('tab') === 'signup' ? 'signup' : 'signin');
  const [view, setView] = useState('main');    // 'main' | 'forgot'

  /* Sign-in fields */
  const [siEmail,    setSiEmail]    = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siShowPw,   setSiShowPw]   = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  /* Sign-up fields */
  const [suFirst,    setSuFirst]    = useState('');
  const [suLast,     setSuLast]     = useState('');
  const [suEmail,    setSuEmail]    = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suShowPw,   setSuShowPw]   = useState(false);
  const [terms,      setTerms]      = useState(false);
  const [signedUp,   setSignedUp]   = useState(false);

  /* Forgot-password fields */
  const [fpEmail, setFpEmail] = useState('');
  const [fpSent,  setFpSent]  = useState(false);

  /* Shared feedback */
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const clear = () => setError('');

  const switchTab = (t) => { setTab(t); setView('main'); clear(); };

  /* ── Handlers ── */
  const handleSignIn = async (e) => {
    e.preventDefault(); clear();
    if (!siEmail || !siPassword) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    const { error: err } = await signIn({ email: siEmail, password: siPassword, rememberMe });
    setLoading(false);
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Invalid email or password.' : err.message);
      return;
    }
    navigate('/account');
  };

  const handleSignUp = async (e) => {
    e.preventDefault(); clear();
    if (!suFirst || !suLast || !suEmail || !suPassword) { setError('Please fill in all fields.'); return; }
    if (suPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!terms) { setError('Please agree to the Terms of Service to continue.'); return; }
    setLoading(true);
    const { error: err } = await signUp({ email: suEmail, password: suPassword, firstName: suFirst, lastName: suLast });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSignedUp(true);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault(); clear();
    if (!fpEmail) { setError('Please enter your email address.'); return; }
    setLoading(true);
    const { error: err } = await forgotPassword(fpEmail);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setFpSent(true);
  };

  const handleGoogle   = async () => { clear(); const { error: e } = await signInWithGoogle();   if (e) setError(e.message); };
  const handleFacebook = async () => { clear(); const { error: e } = await signInWithFacebook(); if (e) setError(e.message); };

  const pw_strength = strength(suPassword);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#EBF5FF 0%,#F8FAFF 55%,#EBF5FF 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px',
      fontFamily: "'Hind Siliguri', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* ── Brand above card ── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              background: `linear-gradient(135deg, ${A} 0%, #1565C0 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(30,136,229,.28)',
            }}>
              <Zap size={22} color="#fff" fill="#fff" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: A, lineHeight: 1.15 }}>লতা ইলেকট্রিক</div>
              <div style={{ fontSize: 11, color: '#8FA3BB', fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase' }}>Lata Electric</div>
            </div>
          </Link>
        </div>

        {/* ── Card ── */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          borderTop: `3px solid ${A}`,
          boxShadow: '0 24px 56px rgba(30,136,229,.11), 0 4px 16px rgba(30,136,229,.07)',
          overflow: 'hidden',
        }}>

          {/* Tab switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid #EEF2F7' }}>
            {[
              { key: 'signin', label: 'Sign In' },
              { key: 'signup', label: 'Create Account' },
            ].map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)} style={{
                flex: 1, padding: '17px 0', border: 'none', background: 'none',
                fontSize: 14, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? A : '#9AA5B4', cursor: 'pointer',
                borderBottom: `2.5px solid ${tab === t.key ? A : 'transparent'}`,
                marginBottom: -1, transition: 'all .2s', fontFamily: 'inherit',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '30px 32px 32px' }}>

            {/* Inline error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#FFF5F5', border: '1px solid #FECACA',
                borderRadius: 10, padding: '10px 14px',
                marginBottom: 22, fontSize: 13, color: '#B91C1C',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* ══════════════ SIGN IN ══════════════ */}
            {tab === 'signin' && view === 'main' && (
              <>
                <h2 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Welcome back</h2>
                <p  style={{ margin: '0 0 24px', fontSize: 13, color: '#8FA3BB' }}>Sign in to your account to continue</p>

                <form onSubmit={handleSignIn} noValidate>
                  {/* Email */}
                  <div style={fieldSt}>
                    <label style={labelSt}>Email Address</label>
                    <input
                      type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                      placeholder="you@example.com" autoComplete="email"
                      style={inputBase} onFocus={focusIn} onBlur={focusOut}
                    />
                  </div>

                  {/* Password */}
                  <div style={fieldSt}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ ...labelSt, marginBottom: 0 }}>Password</label>
                      <button type="button"
                        onClick={() => { setView('forgot'); clear(); }}
                        style={{ fontSize: 12, color: A, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>
                        Forgot password?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={siShowPw ? 'text' : 'password'} value={siPassword}
                        onChange={e => setSiPassword(e.target.value)}
                        placeholder="••••••••" autoComplete="current-password"
                        style={{ ...inputBase, paddingRight: 44 }} onFocus={focusIn} onBlur={focusOut}
                      />
                      <button type="button" onClick={() => setSiShowPw(v => !v)} style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#9AA5B4',
                        padding: 2, display: 'flex', alignItems: 'center',
                      }}>
                        {siShowPw ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
                    <input
                      type="checkbox" id="rememberMe" checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: A, cursor: 'pointer' }}
                    />
                    <label htmlFor="rememberMe" style={{ fontSize: 13, color: '#4A5568', cursor: 'pointer', fontWeight: 500 }}>
                      Remember me
                    </label>
                  </div>

                  <button
                    type="submit" disabled={loading}
                    style={{ ...primaryBtn, opacity: loading ? .75 : 1 }}
                    onMouseEnter={e => !loading && (e.currentTarget.style.background = AH)}
                    onMouseLeave={e => (e.currentTarget.style.background = A)}
                  >
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#EEF2F7' }} />
                  <span style={{ fontSize: 11, color: '#A8B4C0', fontWeight: 600, letterSpacing: .4, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                    Or continue with
                  </span>
                  <div style={{ flex: 1, height: 1, background: '#EEF2F7' }} />
                </div>

                {/* Social buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <SocialBtn onClick={handleGoogle}   brandColor="#4285F4" icon={<GoogleIcon />}   label="Google" />
                  <SocialBtn onClick={handleFacebook} brandColor="#1877F2" icon={<FacebookIcon />} label="Facebook" />
                </div>

                <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#8FA3BB' }}>
                  Don't have an account?{' '}
                  <button onClick={() => switchTab('signup')} style={{ color: A, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
                    Create one
                  </button>
                </p>
              </>
            )}

            {/* ══════════════ FORGOT PASSWORD ══════════════ */}
            {tab === 'signin' && view === 'forgot' && (
              <>
                <button
                  onClick={() => { setView('main'); setFpSent(false); setFpEmail(''); clear(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#8FA3BB', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', marginBottom: 20, padding: 0 }}
                >
                  <ArrowLeft size={15} /> Back to Sign In
                </button>

                {!fpSent ? (
                  <>
                    <h2 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Reset password</h2>
                    <p  style={{ margin: '0 0 24px', fontSize: 13, color: '#8FA3BB' }}>We'll email you a secure link to reset your password.</p>

                    <form onSubmit={handleForgotPassword} noValidate>
                      <div style={fieldSt}>
                        <label style={labelSt}>Email Address</label>
                        <input
                          type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                          placeholder="you@example.com" autoComplete="email"
                          style={inputBase} onFocus={focusIn} onBlur={focusOut}
                        />
                      </div>
                      <button
                        type="submit" disabled={loading}
                        style={{ ...primaryBtn, opacity: loading ? .75 : 1 }}
                        onMouseEnter={e => !loading && (e.currentTarget.style.background = AH)}
                        onMouseLeave={e => (e.currentTarget.style.background = A)}
                      >
                        {loading ? 'Sending…' : 'Send Reset Link'}
                      </button>
                    </form>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                    <div style={{ width: 60, height: 60, background: '#EEF5FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                      <CheckCircle2 size={30} color={A} />
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Check your inbox</h3>
                    <p  style={{ margin: 0, fontSize: 13, color: '#8FA3BB', lineHeight: 1.7 }}>
                      We sent a reset link to<br />
                      <strong style={{ color: '#374151' }}>{fpEmail}</strong>
                    </p>
                    <button
                      onClick={() => { setView('main'); setFpSent(false); setFpEmail(''); clear(); }}
                      style={{ marginTop: 22, padding: '10px 28px', background: A, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
                    >
                      Back to Sign In
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ══════════════ SIGN UP ══════════════ */}
            {tab === 'signup' && (
              <>
                {!signedUp ? (
                  <>
                    <h2 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Create your account</h2>
                    <p  style={{ margin: '0 0 24px', fontSize: 13, color: '#8FA3BB' }}>Join Lata Electric — shop smarter today</p>

                    <form onSubmit={handleSignUp} noValidate>
                      {/* Name row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <label style={labelSt}>First Name</label>
                          <input
                            type="text" value={suFirst} onChange={e => setSuFirst(e.target.value)}
                            placeholder="Rahim" autoComplete="given-name"
                            style={inputBase} onFocus={focusIn} onBlur={focusOut}
                          />
                        </div>
                        <div>
                          <label style={labelSt}>Last Name</label>
                          <input
                            type="text" value={suLast} onChange={e => setSuLast(e.target.value)}
                            placeholder="Uddin" autoComplete="family-name"
                            style={inputBase} onFocus={focusIn} onBlur={focusOut}
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div style={fieldSt}>
                        <label style={labelSt}>Email Address</label>
                        <input
                          type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)}
                          placeholder="you@example.com" autoComplete="email"
                          style={inputBase} onFocus={focusIn} onBlur={focusOut}
                        />
                      </div>

                      {/* Password + strength */}
                      <div style={fieldSt}>
                        <label style={labelSt}>Password</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={suShowPw ? 'text' : 'password'} value={suPassword}
                            onChange={e => setSuPassword(e.target.value)}
                            placeholder="Min. 6 characters" autoComplete="new-password"
                            style={{ ...inputBase, paddingRight: 44 }} onFocus={focusIn} onBlur={focusOut}
                          />
                          <button type="button" onClick={() => setSuShowPw(v => !v)} style={{
                            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: '#9AA5B4',
                            padding: 2, display: 'flex', alignItems: 'center',
                          }}>
                            {suShowPw ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>

                        {/* Strength meter */}
                        {suPassword && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                              {[1, 2, 3].map(i => (
                                <div key={i} style={{
                                  flex: 1, height: 3, borderRadius: 99,
                                  background: pw_strength >= i ? STRENGTH_COLORS[pw_strength] : '#E2E8F0',
                                  transition: 'background .25s',
                                }} />
                              ))}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: STRENGTH_COLORS[pw_strength] }}>
                              {STRENGTH_LABELS[pw_strength]}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Terms */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 22 }}>
                        <input
                          type="checkbox" id="terms" checked={terms}
                          onChange={e => setTerms(e.target.checked)}
                          style={{ width: 15, height: 15, accentColor: A, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
                        />
                        <label htmlFor="terms" style={{ fontSize: 13, color: '#4A5568', cursor: 'pointer', lineHeight: 1.55 }}>
                          I agree to the{' '}
                          <Link to="/terms"   style={{ color: A, fontWeight: 700, textDecoration: 'none' }}>Terms of Service</Link>
                          {' '}and{' '}
                          <Link to="/privacy" style={{ color: A, fontWeight: 700, textDecoration: 'none' }}>Privacy Policy</Link>
                        </label>
                      </div>

                      <button
                        type="submit" disabled={loading}
                        style={{ ...primaryBtn, opacity: loading ? .75 : 1 }}
                        onMouseEnter={e => !loading && (e.currentTarget.style.background = AH)}
                        onMouseLeave={e => (e.currentTarget.style.background = A)}
                      >
                        {loading ? 'Creating account…' : 'Create Account'}
                      </button>
                    </form>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0' }}>
                      <div style={{ flex: 1, height: 1, background: '#EEF2F7' }} />
                      <span style={{ fontSize: 11, color: '#A8B4C0', fontWeight: 600, letterSpacing: .4, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                        Or continue with
                      </span>
                      <div style={{ flex: 1, height: 1, background: '#EEF2F7' }} />
                    </div>

                    {/* Social buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <SocialBtn onClick={handleGoogle}   brandColor="#4285F4" icon={<GoogleIcon />}   label="Google" />
                      <SocialBtn onClick={handleFacebook} brandColor="#1877F2" icon={<FacebookIcon />} label="Facebook" />
                    </div>

                    <p style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: '#8FA3BB' }}>
                      Already have an account?{' '}
                      <button onClick={() => switchTab('signin')} style={{ color: A, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
                        Sign in
                      </button>
                    </p>
                  </>
                ) : (
                  /* ── Sign-up success ── */
                  <div style={{ textAlign: 'center', padding: '16px 8px 8px' }}>
                    <div style={{
                      width: 68, height: 68, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${A} 0%, #1565C0 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 20px',
                      boxShadow: '0 8px 24px rgba(30,136,229,.28)',
                    }}>
                      <CheckCircle2 size={32} color="#fff" />
                    </div>
                    <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#0F172A' }}>Almost there!</h3>
                    <p  style={{ margin: '0 0 6px', fontSize: 13, color: '#8FA3BB', lineHeight: 1.7 }}>
                      We sent a confirmation email to
                    </p>
                    <p  style={{ margin: '0 0 24px', fontSize: 14, fontWeight: 700, color: '#374151' }}>
                      {suEmail}
                    </p>
                    <p  style={{ margin: '0 0 24px', fontSize: 13, color: '#8FA3BB', lineHeight: 1.7 }}>
                      Click the link in that email to activate your account, then sign in.
                    </p>
                    <button
                      onClick={() => { switchTab('signin'); setSignedUp(false); }}
                      style={{ ...primaryBtn, width: 'auto', padding: '11px 32px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = AH)}
                      onMouseLeave={e => (e.currentTarget.style.background = A)}
                    >
                      Go to Sign In
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: '#A8B4C0', lineHeight: 1.8 }}>
          Your data is protected with industry-standard encryption.
          <br />
          <Link to="/" style={{ color: '#8FA3BB', textDecoration: 'none', fontWeight: 600 }}>← Back to store</Link>
        </p>
      </div>
    </div>
  );
}

/* ─── Social button sub-component ─── */
function SocialBtn({ onClick, brandColor, icon, label }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '11px 8px',
        border: `1.5px solid ${hov ? brandColor : '#E2E8F0'}`,
        borderRadius: 10,
        background: hov ? '#F7FAFF' : '#FAFBFC',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'inherit',
        transition: 'border-color .2s, background .2s',
      }}
    >
      {icon} {label}
    </button>
  );
}
