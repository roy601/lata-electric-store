import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useSeo } from '../../lib/seo';

const A = '#1E88E5';   // same accent as the sign-in page

/* The "reset password" email link opens this page. Supabase reads the link and
   signs the customer in for this one purpose; they then choose a new password. */
export default function ResetPassword() {
  useSeo({ title: 'Reset Password', noindex: true });
  const navigate = useNavigate();
  const { user, loading, updatePassword } = useCustomerAuth();
  const [pw, setPw]       = useState('');
  const [pw2, setPw2]     = useState('');
  const [show, setShow]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [done, setDone]   = useState(false);
  const [waited, setWaited] = useState(false);

  // Give Supabase a moment to read the link before deciding it is invalid
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, []);
  // The link itself may carry an error (expired / already used)
  const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_description')
    || new URLSearchParams(window.location.search).get('error_description');

  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (pw.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    if (pw !== pw2)     { setError('The two passwords do not match.'); return; }
    setBusy(true);
    const { error: err } = await updatePassword(pw);
    setBusy(false);
    if (err) { setError(/different from the old/i.test(err.message) ? 'Please choose a password different from your old one.' : err.message); return; }
    setDone(true);
    setTimeout(() => navigate('/account', { replace: true }), 1800);
  };

  const inp = { width: '100%', padding: '11px 40px 11px 14px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
  const card = (children) => (
    <CustomerLayout>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: 'linear-gradient(160deg,#EEF2F8,#F6F8FC,#EDF1F8)' }}>
        <div style={{ background: '#fff', borderRadius: 20, borderTop: `3px solid ${A}`, boxShadow: '0 10px 40px rgba(15,23,42,.10)', padding: '32px 28px', width: '100%', maxWidth: 420 }}>
          {children}
        </div>
      </div>
    </CustomerLayout>
  );

  if (done) return card(
    <div style={{ textAlign: 'center' }}>
      <CheckCircle2 size={48} color="#16A34A" style={{ marginBottom: 12 }} />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>Password changed</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>You're signed in. Taking you to your account…</p>
    </div>
  );

  if (!user && (linkError || (!loading && waited))) return card(
    <div style={{ textAlign: 'center' }}>
      <AlertCircle size={44} color="#DC2626" style={{ marginBottom: 12 }} />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>This link has expired</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 22px', lineHeight: 1.6 }}>
        Password reset links work once and only for a short time. Please ask for a new one.
      </p>
      <Link to="/login" style={{ display: 'inline-block', padding: '12px 26px', background: A, color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>
        Get a new link
      </Link>
    </div>
  );

  if (!user) return card(<div style={{ textAlign: 'center', color: '#6B7280', fontSize: 14 }}>Checking your link…</div>);

  return card(
    <form onSubmit={submit}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <KeyRound size={24} color={A} />
      </div>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>Choose a new password</h1>
      <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 20px' }}>For {user.email}</p>

      {error && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>New password</label>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" autoFocus style={inp} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9AA5B4', display: 'flex' }}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Type it again</label>
      <input type={show ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" style={{ ...inp, marginBottom: 20 }} />

      <button type="submit" disabled={busy}
        style={{ width: '100%', padding: '13px', background: busy ? '#94A3B8' : A, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}
