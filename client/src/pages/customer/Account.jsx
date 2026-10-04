import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, Inbox, Clock, CheckCircle2, Truck, XCircle, RotateCcw, Search, LogIn, LogOut, User, KeyRound, ShoppingBag, AlertCircle, Eye, EyeOff, ChevronDown, Plus } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { getMyOrders, claimOrder } from '../../api/customerApi';
import { supabase } from '../../lib/supabase';
import { BD_DISTRICTS, AREAS } from '../../lib/bdLocations';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import toast from 'react-hot-toast';

const BLUE = '#1E88E5';
const NAVY = '#1E3A5F';

const STATUS_META = {
  pending:          { bg: '#fff3cd', color: '#856404',  Icon: Clock,         label: 'Pending' },
  confirmed:        { bg: '#cfe2ff', color: '#084298',  Icon: CheckCircle2,  label: 'Confirmed' },
  shipped:          { bg: '#d1ecf1', color: '#0c5460',  Icon: Truck,         label: 'Shipped' },
  delivered:        { bg: '#d1e7dd', color: '#0f5132',  Icon: Package,       label: 'Delivered' },
  cancelled:        { bg: '#f8d7da', color: '#842029',  Icon: XCircle,       label: 'Cancelled' },
  return_requested: { bg: '#fff0e0', color: '#7d4000',  Icon: RotateCcw,     label: 'Return Requested' },
  returned:         { bg: '#ede7f6', color: '#4527a0',  Icon: RotateCcw,     label: 'Returned' },
};

const TABS = [
  { key: 'orders',   label: 'My Orders',  Icon: ShoppingBag },
  { key: 'profile',  label: 'Profile',    Icon: User },
  { key: 'password', label: 'Password',   Icon: KeyRound },
];

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', background: '#FAFBFC', outline: 'none' };
const lb  = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 };
const card = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: 22 };
const digits = (s) => String(s || '').replace(/\D/g, '');

/* ── WhatsApp / phone for return requests, from Admin → Settings ── */
function useShopContact() {
  const [c, setC] = useState({});
  useEffect(() => {
    supabase.from('settings').select('phone, whatsapp').eq('id', 1).maybeSingle().then(({ data }) => setC(data || {}));
  }, []);
  return c;
}
const returnLink = (contact, order) => {
  const msg = encodeURIComponent(`Hello Lata Electric, I would like to return items from order #${order.order_id}.`);
  const wa = digits(contact.whatsapp);
  if (wa) return { href: `https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}?text=${msg}`, label: 'Request Return on WhatsApp', external: true };
  if (digits(contact.phone)) return { href: `tel:${digits(contact.phone)}`, label: 'Call to Request a Return', external: false };
  return null;
};

/* ── "Add a past order": guest orders placed before signing up ── */
function ClaimOrder({ onAdded, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!orderId.trim() || digits(phone).length < 10) { toast.error('Enter the order ID and the phone number used for it'); return; }
    setBusy(true);
    try {
      const { data } = await claimOrder(orderId.trim(), phone.trim());
      toast.success(data.message || 'Order added');
      setOrderId(''); setPhone(''); setOpen(false);
      onAdded();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not add the order'); }
    setBusy(false);
  };
  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fff', color: BLUE, border: '1px dashed #90CAF9', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
      <Plus size={14} /> Add a past order
    </button>
  );
  return (
    <form onSubmit={submit} style={{ ...card, padding: 16, textAlign: 'left' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Add a past order to your account</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>For orders you placed as a guest. Enter its order ID and the phone number you used.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="Order ID — e.g. LE1A2B3C" style={{ ...inp, flex: '1 1 160px', width: 'auto' }} />
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" style={{ ...inp, flex: '1 1 140px', width: 'auto' }} />
        <button type="submit" disabled={busy} style={{ padding: '10px 18px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          {busy ? 'Adding…' : 'Add order'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ padding: '10px 12px', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </form>
  );
}

/* ═════════ Orders ═════════ */
function OrdersTab() {
  const contact = useShopContact();
  const [orders,   setOrders]   = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error,    setError]    = useState(null);   // { message }
  const [expanded, setExpanded] = useState({});
  const fmt = (n) => '৳' + Number(n || 0).toLocaleString('en-BD');

  const load = () => {
    setFetching(true); setError(null);
    getMyOrders()
      .then(({ data }) => setOrders(data.orders || []))
      .catch(err => setError({ message: err.response?.data?.message || 'Could not load your orders. Please check your connection.' }))
      .finally(() => setFetching(false));
  };
  useEffect(load, []);

  if (fetching) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5b1' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #f0f0f0', borderTop: `3px solid ${BLUE}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      Loading your orders…
    </div>
  );

  if (error) return (
    <div style={{ ...card, textAlign: 'center' }}>
      <AlertCircle size={36} color="#DC2626" style={{ marginBottom: 10 }} />
      <div style={{ fontWeight: 700, color: '#212529', marginBottom: 6 }}>Something went wrong</div>
      <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>{error.message}</div>
      <button onClick={load} style={{ padding: '9px 20px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Try again</button>
    </div>
  );

  if (orders.length === 0) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: '#9aa5b1' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Inbox size={56} color="#ccc" /></div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#374151' }}>No orders yet</div>
      <p style={{ fontSize: 14, color: '#9aa5b1', maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.6 }}>
        Orders you place while signed in appear here. Ordered before you had an account? Add it below.
      </p>
      <div style={{ maxWidth: 520, margin: '0 auto 18px' }}><ClaimOrder onAdded={load} /></div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/products" style={{ padding: '10px 20px', background: BLUE, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>Start shopping</Link>
      </div>
    </div>
  );

  return <>
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '10px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', fontSize: 13 }}>
        <span style={{ color: '#9aa5b1' }}>Total orders: </span><span style={{ fontWeight: 700, color: '#212529' }}>{orders.length}</span>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, padding: '10px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', fontSize: 13 }}>
        <span style={{ color: '#9aa5b1' }}>Total spent: </span>
        <span style={{ fontWeight: 700, color: BLUE }}>{fmt(orders.filter(o => !['cancelled', 'returned'].includes(o.status)).reduce((s, o) => s + Number(o.total || 0), 0))}</span>
      </div>
    </div>
    <div style={{ marginBottom: 16 }}><ClaimOrder onAdded={load} /></div>

    {orders.map(o => {
      const meta = STATUS_META[o.status] || STATUS_META.pending;
      const open = expanded[o.id];
      const items = o.items || [];
      const ret = o.status === 'delivered' ? returnLink(contact, o) : null;
      return (
        <div key={o.id} style={{ background: '#fff', borderRadius: 14, marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'hidden' }}>
          <button onClick={() => setExpanded(p => ({ ...p, [o.id]: !p[o.id] }))} aria-expanded={!!open}
            style={{ width: '100%', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: '#212529' }}>#{o.order_id}</span>
                <span style={{ background: meta.bg, color: meta.color, padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <meta.Icon size={12} /> {meta.label}
                </span>
                {o.payment_paid && <span style={{ background: '#d1e7dd', color: '#0f5132', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Paid</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 4 }}>
                {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: BLUE }}>{fmt(o.total)}</div>
                <div style={{ fontSize: 12, color: '#9aa5b1' }}>{o.payment_method}</div>
              </div>
              <ChevronDown size={18} color="#bbb" style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </div>
          </button>

          <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {items.slice(0, 4).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8f9fa', borderRadius: 8, padding: '5px 10px', fontSize: 13 }}>
                {item.image && <img src={item.image} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover' }} />}
                <span style={{ color: '#333', fontWeight: 500 }}>{item.name}</span>
                <span style={{ color: '#9aa5b1' }}>×{item.qty}</span>
              </div>
            ))}
            {items.length > 4 && <div style={{ background: '#f0f0f0', borderRadius: 8, padding: '5px 10px', fontSize: 13, color: '#9aa5b1' }}>+{items.length - 4} more</div>}
          </div>

          {open && (
            <div style={{ borderTop: '1px solid #f0f0f0', padding: '16px 20px' }}>
              <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Delivery Address</div>
                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>
                  <div><strong>{o.customer_name}</strong> · {o.customer_phone}</div>
                  <div>{o.customer_address}</div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Order Items</div>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0f0f0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={18} color="#ccc" />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#212529' }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: '#9aa5b1' }}>৳{item.price} × {item.qty}</div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#212529', flexShrink: 0 }}>৳{item.price * item.qty}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #eee', marginTop: 10, paddingTop: 10, fontSize: 13, color: '#555' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Subtotal</span><span>৳{o.subtotal}</span></div>
                  {Number(o.coupon_discount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#16A34A' }}><span>Coupon {o.coupon_code}</span><span>-৳{o.coupon_discount}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Delivery</span><span>{Number(o.delivery_charge) === 0 ? 'Free' : `৳${o.delivery_charge}`}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, color: '#212529' }}><span>Total</span><span style={{ color: BLUE }}>{fmt(o.total)}</span></div>
                </div>
              </div>

              {o.return_reason && (
                <div style={{ background: '#ede7f6', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4527a0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Return Reason</div>
                  <div style={{ fontSize: 13, color: '#333' }}>{o.return_reason}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to={`/track/${o.order_id}`} state={{ phone: o.customer_phone }}
                  style={{ padding: '9px 20px', background: '#212529', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Search size={13} /> Track Order
                </Link>
                {ret && (
                  <a href={ret.href} target={ret.external ? '_blank' : undefined} rel="noopener noreferrer"
                    style={{ padding: '9px 20px', background: '#f8f9fa', color: '#333', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, border: '1px solid #e0e0e0', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <RotateCcw size={13} /> {ret.label}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      );
    })}
  </>;
}

/* ═════════ Profile ═════════ */
function ProfileTab({ user, updateProfile, isMobile }) {
  const m = user.user_metadata || {};
  // Google/Facebook give one full name — split it when first/last aren't saved yet
  const [gFirst = '', ...gRest] = String(m.full_name || m.name || '').trim().split(/\s+/);
  const initial = { first_name: m.first_name || gFirst, last_name: m.last_name || (m.first_name ? '' : gRest.join(' ')), phone: m.phone || '', address: m.address || '', district: m.district || '', area: m.area || '' };
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const upd = (k, v) => setF(x => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const areas = AREAS[f.district] || [];

  const save = async (e) => {
    e.preventDefault();
    if (!f.first_name.trim()) { toast.error('Please enter your first name'); return; }
    if (f.phone && digits(f.phone).length !== 11) { toast.error('Phone number must be 11 digits (01XXXXXXXXX)'); return; }
    setBusy(true);
    const { error } = await updateProfile({
      first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: f.phone.trim(),
      address: f.address.trim(), district: f.district, area: f.area.trim(),
    });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success('Profile saved');
  };

  const two = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 };
  return (
    <form onSubmit={save} style={card}>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>Your details</h2>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6B7280' }}>Used to fill in checkout for you.</p>
      <div style={two}>
        <div><label style={lb}>First name</label><input value={f.first_name} onChange={e => upd('first_name', e.target.value)} style={inp} autoComplete="given-name" /></div>
        <div><label style={lb}>Last name</label><input value={f.last_name} onChange={e => upd('last_name', e.target.value)} style={inp} autoComplete="family-name" /></div>
      </div>
      <div style={two}>
        <div>
          <label style={lb}>Email</label>
          <div style={{ ...inp, background: '#F1F5F9', color: '#475569' }}>{user.email}</div>
        </div>
        <div><label style={lb}>Mobile number</label><input type="tel" value={f.phone} onChange={e => upd('phone', e.target.value)} placeholder="01XXXXXXXXX" style={inp} autoComplete="tel" /></div>
      </div>

      <h3 style={{ margin: '22px 0 10px', fontSize: 15, fontWeight: 800 }}>Saved delivery address</h3>
      <div style={{ marginBottom: 14 }}>
        <label style={lb}>Address</label>
        <input value={f.address} onChange={e => upd('address', e.target.value)} placeholder="House / flat, road, area" style={inp} autoComplete="street-address" />
      </div>
      <div style={two}>
        <div>
          <label style={lb}>District</label>
          <select value={f.district} onChange={e => setF(x => ({ ...x, district: e.target.value, area: '' }))} style={inp}>
            <option value="">Select district</option>
            {BD_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={lb}>Area / Thana</label>
          {areas.length ? (
            <select value={f.area} onChange={e => upd('area', e.target.value)} style={inp}>
              <option value="">Select area</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          ) : <input value={f.area} onChange={e => upd('area', e.target.value)} placeholder="Area / thana" style={inp} />}
        </div>
      </div>

      <button type="submit" disabled={busy || !dirty}
        style={{ padding: '11px 26px', background: dirty ? BLUE : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, cursor: busy ? 'wait' : dirty ? 'pointer' : 'default', fontFamily: 'inherit' }}>
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

/* ═════════ Password ═════════ */
function PasswordTab({ user, updatePassword }) {
  const social = (user.app_metadata?.providers || [user.app_metadata?.provider]).filter(p => p && p !== 'email');
  const hasPassword = (user.app_metadata?.providers || []).includes('email') || user.app_metadata?.provider === 'email';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (pw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (pw !== pw2)    { toast.error('The two passwords do not match'); return; }
    setBusy(true);
    const { error } = await updatePassword(pw);
    setBusy(false);
    if (error) {
      toast.error(/reauthentication|recent/i.test(error.message)
        ? 'For safety, please sign out and sign in again, then change your password.'
        : /different from the old/i.test(error.message) ? 'Please choose a password different from your current one.' : error.message);
      return;
    }
    setPw(''); setPw2('');
    toast.success('Password changed');
  };

  return (
    <form onSubmit={save} style={card}>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>{hasPassword ? 'Change password' : 'Set a password'}</h2>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6B7280' }}>
        {hasPassword ? 'Choose a new password of at least 6 characters.'
          : `You sign in with ${social.map(p => p[0].toUpperCase() + p.slice(1)).join(' / ') || 'a social account'}. You can also set a password to sign in with your email.`}
      </p>
      <label style={lb}>New password</label>
      <div style={{ position: 'relative', marginBottom: 14, maxWidth: 380 }}>
        <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" style={{ ...inp, paddingRight: 40 }} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9AA5B4', display: 'flex' }}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <label style={lb}>Type it again</label>
      <input type={show ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" style={{ ...inp, maxWidth: 380, marginBottom: 18 }} />
      <div>
        <button type="submit" disabled={busy}
          style={{ padding: '11px 26px', background: BLUE, color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          {busy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
        </button>
      </div>
    </form>
  );
}

/* ═════════ Page ═════════ */
export default function Account() {
  const { user, loading: authLoading, signOut, updateProfile, updatePassword } = useCustomerAuth();
  const { isMobile } = useBreakpoint();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'orders';
  const setTab = (key) => setSearchParams(key === 'orders' ? {} : { tab: key }, { replace: true });

  if (authLoading) {
    return (
      <CustomerLayout>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #f0f0f0', borderTop: `3px solid ${BLUE}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      </CustomerLayout>
    );
  }

  if (!user) {
    return (
      <CustomerLayout>
        <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Package size={32} color={NAVY} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#212529', margin: '0 0 10px' }}>My Account</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>
            Sign in to see your orders, track deliveries and save your delivery address.
          </p>
          <Link to={`/login?next=${encodeURIComponent('/account' + (tab !== 'orders' ? `?tab=${tab}` : ''))}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 32px', background: NAVY, color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>
            <LogIn size={16} /> Sign in
          </Link>
          <div style={{ marginTop: 24, fontSize: 13, color: '#9aa5b1' }}>
            Placed a guest order? <Link to="/track" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Track it here →</Link>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  const m = user.user_metadata || {};
  const displayName = m.full_name || m.first_name || user.email;

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '20px 12px' : '32px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: NAVY, color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : String(displayName)[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#212529', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</h1>
              <div style={{ fontSize: 13, color: '#9aa5b1', marginTop: 2 }}>{user.email}</div>
            </div>
          </div>
          <button onClick={signOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#f8f9fa', color: '#555', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        {/* Tabs */}
        <div role="tablist" style={{ display: 'flex', gap: 4, boxShadow: 'inset 0 -1px 0 #E5E7EB', marginBottom: 20, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }}>
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2.5px solid ${tab === key ? BLUE : 'transparent'}`, color: tab === key ? BLUE : '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'orders'   && <OrdersTab />}
        {tab === 'profile'  && <ProfileTab key={user.id} user={user} updateProfile={updateProfile} isMobile={isMobile} />}
        {tab === 'password' && <PasswordTab user={user} updatePassword={updatePassword} />}
      </div>
    </CustomerLayout>
  );
}
