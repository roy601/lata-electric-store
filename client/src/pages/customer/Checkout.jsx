import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, X, Package, Minus, Plus, Lock, RotateCcw, Banknote, MessageCircle, ChevronDown, Loader2 } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { supabase } from '../../lib/supabase';
import { BD_DISTRICTS, DISTRICT_BN, AREAS } from '../../lib/bdLocations';
import { PROMISES } from '../../content/policies';
import { placeOrder, getMyOrders, validateCoupon } from '../../api/customerApi';
import toast from 'react-hot-toast';
import { useSeo } from '../../lib/seo';

const BLUE  = '#1E88E5';
const BKASH = '#E2136E';
const NAGAD = '#F47920';
const GREEN = '#15803D';
const RED   = '#B42318';
const ink   = 'var(--ink)';
const muted = 'var(--tx-64748b, #64748B)';
const edge  = '1px solid var(--panel-edge)';
const panel = { background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)' };
const taka  = (n) => '৳' + Math.round(Number(n || 0)).toLocaleString('en-BD');
// Districts the shop delivers to at the "inside Dhaka" rate
const DHAKA_RATE = ['Dhaka', 'Gazipur', 'Narayanganj', 'Narsingdi', 'Manikganj', 'Munshiganj'];

/* Bangladeshi mobile: 01 + operator digit 3–9 + 8 digits (also accepts +880 / 880) */
const normPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('880') ? '0' + d.slice(3) : d; };
function phoneProblem(p) {
  const d = normPhone(p);
  if (!d) return 'Enter your mobile number';
  if (!d.startsWith('01')) return 'Mobile numbers start with 01';
  if (d.length < 11) return `${11 - d.length} more digit${11 - d.length !== 1 ? 's' : ''} needed`;
  if (d.length > 11) return 'Too many digits — 11 needed';
  if (!/^01[3-9]/.test(d)) return 'Check the operator code (013–019)';
  return null;
}

/* A number that rolls smoothly to its new value */
function Rolling({ value, style }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current, end = value;
    if (start === end || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { from.current = end; setShown(end); return; }
    let raf; const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - k, 3);
      const v = start + (end - start) * e; setShown(v); from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="num" style={style}>{taka(shown)}</span>;
}

/* Labelled field with inline message and a tick when valid */
function Field({ label, hint, error, ok, children, id, shakeKey }) {
  const box = useRef(null);
  // a short shake when the form is submitted with this field wrong (no re-render, focus stays)
  useEffect(() => {
    if (!error || !shakeKey || !box.current?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    box.current.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 360, easing: 'ease-out' });
  }, [shakeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600, color: ink, marginBottom: 6 }}>
        <span>{label}</span>{hint && <span style={{ fontWeight: 400, fontSize: 12.5, color: muted }}>{hint}</span>}
      </label>
      <div ref={box} style={{ position: 'relative' }}>
        {children}
        {ok && !error && <Check size={17} color={GREEN} className="pop-in" style={{ position: 'absolute', right: 12, top: '50%', marginTop: -8.5, pointerEvents: 'none' }} />}
      </div>
      {error && <div role="alert" className="slide-in" style={{ fontSize: 12.5, color: RED, marginTop: 5 }}>{error}</div>}
    </div>
  );
}

export default function Checkout() {
  useSeo({ title: 'Checkout', noindex: true });
  const { items, clear, replace, update, remove } = useCartStore();
  const { user, updateProfile } = useCustomerAuth();
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(null);
  const [prodDetails, setProdDetails] = useState({});
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [shake, setShake] = useState(0);
  const [navH, setNavH] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', address: '', district: '', area: '', notes: '', email: '', payment: 'Cash on Delivery', txId: '' });
  const [saveDetails, setSaveDetails] = useState(true);
  const upd = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };
  const refs = { name: useRef(null), phone: useRef(null), district: useRef(null), area: useRef(null), address: useRef(null), txId: useRef(null) };

  /* Signed in → fill in saved details (or the last order's), never overwriting typing */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const m = user.user_metadata || {};
    const fill = (src) => setForm(f => ({
      ...f, name: f.name || src.name || '', phone: f.phone || src.phone || '', address: f.address || src.address || '',
      district: f.district || src.district || '', area: f.area || src.area || '', email: user.email || f.email,
    }));
    fill({ name: m.full_name || [m.first_name, m.last_name].filter(Boolean).join(' '), phone: m.phone, address: m.address, district: m.district, area: m.area });
    if (!m.address || !m.phone) {
      getMyOrders().then(({ data }) => {
        const o = data.orders?.[0];
        if (!o || cancelled) return;
        const district = o.customer_district || o.customer_city || '';
        const full = String(o.customer_address || '');
        const street = district && full.endsWith(`, ${district}`) ? full.slice(0, -(district.length + 2)) : full;
        fill({ name: o.customer_name, phone: o.customer_phone, address: street, district });
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      setSettings(data || {});
      if (data?.payment_methods?.length) setForm(f => ({ ...f, payment: data.payment_methods[0] }));
    });
    setNavH(document.querySelector('[data-bottom-nav]')?.offsetHeight || 0);
  }, []);

  /* Phones: the sticky Place-order bar is showing — lift the chat button and messages above it */
  useEffect(() => {
    if (!isMobile) return;
    document.body.style.setProperty('--buybar-h', '66px');
    document.body.classList.add('has-buybar');
    return () => document.body.classList.remove('has-buybar');
  }, [isMobile]);

  /* empty cart → back to the cart (but not right after placing an order) */
  const placedRef = useRef(false);
  useEffect(() => { if (items.length === 0 && !placedRef.current) navigate('/cart'); }, [items, navigate]);

  /* Re-check the saved cart against live products (removed items, price and stock changes) */
  const syncCart = async () => {
    const current = useCartStore.getState().items;
    if (current.length === 0) return;
    const { data } = await supabase.from('products')
      .select('id,name,price,original_price,flash_sale,flash_price,variants,stock,is_active,image')
      .in('id', [...new Set(current.map(i => i.id))]);
    if (!data) return;
    const map = Object.fromEntries(data.map(p => [p.id, p]));
    setProdDetails(map);
    const notes = [], used = {}, next = [];
    for (const i of current) {
      const p = map[i.id];
      if (!p || p.is_active === false) { notes.push(`"${i.name}" is no longer available and was removed`); continue; }
      const allowed = [+p.price];
      if (p.flash_sale && p.flash_price) allowed.push(+p.flash_price);
      (Array.isArray(p.variants) ? p.variants : []).forEach(v => (v.options || []).forEach(o => { if (o?.price != null && o.price !== '') allowed.push(+o.price); }));
      let price = +i.price;
      if (!allowed.includes(price)) { price = p.flash_sale && p.flash_price ? +p.flash_price : +p.price; notes.push(`The price of "${p.name}" changed to ৳${price}`); }
      const stock = Math.max(0, +p.stock || 0);
      const left = stock - (used[p.id] || 0);
      if (left <= 0) { notes.push(`"${p.name}" is out of stock and was removed`); continue; }
      const qty = Math.min(i.qty, left);
      if (qty < i.qty) notes.push(`Only ${qty} of "${p.name}" in stock — quantity updated`);
      used[p.id] = (used[p.id] || 0) + qty;
      next.push({ ...i, name: p.name, price, qty, stock });
    }
    if (notes.length > 0 || next.some((n, k) => n.stock !== current[k]?.stock)) replace(next);
    notes.forEach(n => toast(n, { duration: 5000 }));
    return notes.length;
  };
  useEffect(() => { syncCart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* money */
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const originalTotal = items.reduce((s, i) => s + (prodDetails[i.id]?.original_price || i.price) * i.qty, 0);
  const savings = Math.max(0, originalTotal - subtotal) + couponDiscount;
  const inside = DHAKA_RATE.includes(form.district);
  const deliveryBase = form.district ? (inside ? (settings?.shipping_inside ?? 60) : (settings?.shipping_outside ?? 120)) : null;
  const freeOver = Number(settings?.free_delivery_threshold) || 0;
  const freeDelivery = freeOver > 0 && subtotal >= freeOver;
  const delivery = freeDelivery ? 0 : (deliveryBase ?? 0);
  const total = Math.max(0, subtotal + delivery - couponDiscount);
  const deliveryTime = inside ? (settings?.delivery_time_inside || PROMISES.deliveryDhakaDays) : (settings?.delivery_time_outside || PROMISES.deliveryOutsideDays);
  const methods = settings?.payment_methods?.length ? settings.payment_methods : ['Cash on Delivery'];
  const unitCount = items.reduce((s, i) => s + i.qty, 0);
  const wa = String(settings?.whatsapp || '').replace(/\D/g, '');

  /* coupon */
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true); setCouponError('');
    try {
      const { data } = await validateCoupon(couponCode.trim(), subtotal);
      setCouponDiscount(data.discount); setAppliedCoupon(data.coupon);
    } catch (err) { setCouponError(err.response?.data?.message || 'This code is not valid'); }
    finally { setCouponLoading(false); }
  };

  /* validation */
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Enter your full name';
    const ph = phoneProblem(form.phone); if (ph) e.phone = ph;
    if (!form.district) e.district = 'Choose your district';
    if (!form.area.trim()) e.area = 'Choose or type your area / thana';
    if (form.address.trim().length < 5) e.address = 'Add house, road and area so the rider can find you';
    if ((form.payment === 'bKash' || form.payment === 'Nagad') && form.txId.trim().length < 6) e.txId = `Enter the ${form.payment} Transaction ID from the SMS`;
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Check the email address';
    return e;
  };

  const place = async () => {
    const e = validate();
    setErrors(e); setTouched({ name: 1, phone: 1, address: 1, district: 1, area: 1 }); setShake(s => s + 1);
    const first = ['name', 'phone', 'district', 'area', 'address', 'txId'].find(k => e[k]);
    if (first || e.email) {
      const el = refs[first]?.current; if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus?.({ preventScroll: true }), 350); }
      return;
    }
    setPlacing(true);
    try {
      const phone = normPhone(form.phone);
      const { data } = await placeOrder({
        customer_name: form.name.trim(), customer_phone: phone,
        customer_address: [form.address.trim(), form.area.trim(), form.district].filter(Boolean).join(', '),
        customer_city: form.district, customer_district: form.district,
        customer_email: form.email || null, order_notes: form.notes || null,
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, image: i.image, variant: i.variant || null })),
        subtotal, delivery_charge: delivery, total, payment_method: form.payment, transaction_id: form.txId || null,
        coupon_code: appliedCoupon?.code || null, coupon_discount: couponDiscount || null,
      });
      placedRef.current = true;
      if (user && saveDetails) {
        const m = user.user_metadata || {};
        const [firstName, ...rest] = form.name.trim().split(/\s+/);
        updateProfile({ phone, address: form.address.trim(), district: form.district, area: form.area,
          ...(!m.first_name && firstName ? { first_name: firstName, last_name: rest.join(' ') } : {}) }).catch(() => {});
      }
      const summary = { phone, name: form.name.trim(), total, payment: form.payment, district: form.district, deliveryTime, units: unitCount,
        thumbs: items.slice(0, 4).map(i => i.image).filter(Boolean), wa };
      setDone(true);
      try { navigator.vibrate?.(15); } catch { /* not supported */ }
      setTimeout(() => { clear(); navigate(`/order-placed/${data.order_id}`, { state: summary, replace: true }); }, 650);
    } catch (err) {
      toast.error((err.response?.data?.message || err.message || 'Could not place the order'), { duration: 6000 });
      if (err.response?.status === 409) await syncCart();
      setPlacing(false);
    }
  };

  const copyNum = (num) => navigator.clipboard?.writeText(num).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  if (!settings) return (
    <CustomerLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 14px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: 20 }}>
        <div className="skel" style={{ height: 520, borderRadius: 'var(--r-md)' }} />
        {!isMobile && <div className="skel" style={{ height: 380, borderRadius: 'var(--r-md)' }} />}
      </div>
    </CustomerLayout>
  );

  const inp = (k) => ({
    width: '100%', padding: '11px 14px', paddingRight: 38, border: `1px solid ${errors[k] ? RED : 'rgba(15,23,42,.16)'}`, borderRadius: 'var(--r-sm)',
    fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--bg-fff, #fff)', color: ink, transition: 'border-color .2s, box-shadow .2s', outline: 'none',
  });
  const focus = (e) => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = '0 0 0 3px rgba(30,136,229,.15)'; };
  const blur = (k) => (e) => { e.target.style.borderColor = errors[k] ? RED : 'rgba(15,23,42,.16)'; e.target.style.boxShadow = 'none'; setTouched(t => ({ ...t, [k]: 1 })); };
  const sectionTitle = (n, t) => (
    <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: ink }}>
      <span className="num" style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--bg-fff, #fff)', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>{t}
    </h2>
  );
  const phoneOk = !phoneProblem(form.phone);
  const areas = AREAS[form.district] || [];
  const linkBtn = { background: 'none', border: 'none', padding: 0, color: BLUE, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' };

  const placeButton = (full) => (
    <button onClick={place} disabled={placing}
      style={{ width: full ? '100%' : 'auto', flex: full ? undefined : 1, padding: '14px 22px', background: done ? GREEN : BLUE, color: '#fff', border: 'none', borderRadius: 'var(--pill)', fontWeight: 700, fontSize: 16, cursor: placing ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, transition: 'background .3s', whiteSpace: 'nowrap' }}>
      {done ? <><Check size={19} className="pop-in" /> Order placed</>
        : placing ? <><Loader2 size={18} className="spin" /> Placing order…</>
        : <>Place order · <Rolling value={total} /></>}
    </button>
  );

  const paymentPanel = (brand, color, number) => (
    <div className="slide-in" style={{ border: `1px solid ${color}55`, background: `${color}0D`, borderRadius: 'var(--r-md)', padding: 16, marginTop: 4 }}>
      <ol style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 14, color: ink, lineHeight: 1.7 }}>
        <li>Open the {brand} app and choose <b>Payment</b> (Pay to Merchant)</li>
        <li>Send exactly <b className="num">{taka(total)}</b> to the number below</li>
        <li>Enter the Transaction ID from the {brand} SMS here</li>
      </ol>
      {number && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-sm)', padding: '10px 12px', marginBottom: 12 }}>
          <div><div style={{ fontSize: 12, color: muted }}>{brand} merchant number</div><div className="num" style={{ fontSize: 20, fontWeight: 700, color: ink, letterSpacing: 1 }}>{number}</div></div>
          <button onClick={() => copyNum(number)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: edge, borderRadius: 'var(--pill)', background: copied ? '#DCFCE7' : 'var(--bg-fff, #fff)', color: copied ? GREEN : ink, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      )}
      <Field label="Transaction ID (TrxID)" id="txId" error={errors.txId} ok={form.txId.trim().length >= 6} shakeKey={shake}>
        <input id="txId" ref={refs.txId} value={form.txId} onChange={e => upd('txId', e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="e.g. 9DZ3K7Q2LM"
          style={{ ...inp('txId'), letterSpacing: 1 }} onFocus={focus} onBlur={blur('txId')} />
      </Field>
      {(brand === 'bKash' ? settings.bkash_instructions : settings.nagad_instructions) && <div style={{ fontSize: 13, color: muted }}>{brand === 'bKash' ? settings.bkash_instructions : settings.nagad_instructions}</div>}
    </div>
  );

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '14px 10px 150px' : '24px 14px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontWeight: 700, color: ink }}>Checkout</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: muted }}><Lock size={14} /> Secure checkout</span>
        </div>
        {!user && (
          <div style={{ fontSize: 14, color: muted, marginBottom: 16 }}>
            Have an account? <Link to="/login?next=/checkout" className="more-link" style={{ color: BLUE, fontWeight: 600 }}>Sign in</Link> for faster checkout and order history. Or just continue as a guest.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 380px', gap: isMobile ? 12 : 20, alignItems: 'start' }}>
          {/* ════ Form ════ */}
          <div style={{ display: 'grid', gap: isMobile ? 12 : 16, minWidth: 0 }}>
            <section style={{ ...panel, padding: isMobile ? '18px 14px 6px' : '24px 24px 8px' }}>
              {sectionTitle(1, 'Delivery details')}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', columnGap: 14 }}>
                <Field label="Full name" hint="আপনার নাম" id="name" error={touched.name && errors.name} ok={form.name.trim().length > 1} shakeKey={shake}>
                  <input id="name" ref={refs.name} autoComplete="name" value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Your full name" style={inp('name')} onFocus={focus} onBlur={blur('name')} />
                </Field>
                <Field label="Mobile number" hint="মোবাইল" id="phone" error={(touched.phone && form.phone ? phoneProblem(form.phone) : null) || errors.phone} ok={phoneOk} shakeKey={shake}>
                  <input id="phone" ref={refs.phone} type="tel" inputMode="numeric" autoComplete="tel" value={form.phone} onChange={e => upd('phone', e.target.value.replace(/[^\d+]/g, '').slice(0, 14))}
                    placeholder="01XXXXXXXXX" style={{ ...inp('phone'), letterSpacing: .5 }} onFocus={focus} onBlur={blur('phone')} />
                </Field>
                <Field label="District" hint="জেলা" id="district" error={errors.district} ok={!!form.district} shakeKey={shake}>
                  <select id="district" ref={refs.district} value={form.district} onChange={e => { upd('district', e.target.value); upd('area', ''); }}
                    style={{ ...inp('district'), appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: form.district ? ink : muted }} onFocus={focus} onBlur={blur('district')}>
                    <option value="">Choose district</option>
                    {BD_DISTRICTS.map(d => <option key={d} value={d}>{d}{DISTRICT_BN[d] ? ` — ${DISTRICT_BN[d]}` : ''}</option>)}
                  </select>
                  {!form.district && <ChevronDown size={16} color="#94A3B8" style={{ position: 'absolute', right: 12, top: '50%', marginTop: -8, pointerEvents: 'none' }} />}
                </Field>
                <Field label="Area / Thana" hint="থানা" id="area" error={errors.area} ok={form.area.trim().length > 1} shakeKey={shake}>
                  <input id="area" ref={refs.area} list="area-list" value={form.area} onChange={e => upd('area', e.target.value)} disabled={!form.district}
                    placeholder={form.district ? 'Choose or type your area' : 'Choose a district first'} style={{ ...inp('area'), background: form.district ? 'var(--bg-fff, #fff)' : 'var(--bg-f8fafc, #F8FAFC)' }} onFocus={focus} onBlur={blur('area')} />
                  <datalist id="area-list">{areas.map(a => <option key={a} value={a} />)}</datalist>
                </Field>
              </div>
              <Field label="Address" hint="বাসা, রোড, এলাকা" id="address" error={touched.address && errors.address} ok={form.address.trim().length >= 5} shakeKey={shake}>
                <input id="address" ref={refs.address} autoComplete="street-address" value={form.address} onChange={e => upd('address', e.target.value)} placeholder="House 12, Road 5, Block C" style={inp('address')} onFocus={focus} onBlur={blur('address')} />
              </Field>

              {form.district && (
                <div key={form.district} className="slide-in" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-f8fafc, #F8FAFC)', border: edge, borderRadius: 'var(--r-sm)', padding: '10px 12px', marginBottom: 16, fontSize: 14, color: ink }}>
                  <span style={{ flex: 1 }}>Delivery to <b>{form.district}</b> · {deliveryTime}</span>
                  <b className="num" style={{ color: freeDelivery ? GREEN : ink }}>{freeDelivery ? 'Free' : taka(deliveryBase)}</b>
                </div>
              )}

              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
                {!showNote && <button style={linkBtn} onClick={() => setShowNote(true)}>+ Add a note for the rider</button>}
                {!user && !showEmail && <button style={linkBtn} onClick={() => setShowEmail(true)}>+ Email me the receipt</button>}
              </div>
              {showNote && (
                <div className="slide-in"><Field label="Note" hint="optional" id="notes">
                  <textarea id="notes" rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="e.g. Call before coming, gate code, best time" style={{ ...inp('notes'), resize: 'vertical', lineHeight: 1.5 }} onFocus={focus} onBlur={blur('notes')} />
                </Field></div>
              )}
              {!user && showEmail && (
                <div className="slide-in"><Field label="Email" hint="optional" id="email" error={errors.email} ok={/^\S+@\S+\.\S+$/.test(form.email)} shakeKey={shake}>
                  <input id="email" type="email" autoComplete="email" value={form.email} onChange={e => upd('email', e.target.value)} placeholder="you@example.com" style={inp('email')} onFocus={focus} onBlur={blur('email')} />
                </Field></div>
              )}
              {user && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: ink, marginBottom: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={saveDetails} onChange={e => setSaveDetails(e.target.checked)} style={{ width: 16, height: 16, accentColor: BLUE }} />
                  Save these details for next time
                </label>
              )}
            </section>

            <section style={{ ...panel, padding: isMobile ? '18px 14px' : 24 }}>
              {sectionTitle(2, 'Payment')}
              <div role="radiogroup" style={{ display: 'grid', gap: 10 }}>
                {methods.map(m => {
                  const on = form.payment === m;
                  const color = m === 'bKash' ? BKASH : m === 'Nagad' ? NAGAD : BLUE;
                  const sub = m === 'bKash' ? 'Pay now with bKash' : m === 'Nagad' ? 'Pay now with Nagad' : 'Pay in cash when the parcel arrives';
                  return (
                    <div key={m}>
                      <button role="radio" aria-checked={on} onClick={() => { upd('payment', m); upd('txId', ''); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', border: `1.5px solid ${on ? color : 'rgba(15,23,42,.14)'}`, borderRadius: 'var(--r-md)', background: on ? `${color}0A` : 'var(--bg-fff, #fff)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color .2s, background .2s' }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? color : '#CBD5E1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color .2s' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, transform: on ? 'scale(1)' : 'scale(0)', transition: 'transform .2s cubic-bezier(.3,1.6,.5,1)' }} />
                        </span>
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: ink }}>{m}</span>
                          <span style={{ display: 'block', fontSize: 13, color: muted }}>{sub}</span>
                        </span>
                        {m === 'bKash' && <span style={{ background: BKASH, color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--r-sm)' }}>bKash</span>}
                        {m === 'Nagad' && <span style={{ background: NAGAD, color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--r-sm)' }}>Nagad</span>}
                        {m !== 'bKash' && m !== 'Nagad' && <Banknote size={22} color={on ? color : '#94A3B8'} />}
                      </button>
                      {on && m === 'bKash' && paymentPanel('bKash', BKASH, settings.bkash_number)}
                      {on && m === 'Nagad' && paymentPanel('Nagad', NAGAD, settings.nagad_number)}
                    </div>
                  );
                })}
              </div>
              {!isMobile && <div style={{ marginTop: 20 }}>{placeButton(true)}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, auto)', justifyContent: 'start', gap: isMobile ? 8 : 22, marginTop: 16, fontSize: 13, color: muted }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Banknote size={15} /> Cash on delivery available</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RotateCcw size={15} /> {PROMISES.returnWindowDays}-day returns</span>
                {wa && <a href={`https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: muted, textDecoration: 'none' }}><MessageCircle size={15} /> Help on WhatsApp</a>}
              </div>
            </section>
          </div>

          {/* ════ Summary ════ */}
          <aside style={{ ...panel, padding: isMobile ? 14 : 20, position: isMobile ? 'static' : 'sticky', top: 90, order: isMobile ? -1 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ink }}>Your order</h2>
              <Link to="/cart" className="more-link" style={{ fontSize: 13, color: muted }}>{unitCount} item{unitCount !== 1 ? 's' : ''} · Edit cart</Link>
            </div>

            {items.map(i => {
              const key = i.key || String(i.id);
              return (
                <div key={key} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: edge }}>
                  <span style={{ width: 52, height: 52, flexShrink: 0, border: edge, borderRadius: 'var(--r-sm)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i.image ? <img src={i.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={18} color="#CBD5E1" />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: ink, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{i.name}</div>
                    {i.variant && <div style={{ fontSize: 12, color: muted }}>{i.variant}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(15,23,42,.15)', borderRadius: 'var(--pill)' }}>
                        <button aria-label="One less" onClick={() => update(key, i.qty - 1)} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
                        <span className="num" style={{ minWidth: 18, textAlign: 'center', fontSize: 13.5, fontWeight: 600 }}>{i.qty}</span>
                        <button aria-label="One more" disabled={i.stock != null && i.qty >= i.stock} onClick={() => update(key, i.qty + 1)} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: i.stock != null && i.qty >= i.stock ? '#CBD5E1' : ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
                      </div>
                      <button onClick={() => remove(key)} aria-label={`Remove ${i.name}`} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: muted, display: 'flex' }}><X size={15} /></button>
                    </div>
                  </div>
                  <Rolling value={i.price * i.qty} style={{ fontSize: 14, fontWeight: 600, color: ink, whiteSpace: 'nowrap' }} />
                </div>
              );
            })}

            {/* Coupon */}
            <div style={{ borderTop: edge, padding: '12px 0' }}>
              {appliedCoupon ? (
                <div className="slide-in" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: GREEN }}>
                  <Check size={16} className="pop-in" /> <b>{appliedCoupon.code}</b> applied
                  <button onClick={() => { setAppliedCoupon(null); setCouponDiscount(0); setCouponCode(''); }} aria-label="Remove coupon" style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: muted, display: 'flex' }}><X size={15} /></button>
                </div>
              ) : !couponOpen ? (
                <button style={linkBtn} onClick={() => setCouponOpen(true)}>Have a coupon code?</button>
              ) : (
                <div className="slide-in">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input autoFocus value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }} onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                      placeholder="Enter code" style={{ ...inp('coupon'), paddingRight: 14, fontSize: 14, borderColor: couponError ? RED : 'rgba(15,23,42,.16)' }} onFocus={focus} onBlur={e => { e.target.style.boxShadow = 'none'; }} />
                    <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
                      style={{ padding: '0 16px', border: 'none', borderRadius: 'var(--r-sm)', background: 'var(--ink)', color: 'var(--bg-fff, #fff)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: couponLoading || !couponCode.trim() ? .5 : 1 }}>
                      {couponLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                  {couponError && <div className="slide-in" style={{ fontSize: 12.5, color: RED, marginTop: 5 }}>{couponError}</div>}
                </div>
              )}
            </div>

            {/* Totals */}
            <div style={{ borderTop: edge, paddingTop: 12, display: 'grid', gap: 7, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: ink }}><span style={{ color: muted }}>Subtotal</span><Rolling value={subtotal} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: ink }}>
                <span style={{ color: muted }}>Delivery</span>
                {freeDelivery ? <b style={{ color: GREEN }}>Free</b> : deliveryBase == null ? <span style={{ color: muted }}>Choose district</span> : <Rolling value={deliveryBase} />}
              </div>
              {couponDiscount > 0 && <div className="slide-in" style={{ display: 'flex', justifyContent: 'space-between', color: GREEN }}><span>Coupon {appliedCoupon?.code}</span><span className="num">−{taka(couponDiscount)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: edge, paddingTop: 10, marginTop: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: ink }}>Total</span>
                <Rolling value={total} style={{ fontSize: 22, fontWeight: 700, color: ink, letterSpacing: '-0.02em' }} />
              </div>
              {savings > 0 && <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: GREEN }}>You save {taka(savings)}</div>}
            </div>

            {/* Free delivery progress */}
            {freeOver > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-f1f5f9, #F1F5F9)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, subtotal / freeOver * 100)}%`, height: '100%', background: freeDelivery ? GREEN : BLUE, borderRadius: 3, transition: 'width .6s cubic-bezier(.2,.7,.2,1), background .3s' }} />
                </div>
                <div style={{ fontSize: 13, color: freeDelivery ? GREEN : muted, marginTop: 6 }}>
                  {freeDelivery ? '✓ You get free delivery' : <>Add <b className="num" style={{ color: ink }}>{taka(freeOver - subtotal)}</b> more for free delivery</>}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Phones: total and button always in reach */}
      {isMobile && (
        <div className="slide-up" style={{ position: 'fixed', left: 0, right: 0, bottom: navH, zIndex: 390, background: 'var(--bg-fff, #fff)', borderTop: edge, boxShadow: '0 -8px 24px -12px rgba(15,23,42,.25)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: muted }}>Total{deliveryBase == null && !freeDelivery ? ' (before delivery)' : ''}</div>
            <Rolling value={total} style={{ fontSize: 19, fontWeight: 700, color: ink }} />
          </div>
          <button onClick={place} disabled={placing}
            style={{ flex: 1, padding: '13px 16px', background: done ? GREEN : BLUE, color: '#fff', border: 'none', borderRadius: 'var(--pill)', fontWeight: 700, fontSize: 15.5, cursor: placing ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .3s' }}>
            {done ? <><Check size={18} className="pop-in" /> Placed</> : placing ? <><Loader2 size={17} className="spin" /> Placing…</> : 'Place order'}
          </button>
        </div>
      )}
    </CustomerLayout>
  );
}
