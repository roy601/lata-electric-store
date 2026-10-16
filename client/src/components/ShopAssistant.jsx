import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Send, Sparkles, Phone, MessageCircle, Package } from 'lucide-react';
import { shopAiChat, shopAiStatus } from '../api/customerApi';

/* Storefront chat: the shop assistant answers product, delivery and order
   questions; WhatsApp / Messenger / call stay one tap away in the header.
   The conversation lives in this browser tab only (sessionStorage). */
const ink = 'var(--ink)';
const muted = 'var(--tx-64748b, #64748B)';
const edge = '1px solid var(--panel-edge)';
const BLUE = '#1E88E5';
const KEY = 'lata-shop-chat';
const taka = (n) => '৳' + Math.round(Number(n || 0)).toLocaleString('en-BD');
const SUGGEST = ['Which fan is good for a big room?', 'Delivery charge to Chattogram?', 'Track my order', 'ক্যাশ অন ডেলিভারি আছে?'];

const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch { return []; } };
const store = (m) => { try { sessionStorage.setItem(KEY, JSON.stringify(m.slice(-30))); } catch { /* private mode */ } };

const inline = (t) => String(t).split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
function Text({ text }) {
  const out = []; let list = null;
  String(text || '').split('\n').forEach((line, i) => {
    const b = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (b) { if (!list) { list = []; out.push(<ul key={i} style={{ margin: '4px 0', paddingLeft: 18 }}>{list}</ul>); } list.push(<li key={i}>{inline(b[1])}</li>); return; }
    list = null;
    if (line.trim()) out.push(<p key={i} style={{ margin: '4px 0' }}>{inline(line.replace(/^#+\s*/, ''))}</p>);
  });
  return out;
}

function ProductCard({ p }) {
  return (
    <Link to={`/products/${p.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, border: edge, borderRadius: 'var(--r-sm)', background: 'var(--bg-fff, #fff)', textDecoration: 'none', marginTop: 6 }}>
      <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 'var(--r-sm)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={16} color="#94A3B8" />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: ink, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</span>
        <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: ink }}>{taka(p.price)}</span>
        {p.original_price > p.price && <span className="num" style={{ fontSize: 12, color: muted, textDecoration: 'line-through', marginLeft: 6 }}>{taka(p.original_price)}</span>}
        {!p.in_stock && <span style={{ fontSize: 12, color: '#B42318', marginLeft: 6 }}>Out of stock</span>}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: BLUE, whiteSpace: 'nowrap' }}>View</span>
    </Link>
  );
}

export default function ShopAssistant({ branding = {}, onClose, isMobile }) {
  const [messages, setMessages] = useState(load);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { pathname } = useLocation();
  const productId = (pathname.match(/^\/products\/(\d+)/) || [])[1];

  useEffect(() => { shopAiStatus().then(r => setEnabled(!!r.data.enabled)).catch(() => setEnabled(false)); }, []);
  useEffect(() => { store(messages); endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);
  useEffect(() => { if (!isMobile) setTimeout(() => inputRef.current?.focus(), 250); }, [isMobile]);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const wa = String(branding.whatsapp || '').replace(/\D/g, '');
  const contacts = [
    wa && { label: 'WhatsApp', href: `https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}`, Icon: MessageCircle, color: '#25D366' },
    branding.facebook && { label: 'Messenger', href: `https://m.me/${String(branding.facebook).replace(/.*facebook\.com\//, '').replace(/\/.*/, '')}`, Icon: MessageCircle, color: '#60A5FA' },
    branding.phone && { label: 'Call', href: `tel:${String(branding.phone).replace(/[^+\d]/g, '')}`, Icon: Phone, color: BLUE },
  ].filter(Boolean);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || sending) return;
    setInput('');
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setSending(true);
    try {
      const { data } = await shopAiChat(next.map(({ role, content }) => ({ role, content })).slice(-10), productId);
      setMessages(m => [...m, { role: 'assistant', content: data.reply, products: data.products || [] }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', error: true, content: err.response?.data?.message || 'Sorry, I could not answer right now. Please try again or message us on WhatsApp.' }]);
    }
    setSending(false);
  };

  const shell = isMobile
    ? { position: 'fixed', inset: 0, zIndex: 1300, borderRadius: 0 }
    : { position: 'absolute', bottom: 64, right: 0, zIndex: 499, width: 380, height: 'min(600px, calc(100vh - 140px))', borderRadius: 16, boxShadow: '0 20px 60px -12px rgba(15,23,42,.35)' };

  return (
    <div role="dialog" aria-label="Shop assistant" className="pop-in"
      style={{ ...shell, background: 'var(--page)', border: isMobile ? 'none' : edge, display: 'flex', flexDirection: 'column', overflow: 'hidden', transformOrigin: 'bottom right', animationDuration: '.25s' }}>
      {/* Header */}
      <div style={{ background: '#0F172A', color: '#fff', padding: '14px 14px 12px', paddingTop: isMobile ? 'max(14px, env(safe-area-inset-top))' : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={16} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Lata Electric</div>
            <div style={{ fontSize: 12.5, color: '#CBD5E1' }}>Ask about products, delivery or your order</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
        {contacts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {contacts.map(({ label, href, Icon, color }) => (
              <a key={label} href={href} target={label === 'Call' ? undefined : '_blank'} rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--pill)', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>
                <Icon size={13} color={color} /> {label}
              </a>
            ))}
            <span style={{ fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>talk to a person</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>
        {!enabled && (
          <div style={{ background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)', padding: 14, fontSize: 14, color: ink }}>
            Our online assistant is resting right now. Please message us on WhatsApp or call — we reply quickly.
          </div>
        )}
        {enabled && messages.length === 0 && (
          <div className="slide-in">
            <div style={{ background: 'var(--bg-fff, #fff)', border: edge, borderRadius: '14px 14px 14px 4px', padding: '10px 12px', fontSize: 14, color: ink, lineHeight: 1.5, maxWidth: '88%' }}>
              Hi! 👋 I can help you choose a product, check prices and delivery, or find your order. Ask in English or বাংলা.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {SUGGEST.map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding: '7px 11px', border: `1px solid ${BLUE}55`, borderRadius: 'var(--pill)', background: 'var(--bg-fff, #fff)', color: BLUE, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="slide-in" style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{ maxWidth: '88%', minWidth: 0 }}>
              <div style={{
                padding: '9px 12px', fontSize: 14, lineHeight: 1.5, overflowWrap: 'anywhere',
                ...(m.role === 'user'
                  ? { background: BLUE, color: '#fff', borderRadius: '14px 14px 4px 14px', whiteSpace: 'pre-wrap' }
                  : { background: m.error ? '#FEF2F2' : 'var(--bg-fff, #fff)', color: m.error ? '#B42318' : ink, border: edge, borderRadius: '14px 14px 14px 4px' }),
              }}>
                {m.role === 'user' ? m.content : <Text text={m.content} />}
              </div>
              {m.products?.map(p => <ProductCard key={p.id} p={p} />)}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'inline-flex', gap: 4, padding: '12px 14px', background: 'var(--bg-fff, #fff)', border: edge, borderRadius: '14px 14px 14px 4px' }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94A3B8', animation: `dotPulse 1.1s ${i * .16}s infinite ease-in-out` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={e => { e.preventDefault(); send(); }}
        style={{ display: 'flex', gap: 8, padding: 10, paddingBottom: isMobile ? 'max(10px, env(safe-area-inset-bottom))' : 10, borderTop: edge, background: 'var(--bg-fff, #fff)' }}>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} maxLength={1000} disabled={!enabled}
          placeholder={enabled ? 'Type your question…' : 'Assistant unavailable'}
          style={{ flex: 1, border: '1px solid rgba(15,23,42,.16)', borderRadius: 'var(--pill)', padding: '10px 14px', fontSize: 15, fontFamily: 'inherit', outline: 'none', color: ink, background: 'var(--bg-fff, #fff)', minWidth: 0 }} />
        <button type="submit" disabled={!enabled || sending || !input.trim()} aria-label="Send"
          style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: !enabled || sending || !input.trim() ? '#CBD5E1' : BLUE, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Send size={17} />
        </button>
      </form>
      <style>{`@keyframes dotPulse { 0%, 80%, 100% { opacity: .3; transform: scale(.8) } 40% { opacity: 1; transform: scale(1) } }`}</style>
    </div>
  );
}
