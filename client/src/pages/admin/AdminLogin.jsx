import { useState, useEffect } from 'react';
import { useNavigate, useLocation }  from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const { login, admin } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/admin/dashboard';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [attempts, setAttempts] = useState(0);

  // Already logged in → redirect
  useEffect(() => {
    if (admin) navigate(from, { replace: true });
  }, [admin, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Both email and password are required.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
      setAttempts(a => a + 1);
      // Clear password field on failure
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoWrap}>
          <img src="/images/logo.jpg" alt="Lata Electric" style={styles.logo}
            onError={e => { e.target.style.display='none'; }} />
          <div>
            <div style={styles.brandBn}>লতা ইলেকট্রিক</div>
            <div style={styles.brandEn}>Lata Electric</div>
          </div>
        </div>

        <div style={styles.divider} />

        <h1 style={styles.heading}>Admin Portal</h1>
        <p style={styles.subheading}>Sign in to manage your store</p>

        {error && (
          <div style={styles.errorBox} role="alert">
            <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>Email Address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@lataelectric.com"
              required
              disabled={loading}
              style={styles.input}
              onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={e  => Object.assign(e.target.style, styles.input)}
            />
          </div>

          {/* Password */}
          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                style={{ ...styles.input, paddingRight: '2.8rem' }}
                onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
                onBlur={e  => Object.assign(e.target.style, styles.input)}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={styles.eyeBtn}
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Attempts warning */}
          {attempts >= 3 && (
            <p style={{ fontSize: '0.8rem', color: '#e67e22', marginBottom: '0.75rem' }}>
              <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{5 - attempts} attempt{5-attempts !== 1 ? 's' : ''} remaining before lockout.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading
              ? <span>Signing in<span style={styles.dot}>…</span></span>
              : 'Sign In'}
          </button>
        </form>

        <p style={styles.footer}>
          Lata Electric Admin Portal &nbsp;·&nbsp; Authorised access only
        </p>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight:      '100vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'linear-gradient(135deg, #212529 0%, #16213e 50%, #1565C0 100%)',
    fontFamily:     "'Hind Siliguri', 'Segoe UI', system-ui, sans-serif",
    padding:        '1rem',
  },
  card: {
    background:   '#fff',
    borderRadius: '16px',
    padding:      '2.5rem 2.25rem',
    width:        '100%',
    maxWidth:     '420px',
    boxShadow:    '0 25px 60px rgba(0,0,0,0.35)',
  },
  logoWrap: {
    display:        'flex',
    alignItems:     'center',
    gap:            '0.75rem',
    marginBottom:   '1rem',
    justifyContent: 'center',
  },
  logo: {
    width:        '52px',
    height:       '52px',
    objectFit:    'contain',
    borderRadius: '50%',
    border:       '2px solid #1E88E5',
  },
  brandBn: { fontWeight: 700, fontSize: '1rem',   color: '#212529', lineHeight: 1.2 },
  brandEn: { fontWeight: 500, fontSize: '0.75rem', color: '#555',   letterSpacing: '0.5px' },
  divider: { height: '1px', background: '#f0f0f0', margin: '1rem 0' },
  heading: {
    margin:     '0 0 0.25rem',
    fontSize:   '1.4rem',
    fontWeight: 700,
    color:      '#212529',
    textAlign:  'center',
  },
  subheading: { margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#888', textAlign: 'center' },
  errorBox: {
    background:   '#fef2f2',
    border:       '1px solid #fca5a5',
    borderRadius: '8px',
    padding:      '0.6rem 0.85rem',
    marginBottom: '1rem',
    fontSize:     '0.85rem',
    color:        '#b91c1c',
    display:      'flex',
    alignItems:   'center',
  },
  field: { marginBottom: '1rem' },
  label: { display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: '#374151' },
  input: {
    width:        '100%',
    padding:      '0.65rem 0.9rem',
    border:       '1.5px solid #d1d5db',
    borderRadius: '8px',
    fontSize:     '0.9rem',
    outline:      'none',
    background:   '#fafafa',
    boxSizing:    'border-box',
    transition:   'border-color 0.15s',
    color:        '#111',
  },
  inputFocus: {
    width:        '100%',
    padding:      '0.65rem 0.9rem',
    border:       '1.5px solid #1E88E5',
    borderRadius: '8px',
    fontSize:     '0.9rem',
    outline:      'none',
    background:   '#fff',
    boxSizing:    'border-box',
    color:        '#111',
  },
  eyeBtn: {
    position:   'absolute',
    right:      '0.6rem',
    top:        '50%',
    transform:  'translateY(-50%)',
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    fontSize:   '1rem',
    lineHeight: 1,
    padding:    '0.25rem',
  },
  submitBtn: {
    width:        '100%',
    padding:      '0.75rem',
    background:   'linear-gradient(90deg,#1E88E5,#e74c3c)',
    color:        '#fff',
    border:       'none',
    borderRadius: '8px',
    fontWeight:   700,
    fontSize:     '1rem',
    marginTop:    '0.5rem',
    boxShadow:    '0 4px 12px rgba(192,57,43,0.35)',
    transition:   'transform 0.1s',
  },
  dot: { display: 'inline-block', animation: 'pulse 1s infinite' },
  footer: { marginTop: '1.5rem', textAlign: 'center', fontSize: '0.72rem', color: '#bbb' },
};
