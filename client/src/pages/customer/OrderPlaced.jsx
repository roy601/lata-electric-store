import { useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Copy, Check, MessageCircle, PhoneCall, PackageCheck, Truck, Home } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { useSeo } from '../../lib/seo';

const ink = 'var(--ink)';
const muted = 'var(--tx-64748b, #64748B)';
const edge = '1px solid var(--panel-edge)';
const taka = (n) => '৳' + Math.round(Number(n || 0)).toLocaleString('en-BD');

/* Shown right after checkout (details come from the checkout page). */
export default function OrderPlaced() {
  useSeo({ title: 'Order placed', noindex: true });
  const { orderId } = useParams();
  const { state } = useLocation();
  const [copied, setCopied] = useState(false);
  if (!state) return <Navigate to={`/track/${orderId}`} replace />;

  const cod = /cash|cod/i.test(state.payment || '');
  const copy = () => navigator.clipboard?.writeText(orderId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  const steps = [
    { Icon: PhoneCall,    title: 'We call to confirm', text: `Usually within a few hours, on ${state.phone}.` },
    { Icon: PackageCheck, title: 'We pack your order', text: 'Checked and packed at our shop in Dhaka.' },
    { Icon: Truck,        title: 'On the way',         text: `Delivery to ${state.district}: ${state.deliveryTime}.` },
    { Icon: Home,         title: cod ? 'Pay on delivery' : 'Delivered', text: cod ? `Keep ${taka(state.total)} ready for the rider.` : 'Payment received with your order.' },
  ];
  const waShop = state.wa ? `https://wa.me/${state.wa.startsWith('0') ? '88' + state.wa : state.wa}?text=${encodeURIComponent(`Hi, I just placed order #${orderId}.`)}` : null;

  return (
    <CustomerLayout>
      <style>{`
        @keyframes ckCircle { from { stroke-dashoffset: 166 } to { stroke-dashoffset: 0 } }
        @keyframes ckTick { from { stroke-dashoffset: 48 } to { stroke-dashoffset: 0 } }
        @keyframes ckScale { 0% { transform: scale(.85) } 60% { transform: scale(1.06) } 100% { transform: scale(1) } }
        .ck { animation: ckScale .5s .55s cubic-bezier(.3,1.4,.5,1) both }
        .ck circle { stroke-dasharray: 166; stroke-dashoffset: 166; animation: ckCircle .6s cubic-bezier(.65,0,.45,1) forwards }
        .ck path { stroke-dasharray: 48; stroke-dashoffset: 48; animation: ckTick .35s .5s cubic-bezier(.65,0,.45,1) forwards }
        .rise { opacity: 0; animation: slideIn .45s cubic-bezier(.2,.8,.2,1) forwards }
        @media (prefers-reduced-motion: reduce) { .ck, .ck circle, .ck path, .rise { animation: none; stroke-dashoffset: 0; opacity: 1 } }
      `}</style>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 16px 64px' }}>
        <div style={{ textAlign: 'center' }}>
          <svg className="ck" width="76" height="76" viewBox="0 0 56 56" aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
            <circle cx="28" cy="28" r="26" fill="none" stroke="#15803D" strokeWidth="3" />
            <path d="M16.5 29.5l7.5 7.5 15.5-17" fill="none" stroke="#15803D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className="rise" style={{ fontSize: 27, fontWeight: 700, color: ink, margin: '18px 0 6px', animationDelay: '.7s' }}>Thank you{state.name ? `, ${state.name.split(' ')[0]}` : ''}!</h1>
          <p className="rise" style={{ fontSize: 15.5, color: muted, margin: 0, animationDelay: '.8s' }}>Your order is placed. We'll call you to confirm it.</p>
        </div>

        {/* Order number + total */}
        <div className="rise" style={{ background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)', padding: '16px 18px', marginTop: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', animationDelay: '.9s' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, color: muted }}>Order number</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="num" style={{ fontSize: 21, fontWeight: 700, color: ink, letterSpacing: .5 }}>#{orderId}</span>
              <button onClick={copy} aria-label="Copy order number" style={{ border: 'none', background: 'none', cursor: 'pointer', color: copied ? '#15803D' : muted, display: 'flex', padding: 4 }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
            </div>
          </div>
          {state.thumbs?.length > 0 && (
            <div style={{ display: 'flex' }}>
              {state.thumbs.map((src, i) => (
                <span key={i} style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', border: '2px solid var(--bg-fff, #fff)', outline: edge, background: '#fff', marginLeft: i ? -10 : 0, overflow: 'hidden' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </span>
              ))}
            </div>
          )}
          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
            <div style={{ fontSize: 13, color: muted }}>{state.units} item{state.units !== 1 ? 's' : ''} · {cod ? 'Cash on delivery' : state.payment}</div>
            <div className="num" style={{ fontSize: 21, fontWeight: 700, color: ink }}>{taka(state.total)}</div>
          </div>
        </div>

        {/* What happens next */}
        <div className="rise" style={{ background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)', padding: '18px 18px 6px', marginTop: 12, animationDelay: '1s' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: ink, margin: '0 0 12px' }}>What happens next</h2>
          {steps.map(({ Icon, title, text }, i) => (
            <div key={title} className="rise" style={{ display: 'flex', gap: 14, animationDelay: `${1.1 + i * .12}s` }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: i === 0 ? '#1E88E5' : 'var(--bg-f1f5f9, #F1F5F9)', color: i === 0 ? '#fff' : ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></span>
                {i < steps.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 14, background: 'var(--bg-e2e8f0, #E2E8F0)', margin: '4px 0' }} />}
              </div>
              <div style={{ paddingBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: ink, marginTop: 6 }}>{title}</div>
                <div style={{ fontSize: 14, color: muted, lineHeight: 1.5 }}>{text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rise" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20, animationDelay: '1.6s' }}>
          <Link to={`/track/${orderId}`} state={{ phone: state.phone }} style={{ flex: '1 1 180px', textAlign: 'center', padding: '13px 18px', background: '#1E88E5', color: '#fff', borderRadius: 'var(--pill)', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Track this order</Link>
          <Link to="/products" style={{ flex: '1 1 180px', textAlign: 'center', padding: '13px 18px', border: '1px solid rgba(15,23,42,.18)', color: ink, borderRadius: 'var(--pill)', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Continue shopping</Link>
        </div>
        {waShop && (
          <a className="rise more-link" href={waShop} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, fontSize: 14, color: muted, animationDelay: '1.7s' }}>
            <MessageCircle size={16} /> Questions? Message us on WhatsApp
          </a>
        )}
      </div>
    </CustomerLayout>
  );
}
