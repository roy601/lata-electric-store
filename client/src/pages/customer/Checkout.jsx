import { useEffect, useRef, useState, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck, CreditCard, CheckCircle2, Check, Copy,
  X, User, Package, Tag, ChevronRight, ChevronDown,
} from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { supabase } from '../../lib/supabase';
import { BD_DISTRICTS, AREAS } from '../../lib/bdLocations';
import { placeOrder, getMyOrders, validateCoupon } from '../../api/customerApi';
import toast from 'react-hot-toast';
import { useSeo } from '../../lib/seo';

/* ── design tokens ── */
const CRM   = '#C0143C';
const BKASH = '#E2136E';
const BLUE  = '#1E88E5';
const GREEN = '#16A34A';

/* ── step config ── */
const STEPS = [
  { label: 'Shipping', Icon: Truck },
  { label: 'Payment',  Icon: CreditCard },
  { label: 'Review',   Icon: CheckCircle2 },
];

/* ── step bar ── */
function StepBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 28, padding: '0 8px' }}>
      {STEPS.map((s, i) => (
        <Fragment key={s.label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: step > i + 1 ? GREEN : step === i + 1 ? BLUE : 'var(--bg-e5e7eb, #E5E7EB)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: step === i + 1 ? `0 0 0 4px ${BLUE}22` : 'none',
              transition: 'all .3s',
            }}>
              {step > i + 1
                ? <Check size={20} color="#fff" />
                : <s.Icon size={18} color={step >= i + 1 ? '#fff' : '#9CA3AF'} />}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, marginTop: 6, color: step >= i + 1 ? 'var(--tx-374151, #374151)' : 'var(--tx-9ca3af, #9CA3AF)' }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, marginTop: 21, background: step > i + 1 ? GREEN : 'var(--bg-e5e7eb, #E5E7EB)', transition: 'background .3s' }} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

/* ── price row ── */
function Row({ label, value, red, green, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 7 }}>
      <span style={{ color: 'var(--tx-6b7280, #6B7280)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600, color: red ? '#DC2626' : green ? GREEN : 'var(--tx-0f172a, #0F172A)' }}>{value}</span>
    </div>
  );
}

/* ── select wrapper with arrow ── */
function Select({ value, onChange, children, style }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={onChange}
        style={{ ...style, appearance: 'none', WebkitAppearance: 'none', paddingRight: 32, cursor: 'pointer' }}>
        {children}
      </select>
      <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--tx-9ca3af, #9CA3AF)' }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN CHECKOUT
══════════════════════════════════════════════════════════ */
export default function Checkout() {
  useSeo({ title: 'Checkout', noindex: true });
  const { items, clear, replace } = useCartStore();
  const { user, updateProfile } = useCustomerAuth();
  const { isMobile }     = useBreakpoint();
  const navigate         = useNavigate();

  const [step,          setStep]          = useState(1);
  const [settings,      setSettings]      = useState(null);
  const [prodDetails,   setProdDetails]   = useState({});
  const [dismissed,     setDismissed]     = useState(false);
  const [placing,       setPlacing]       = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [couponCode,    setCouponCode]    = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponDiscount,setCouponDiscount]= useState(0);
  const [couponLoading, setCouponLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', phone: '', address: '', district: '', area: '',
    notes: '', email: '', payment: 'Cash on Delivery', txId: '',
  });
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [saveDetails, setSaveDetails] = useState(true);

  /* Signed in → fill in the customer's saved details (or their last order's), never
     overwriting what they already typed */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const m = user.user_metadata || {};
    const fill = (src) => setForm(f => ({
      ...f,
      name:     f.name     || src.name     || '',
      phone:    f.phone    || src.phone    || '',
      address:  f.address  || src.address  || '',
      district: f.district || src.district || '',
      area:     f.area     || src.area     || '',
      email:    user.email || f.email,
    }));
    const saved = { name: m.full_name || [m.first_name, m.last_name].filter(Boolean).join(' '), phone: m.phone, address: m.address, district: m.district, area: m.area };
    fill(saved);
    if (!m.address || !m.phone) {
      getMyOrders().then(({ data }) => {
        const o = data.orders?.[0];
        if (!o || cancelled) return;
        // Stored address ends with ", <district>" — drop that part (district has its own field)
        const district = o.customer_district || o.customer_city || '';
        const full = String(o.customer_address || '');
        const street = district && full.endsWith(`, ${district}`) ? full.slice(0, -(district.length + 2)) : full;
        fill({ name: o.customer_name, phone: o.customer_phone, address: street, district });
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* load settings */
  useEffect(() => {
    supabase.from('settings')
      .select('shipping_inside,shipping_outside,free_delivery_threshold,payment_methods,bkash_number,nagad_number,bkash_instructions,nagad_instructions')
      .eq('id', 1).maybeSingle()
      .then(({ data }) => {
        setSettings(data);
        if (data?.payment_methods?.length) setForm(f => ({ ...f, payment: data.payment_methods[0] }));
      });
  }, []);

  /* empty cart → back to cart page (but not right after placing an order) */
  const placedRef = useRef(false);
  useEffect(() => {
    if (items.length === 0 && !placedRef.current) navigate('/cart');
  }, [items, navigate]);

  /* Re-check the saved cart against live products: removes products that are gone,
     fixes changed prices and caps quantities to current stock. Carts live in the
     browser, so they can be days old. */
  const syncCart = async () => {
    const current = useCartStore.getState().items;
    if (current.length === 0) return;
    const { data } = await supabase.from('products')
      .select('id,name,price,original_price,flash_sale,flash_price,variants,stock,is_active,image')
      .in('id', [...new Set(current.map(i => i.id))]);
    if (!data) return;
    const map = {};
    data.forEach(p => { map[p.id] = p; });
    setProdDetails(map);

    const notes = [];
    const used  = {};
    const next  = [];
    for (const i of current) {
      const p = map[i.id];
      if (!p || p.is_active === false) { notes.push(`"${i.name}" is no longer available and was removed`); continue; }
      const allowed = [+p.price];
      if (p.flash_sale && p.flash_price) allowed.push(+p.flash_price);
      (Array.isArray(p.variants) ? p.variants : []).forEach(v => (v.options || []).forEach(o => { if (o?.price != null && o.price !== '') allowed.push(+o.price); }));
      let price = +i.price;
      if (!allowed.includes(price)) {
        price = p.flash_sale && p.flash_price ? +p.flash_price : +p.price;
        notes.push(`The price of "${p.name}" changed to ৳${price}`);
      }
      const stock = Math.max(0, +p.stock || 0);
      const left  = stock - (used[p.id] || 0);
      if (left <= 0) { notes.push(`"${p.name}" is out of stock and was removed`); continue; }
      const qty = Math.min(i.qty, left);
      if (qty < i.qty) notes.push(`Only ${qty} of "${p.name}" in stock — quantity updated`);
      used[p.id] = (used[p.id] || 0) + qty;
      next.push({ ...i, name: p.name, price, qty, stock });
    }
    const changed = notes.length > 0 || next.some((n, k) => n.stock !== current[k]?.stock);
    if (changed) replace(next);
    notes.forEach(n => toast(n, { duration: 5000 }));
    return notes.length;
  };
  useEffect(() => { syncCart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* calculations */
  const subtotal      = items.reduce((s, i) => s + i.qty * i.price, 0);
  const originalTotal = items.reduce((s, i) => {
    const pd = prodDetails[i.id];
    return s + (pd?.original_price || i.price) * i.qty;
  }, 0);
  const productSavings = Math.max(0, originalTotal - subtotal);

  const insideDhaka   = ['Dhaka','Gazipur','Narayanganj','Narsingdi','Manikganj','Munshiganj'].includes(form.district);
  const deliveryBase  = insideDhaka ? (settings?.shipping_inside || 60) : (settings?.shipping_outside || 120);
  const freeThreshold = settings?.free_delivery_threshold;
  const delivery      = freeThreshold && subtotal >= freeThreshold ? 0 : deliveryBase;
  const total         = Math.max(0, subtotal + delivery - couponDiscount);
  const methods       = settings?.payment_methods || ['Cash on Delivery'];
  const bkashNum      = settings?.bkash_number || '';
  const nagadNum      = settings?.nagad_number || '';

  /* coupon */
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const { data } = await validateCoupon(couponCode.trim(), subtotal);
      setCouponDiscount(data.discount);
      setAppliedCoupon(data.coupon);
      toast.success(`Coupon applied — ৳${data.discount} off!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon code');
    } finally { setCouponLoading(false); }
  };

  /* step navigation */
  const goNext = () => {
    if (step === 1) {
      if (!form.name.trim())    { toast.error('Please enter your full name'); return; }
      if (form.phone.replace(/\D/g,'').length !== 11) { toast.error('Please enter a valid 11-digit phone number'); return; }
      if (!form.address.trim()) { toast.error('Please enter your delivery address'); return; }
      if (!form.district)       { toast.error('Please select your district'); return; }
    }
    if (step === 2 && (form.payment === 'bKash' || form.payment === 'Nagad') && !form.txId.trim()) {
      toast.error(`Please enter your ${form.payment} Transaction ID`); return;
    }
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* place order */
  const place = async () => {
    setPlacing(true);
    try {
      const { data } = await placeOrder({
        customer_name:     form.name,
        customer_phone:    form.phone,
        customer_address:  [form.address, form.area, form.district].filter(Boolean).join(', '),
        customer_city:     form.district,
        customer_district: form.district,
        customer_email:    form.email || null,
        order_notes:       form.notes || null,
        items:             items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, image: i.image, variant: i.variant || null })),
        subtotal,
        delivery_charge:   delivery,
        total,
        payment_method:    form.payment,
        transaction_id:    form.txId || null,
        coupon_code:       appliedCoupon?.code || null,
        coupon_discount:   couponDiscount || null,
      });
      placedRef.current = true;
      clear();
      // Remember the delivery details on the account for next time
      if (user && saveDetails) {
        const m = user.user_metadata || {};
        const [first, ...rest] = form.name.trim().split(/\s+/);
        updateProfile({
          phone: form.phone.trim(), address: form.address.trim(), district: form.district, area: form.area,
          ...(!m.first_name && first ? { first_name: first, last_name: rest.join(' ') } : {}),
        }).catch(() => {});
      }
      toast.success('Order placed successfully!');
      navigate(`/track/${data.order_id}`, { state: { phone: form.phone, justPlaced: true } });
    } catch (err) {
      toast.error('Order failed: ' + (err.response?.data?.message || err.message), { duration: 6000 });
      // Prices/stock moved since the cart was filled — refresh it so the next try succeeds
      if (err.response?.status === 409) await syncCart();
    } finally { setPlacing(false); }
  };

  /* copy number */
  const copyNum = (num) => {
    navigator.clipboard?.writeText(num).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2200);
    });
  };

  if (!settings) return (
    <CustomerLayout><div style={{ padding: 80, textAlign: 'center', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>Loading…</div></CustomerLayout>
  );

  /* shared input style */
  const inp = {
    width: '100%', padding: '10px 14px', border: '1.5px solid var(--bd-e2e8f0, #E2E8F0)',
    borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
    fontFamily: 'inherit', background: 'var(--bg-fafbfc, #FAFBFC)', color: 'var(--tx-1a202c, #1A202C)', transition: 'border-color .2s',
  };
  const inpFocus = e => { e.target.style.borderColor = BLUE; };
  const inpBlur  = e => { e.target.style.borderColor = 'var(--bd-e2e8f0, #E2E8F0)'; };
  const lb  = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--tx-374151, #374151)', marginBottom: 5 };
  const fd  = { marginBottom: 16 };
  const areas = AREAS[form.district] || [];

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 16px', minHeight: '70vh' }}>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)', marginBottom: 18 }}>Checkout</h1>

        {/* ── Guest banner ── */}
        {!user && !dismissed && (
          <div style={{ background: 'var(--bg-fff, #fff)', border: '1.5px solid var(--bd-e5e7eb, #E5E7EB)', borderRadius: 'var(--r-md)', marginBottom: 20, boxShadow: 'none', outline: '1px solid var(--hairline)', outlineOffset: -1 }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {/* icon */}
              <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg,#1E3A5F,#1E88E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={18} color="#fff" />
              </div>
              {/* text */}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-111827, #111827)', marginBottom: 4 }}>
                  You are checking out as a guest
                </div>
                <div style={{ fontSize: 12, color: 'var(--tx-6b7280, #6B7280)' }}>
                  Sign in to unlock faster checkout and more
                </div>
              </div>
              {/* actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <Link to="/login?next=/checkout" style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#1E3A5F,#1E88E5)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Login →
                </Link>
                <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-9ca3af, #9CA3AF)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', padding: '4px 2px', whiteSpace: 'nowrap' }}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step bar ── */}
        <StepBar step={step} />

        {/* ── Main grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: 24, alignItems: 'start' }}>

          {/* ════ LEFT COLUMN ════ */}
          <div>

            {/* ── STEP 1: SHIPPING ── */}
            {step === 1 && (
              <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-md)', padding: 24, boxShadow: 'none', outline: '1px solid var(--hairline)', outlineOffset: -1 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)' }}>Shipping Information</h3>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div style={fd}>
                    <label style={lb}>Full Name (আপনার নাম) <span style={{ color: CRM }}>*</span></label>
                    <input value={form.name} onChange={e => upd('name', e.target.value)}
                      placeholder="আপনার সম্পূর্ণ নাম লিখুন"
                      style={inp} onFocus={inpFocus} onBlur={inpBlur} />
                  </div>
                  <div style={fd}>
                    <label style={lb}>Mobile Number (মোবাইল নাম্বার) <span style={{ color: CRM }}>*</span></label>
                    <input type="tel" value={form.phone} onChange={e => upd('phone', e.target.value)}
                      placeholder="01XXXXXXXXX"
                      style={{ ...inp, borderColor: form.phone && form.phone.replace(/\D/g,'').length !== 11 ? '#DC2626' : 'var(--bd-e2e8f0, #E2E8F0)' }}
                      onFocus={e => e.target.style.borderColor = form.phone && form.phone.replace(/\D/g,'').length !== 11 ? '#DC2626' : BLUE}
                      onBlur={e  => e.target.style.borderColor = form.phone && form.phone.replace(/\D/g,'').length !== 11 ? '#DC2626' : 'var(--bd-e2e8f0, #E2E8F0)'} />
                    {form.phone && form.phone.replace(/\D/g,'').length !== 11 && (
                      <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: 500 }}>Must be exactly 11 digits</div>
                    )}
                  </div>
                </div>

                <div style={fd}>
                  <label style={lb}>Delivery Address (ঠিকানা) <span style={{ color: CRM }}>*</span></label>
                  <input value={form.address} onChange={e => upd('address', e.target.value)}
                    placeholder="বাসা/ফ্ল্যাট, রোড, এলাকা"
                    style={inp} onFocus={inpFocus} onBlur={inpBlur} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={fd}>
                    <label style={lb}>District <span style={{ color: CRM }}>*</span></label>
                    <Select value={form.district} onChange={e => { upd('district', e.target.value); upd('area', ''); }} style={inp}>
                      <option value="">Select District</option>
                      {BD_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </Select>
                  </div>
                  <div style={fd}>
                    <label style={lb}>Area/Thana <span style={{ color: CRM }}>*</span></label>
                    {areas.length > 0 ? (
                      <Select value={form.area} onChange={e => upd('area', e.target.value)} style={inp}>
                        <option value="">Select Area</option>
                        {areas.map(a => <option key={a} value={a}>{a}</option>)}
                      </Select>
                    ) : (
                      <input value={form.area} onChange={e => upd('area', e.target.value)}
                        placeholder="Enter area/thana"
                        style={inp} onFocus={inpFocus} onBlur={inpBlur} />
                    )}
                  </div>
                </div>

                <div style={fd}>
                  <label style={lb}>Order Notes (Optional)</label>
                  <textarea value={form.notes} onChange={e => upd('notes', e.target.value)}
                    rows={3} placeholder="Any special instructions for your order…"
                    style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={inpFocus} onBlur={inpBlur} />
                </div>

                <div style={{ ...fd, marginBottom: 24 }}>
                  <label style={lb}>Email {user ? '' : '(Optional)'}</label>
                  {user ? (
                    <div style={{ ...inp, background: 'var(--bg-f1f5f9, #F1F5F9)', color: 'var(--tx-475569, #475569)' }}>{user.email}</div>
                  ) : (
                    <input type="email" value={form.email} onChange={e => upd('email', e.target.value)}
                      placeholder="your@email.com"
                      style={inp} onFocus={inpFocus} onBlur={inpBlur} />
                  )}
                  {user && <div style={{ fontSize: 11, color: 'var(--tx-6b7280, #6B7280)', marginTop: 4 }}>This order will be saved under My Orders in your account.</div>}
                </div>
                {user && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx-374151, #374151)', margin: '-8px 0 20px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={saveDetails} onChange={e => setSaveDetails(e.target.checked)} />
                    Save these delivery details for next time
                  </label>
                )}

                <button onClick={goNext}
                  style={{ width: '100%', padding: '14px', background: CRM, color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#A3112F'}
                  onMouseLeave={e => e.currentTarget.style.background = CRM}>
                  Continue to Payment <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ── STEP 2: PAYMENT ── */}
            {step === 2 && (
              <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-md)', padding: 24, boxShadow: 'none', outline: '1px solid var(--hairline)', outlineOffset: -1 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)' }}>Payment Method</h3>

                {/* Method selector cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {methods.map(m => {
                    const isBkash = m === 'bKash';
                    const isNagad = m === 'Nagad';
                    const ac = isBkash ? BKASH : isNagad ? '#F47920' : BLUE;
                    return (
                      <label key={m} onClick={() => { upd('payment', m); upd('txId', ''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--r-md)', border: `2px solid ${form.payment === m ? ac : 'var(--bd-e2e8f0, #E2E8F0)'}`, background: form.payment === m ? (isBkash ? 'var(--bg-fff0f6, #FFF0F6)' : isNagad ? 'var(--bg-fff8f0, #FFF8F0)' : 'var(--bg-eff6ff, #EFF6FF)') : 'var(--bg-fff, #fff)', cursor: 'pointer', transition: 'all .15s' }}>
                        <input type="radio" name="payment" checked={form.payment === m} onChange={() => { upd('payment', m); upd('txId',''); }} style={{ accentColor: ac }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isBkash && <span style={{ background: BKASH, color: '#fff', fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 4, letterSpacing: .3 }}>bKash</span>}
                            {isNagad && <span style={{ background: '#F47920', color: '#fff', fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 4 }}>Nagad</span>}
                            {!isBkash && !isNagad && <span style={{ background: 'var(--bg-e5e7eb, #E5E7EB)', color: 'var(--tx-374151, #374151)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>COD</span>}
                            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-0f172a, #0F172A)' }}>{m}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--tx-6b7280, #6B7280)', marginTop: 3 }}>
                            {isBkash && 'Pay using bKash merchant payment (মার্চেন্ট পেমেন্ট)'}
                            {isNagad && 'Pay using Nagad merchant payment'}
                            {!isBkash && !isNagad && 'Pay in cash when your order is delivered'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* ── bKash merchant panel ── */}
                {form.payment === 'bKash' && bkashNum && (
                  <div style={{ background: 'var(--bg-fff0f6, #FFF0F6)', border: '1.5px solid #FBCFE8', borderRadius: 'var(--r-md)', padding: 20, marginBottom: 20 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #FBCFE8' }}>
                      <div style={{ background: BKASH, padding: '5px 14px', borderRadius: 8 }}>
                        <span style={{ color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: .4 }}>bKash</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-831843, #831843)' }}>Pay to Merchant</div>
                        <div style={{ fontSize: 11, color: 'var(--tx-be185d, #BE185D)' }}>মার্চেন্ট পেমেন্ট</div>
                      </div>
                    </div>

                    {/* Step-by-step */}
                    <div style={{ marginBottom: 16 }}>
                      {[
                        'Open the bKash app on your phone',
                        'Tap "Pay to Merchant" (পে টু মার্চেন্ট)',
                        `Send exactly ৳${total.toLocaleString('en-BD')} to the number below`,
                        'Copy the 10-digit TrxID from your bKash SMS and enter it below',
                      ].map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: BKASH, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                          <span style={{ fontSize: 13, color: 'var(--tx-374151, #374151)', lineHeight: 1.5 }}>{s}</span>
                        </div>
                      ))}
                    </div>

                    {/* Merchant number */}
                    <div style={{ background: 'var(--bg-fff, #fff)', border: '1.5px solid #FBCFE8', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-9ca3af, #9CA3AF)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Merchant Number</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-831843, #831843)', letterSpacing: 1.5 }}>{bkashNum}</span>
                        <button onClick={() => copyNum(bkashNum)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: copied ? 'var(--bg-d1fae5, #D1FAE5)' : 'var(--bg-fff0f6, #FFF0F6)', border: `1.5px solid ${copied ? '#6EE7B7' : BKASH}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: copied ? 'var(--tx-065f46, #065F46)' : BKASH, fontFamily: 'inherit', transition: 'all .2s' }}>
                          {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                        </button>
                      </div>
                    </div>

                    {/* Amount badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-fce7f3, #FCE7F3)', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 16 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-831843, #831843)' }}>Amount to Send</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: BKASH }}>৳{total.toLocaleString('en-BD')}</span>
                    </div>

                    {/* TrxID input */}
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--tx-831843, #831843)', marginBottom: 6 }}>
                      Transaction ID (TrxID) <span style={{ color: CRM }}>*</span>
                    </label>
                    <input value={form.txId} onChange={e => upd('txId', e.target.value.toUpperCase())}
                      placeholder="e.g. 9DZ3XXXXXX"
                      style={{ ...inp, border: '1.5px solid #FBCFE8', background: 'var(--bg-fff, #fff)', letterSpacing: 1 }}
                      onFocus={e => { e.target.style.borderColor = BKASH; }}
                      onBlur={e => { e.target.style.borderColor = '#FBCFE8'; }} />
                    <div style={{ fontSize: 11, color: 'var(--tx-9ca3af, #9CA3AF)', marginTop: 5 }}>10-character TrxID from your bKash SMS confirmation</div>

                    {settings.bkash_instructions && (
                      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg-fdf2f8, #FDF2F8)', borderRadius: 8, fontSize: 12, color: 'var(--tx-6b7280, #6B7280)', borderLeft: `3px solid ${BKASH}` }}>
                        {settings.bkash_instructions}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Nagad panel ── */}
                {form.payment === 'Nagad' && nagadNum && (
                  <div style={{ background: 'var(--bg-fff8f0, #FFF8F0)', border: '1.5px solid #FED7AA', borderRadius: 'var(--r-md)', padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #FED7AA' }}>
                      <div style={{ background: '#F47920', padding: '5px 14px', borderRadius: 8 }}>
                        <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>Nagad</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-92400e, #92400E)' }}>Pay to Merchant</div>
                    </div>
                    <div style={{ background: 'var(--bg-fff, #fff)', border: '1.5px solid #FED7AA', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-9ca3af, #9CA3AF)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Merchant Number</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-92400e, #92400E)', letterSpacing: 1.5 }}>{nagadNum}</span>
                        <button onClick={() => copyNum(nagadNum)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: copied ? 'var(--bg-d1fae5, #D1FAE5)' : 'var(--bg-fff8f0, #FFF8F0)', border: `1.5px solid ${copied ? '#6EE7B7' : '#F47920'}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: copied ? 'var(--tx-065f46, #065F46)' : '#F47920', fontFamily: 'inherit' }}>
                          {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-fef3c7, #FEF3C7)', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-92400e, #92400E)' }}>Amount to Send</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#F47920' }}>৳{total.toLocaleString('en-BD')}</span>
                    </div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--tx-92400e, #92400E)', marginBottom: 6 }}>
                      Transaction ID (TrxID) <span style={{ color: CRM }}>*</span>
                    </label>
                    <input value={form.txId} onChange={e => upd('txId', e.target.value.toUpperCase())}
                      placeholder="Enter TrxID"
                      style={{ ...inp, border: '1.5px solid #FED7AA', background: 'var(--bg-fff, #fff)', letterSpacing: 1 }}
                      onFocus={e => { e.target.style.borderColor = '#F47920'; }}
                      onBlur={e => { e.target.style.borderColor = '#FED7AA'; }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', background: 'var(--bg-f3f4f6, #F3F4F6)', color: 'var(--tx-374151, #374151)', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ← Back
                  </button>
                  <button onClick={goNext}
                    style={{ flex: 2, padding: '12px', background: CRM, color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#A3112F'}
                    onMouseLeave={e => e.currentTarget.style.background = CRM}>
                    Review Order <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: REVIEW ── */}
            {step === 3 && (
              <div>
                {/* Shipping summary */}
                <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-md)', padding: '20px 24px', boxShadow: 'none', outline: '1px solid var(--hairline)', outlineOffset: -1, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)' }}>Shipping Details</h3>
                    <button onClick={() => setStep(1)} style={{ fontSize: 12, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>Edit</button>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--tx-374151, #374151)', lineHeight: 1.9 }}>
                    <div><strong style={{ fontWeight: 700 }}>{form.name}</strong> · {form.phone}</div>
                    <div>{[form.address, form.area, form.district].filter(Boolean).join(', ')}</div>
                    {form.email && <div style={{ color: 'var(--tx-6b7280, #6B7280)' }}>{form.email}</div>}
                    {form.notes && <div style={{ color: 'var(--tx-6b7280, #6B7280)', fontStyle: 'italic', marginTop: 4 }}>"{form.notes}"</div>}
                  </div>
                </div>

                {/* Payment summary */}
                <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-md)', padding: '20px 24px', boxShadow: 'none', outline: '1px solid var(--hairline)', outlineOffset: -1, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)' }}>Payment Method</h3>
                    <button onClick={() => setStep(2)} style={{ fontSize: 12, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>Edit</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {form.payment === 'bKash' && <span style={{ background: BKASH, color: '#fff', fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 4 }}>bKash</span>}
                    {form.payment === 'Nagad' && <span style={{ background: '#F47920', color: '#fff', fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 4 }}>Nagad</span>}
                    {form.payment === 'Cash on Delivery' && <span style={{ background: 'var(--bg-e5e7eb, #E5E7EB)', color: 'var(--tx-374151, #374151)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>COD</span>}
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-0f172a, #0F172A)' }}>{form.payment}</span>
                    {form.txId && <span style={{ fontSize: 12, color: 'var(--tx-6b7280, #6B7280)', fontFamily: 'monospace' }}>TrxID: {form.txId}</span>}
                  </div>
                </div>

                {/* Items review */}
                <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-md)', padding: '20px 24px', boxShadow: 'none', outline: '1px solid var(--hairline)', outlineOffset: -1, marginBottom: 20 }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)' }}>Order Items ({items.reduce((s, i) => s + i.qty, 0)})</h3>
                  {items.map(i => (
                    <div key={i.key || i.id} style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--bd-f3f4f6, #F3F4F6)' }}>
                      <div style={{ width: 46, height: 46, borderRadius: 8, background: 'var(--bg-f3f4f6, #F3F4F6)', backgroundImage: i.image ? `url(${i.image})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {!i.image && <Package size={18} color="#ccc" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-0f172a, #0F172A)' }}>{i.name}</div>
                        {i.variant && <div style={{ fontSize: 11, color: 'var(--tx-6b7280, #6B7280)' }}>{i.variant}</div>}
                        <div style={{ fontSize: 12, color: 'var(--tx-6b7280, #6B7280)' }}>Qty: {i.qty} × ৳{i.price.toLocaleString('en-BD')}</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-0f172a, #0F172A)' }}>৳{(i.price * i.qty).toLocaleString('en-BD')}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStep(2)} style={{ flex: 1, padding: '12px', background: 'var(--bg-f3f4f6, #F3F4F6)', color: 'var(--tx-374151, #374151)', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ← Back
                  </button>
                  <button onClick={place} disabled={placing}
                    style={{ flex: 2, padding: '14px', background: placing ? 'var(--bg-ccc, #ccc)' : CRM, color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 800, fontSize: 15, cursor: placing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
                    onMouseEnter={e => !placing && (e.currentTarget.style.background = '#A3112F')}
                    onMouseLeave={e => !placing && (e.currentTarget.style.background = CRM)}>
                    {placing ? 'Placing Order…' : 'Place Order →'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ════ RIGHT: ORDER SUMMARY (sticky) ════ */}
          <div style={{ position: isMobile ? 'static' : 'sticky', top: 80 }}>
            <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-md)', padding: 20, boxShadow: 'none', outline: '1px solid var(--hairline)', outlineOffset: -1 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)', display: 'flex', alignItems: 'center', gap: 8 }}>
                Order Summary
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-6b7280, #6B7280)', background: 'var(--bg-f3f4f6, #F3F4F6)', borderRadius: 'var(--r-md)', padding: '2px 8px' }}>
                  {items.reduce((s, i) => s + i.qty, 0)} item{items.reduce((s, i) => s + i.qty, 0) !== 1 ? 's' : ''}
                </span>
              </h3>

              {/* Cart items */}
              {items.map(i => {
                const pd   = prodDetails[i.id];
                const orig = pd?.original_price || i.price;
                const pct  = orig > i.price ? Math.round((1 - i.price / orig) * 100) : 0;
                return (
                  <div key={i.key || i.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--bd-f3f4f6, #F3F4F6)' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--bg-f3f4f6, #F3F4F6)', backgroundImage: i.image ? `url(${i.image})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!i.image && <Package size={20} color="#ccc" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-0f172a, #0F172A)', lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-6b7280, #6B7280)' }}>{i.variant ? `${i.variant} · ` : ''}Qty: {i.qty}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-0f172a, #0F172A)' }}>৳{(i.price * i.qty).toLocaleString('en-BD')}</div>
                      {pct > 0 && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', background: 'var(--bg-fee2e2, #FEE2E2)', borderRadius: 4, padding: '1px 5px', marginTop: 2, display: 'inline-block' }}>
                          Saved {pct}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Coupon input */}
              <div style={{ marginBottom: 14 }}>
                {!appliedCoupon ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Tag size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-9ca3af, #9CA3AF)', pointerEvents: 'none' }} />
                      <input value={couponCode} onChange={e => setCouponCode(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                        placeholder="Coupon or Gift Voucher Code"
                        style={{ ...inp, paddingLeft: 30, fontSize: 12 }} onFocus={inpFocus} onBlur={inpBlur} />
                    </div>
                    <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
                      style={{ padding: '10px 14px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: couponLoading || !couponCode.trim() ? .6 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {couponLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-f0fdf4, #F0FDF4)', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--tx-15803d, #15803D)', fontWeight: 600 }}>
                      <Check size={14} /> {appliedCoupon.code} — ৳{couponDiscount} off
                    </div>
                    <button onClick={() => { setAppliedCoupon(null); setCouponDiscount(0); setCouponCode(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-9ca3af, #9CA3AF)', display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Price breakdown */}
              <div style={{ borderTop: '1px solid var(--bd-f3f4f6, #F3F4F6)', paddingTop: 14 }}>
                <Row label="Subtotal" value={`৳${subtotal.toLocaleString('en-BD')}`} />
                {productSavings > 0 && <Row label="Product Savings" value={`-৳${productSavings.toLocaleString('en-BD')}`} red />}
                {couponDiscount > 0 && <Row label={`Coupon (${appliedCoupon?.code})`} value={`-৳${couponDiscount.toLocaleString('en-BD')}`} red />}
                {(productSavings > 0 || couponDiscount > 0) && (
                  <Row label="Total Savings" value={`-৳${(productSavings + couponDiscount).toLocaleString('en-BD')}`} red />
                )}
                <Row
                  label="Delivery"
                  value={delivery === 0 ? 'Free' : `৳${delivery}`}
                  green={delivery === 0}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--bd-f3f4f6, #F3F4F6)' }}>
                  <span style={{ color: 'var(--tx-0f172a, #0F172A)' }}>Total</span>
                  <span style={{ color: CRM }}>৳{total.toLocaleString('en-BD')}</span>
                </div>
              </div>

              {/* Free delivery upsell */}
              {freeThreshold && subtotal < freeThreshold && (
                <div style={{ marginTop: 12, padding: '9px 12px', background: 'var(--bg-fff7ed, #FFF7ED)', border: '1px solid #FED7AA', borderRadius: 8, fontSize: 12, color: 'var(--tx-92400e, #92400E)', lineHeight: 1.5 }}>
                  Add <strong>৳{(freeThreshold - subtotal).toLocaleString('en-BD')}</strong> more for free delivery!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
