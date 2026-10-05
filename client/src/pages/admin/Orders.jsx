import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, Copy, Printer, X, Search, Package, AlertTriangle, RotateCcw, Check, ChevronDown } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getOrders, getProducts, updateOrderStatus, markOrderPaid, returnOrder, getOrderHistory, errMsg } from '../../api/adminApi';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import toast from 'react-hot-toast';

/* ── Status vocabulary ── */
const STATUS = {
  pending:          { label: 'New',              dot: '#F59E0B', tone: '#92400E', bg: '#FEF3C7' },
  confirmed:        { label: 'Confirmed',        dot: '#3B82F6', tone: '#1E40AF', bg: '#DBEAFE' },
  shipped:          { label: 'Shipped',          dot: '#06B6D4', tone: '#155E75', bg: '#CFFAFE' },
  delivered:        { label: 'Delivered',        dot: '#16A34A', tone: '#166534', bg: '#DCFCE7' },
  cancelled:        { label: 'Cancelled',        dot: '#94A3B8', tone: '#475569', bg: '#F1F5F9' },
  return_requested: { label: 'Return requested', dot: '#EA580C', tone: '#9A3412', bg: '#FFEDD5' },
  returned:         { label: 'Returned',         dot: '#7C3AED', tone: '#5B21B6', bg: '#EDE9FE' },
};
const FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];
// The one obvious next step for each status
const NEXT = {
  pending:          { to: 'confirmed', label: 'Confirm' },
  confirmed:        { to: 'shipped',   label: 'Mark shipped' },
  shipped:          { to: 'delivered', label: 'Mark delivered' },
  return_requested: { action: 'return', label: 'Process return' },
};
const TABS = [
  ['all', 'All'], ['pending', 'New'], ['confirmed', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'],
  ['return_requested', 'Returns'], ['cancelled', 'Cancelled'], ['returned', 'Returned'],
];
const RANGES = [['all', 'All time'], ['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days']];
const LOW = 5;

const ink = 'var(--ink)';
const muted = 'var(--tx-64748b, #64748B)';
const edge = '1px solid var(--panel-edge)';
const panel = { background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)' };
const fmt = (n) => '৳' + Number(n || 0).toLocaleString('en-BD');
const isCOD = (o) => /cash|cod/i.test(o.payment_method || '');
const phoneDigits = (p) => String(p || '').replace(/\D/g, '');
const waNumber = (p) => { const d = phoneDigits(p); return d.startsWith('880') ? d : d.startsWith('0') ? '88' + d : d; };

function ago(date) {
  const s = (Date.now() - new Date(date)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
const fullDate = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function StatusBadge({ status, size = 12.5 }) {
  const m = STATUS[status] || STATUS.pending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: m.bg, color: m.tone, fontSize: size, fontWeight: 600, padding: '3px 9px', borderRadius: 'var(--r-sm)', whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot }} />{m.label}
    </span>
  );
}

function Thumbs({ items }) {
  const list = items || [];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex' }}>
        {list.slice(0, 3).map((it, i) => (
          <span key={i} style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', border: '2px solid var(--bg-fff, #fff)', outline: '1px solid var(--panel-edge)', background: '#fff', marginLeft: i ? -10 : 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {it.image ? <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={14} color="#94A3B8" />}
          </span>
        ))}
      </div>
      <span style={{ fontSize: 12.5, color: muted, whiteSpace: 'nowrap' }}>{list.reduce((s, i) => s + (+i.qty || 0), 0)} item{list.reduce((s, i) => s + (+i.qty || 0), 0) !== 1 ? 's' : ''}</span>
    </div>
  );
}

/* Printable packing slip / invoice */
function printSlip(o) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) { toast.error('Allow pop-ups to print'); return; }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = (o.items || []).map(i => `<tr><td>${esc(i.name)}${i.variant ? `<div class="v">${esc(i.variant)}</div>` : ''}</td><td class="r">${i.qty}</td><td class="r">${fmt(i.price)}</td><td class="r">${fmt(i.price * i.qty)}</td></tr>`).join('');
  const due = o.payment_paid ? 0 : o.total;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Order ${esc(o.order_id)}</title>
  <style>body{font:14px/1.5 system-ui,'Segoe UI',sans-serif;color:#0F172A;margin:32px}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:18px}
  th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #E2E8F0;vertical-align:top}th{font-size:12px;color:#64748B;font-weight:600}.r{text-align:right}.v{font-size:12px;color:#64748B}
  .top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #0F172A;padding-bottom:14px}.muted{color:#64748B}.tot td{border:none;padding:4px 6px}
  .due{margin-top:18px;padding:12px 14px;border:2px solid #0F172A;font-size:18px;font-weight:700;display:flex;justify-content:space-between}</style></head><body>
  <div class="top"><div><h1>Lata Electric</h1><div class="muted">Order #${esc(o.order_id)} · ${esc(fullDate(o.created_at))}</div></div>
  <div style="text-align:right"><b>${esc(o.customer_name)}</b><br>${esc(o.customer_phone)}<br>${esc(o.customer_address)}${o.customer_city ? ', ' + esc(o.customer_city) : ''}${o.customer_district && o.customer_district !== o.customer_city ? ', ' + esc(o.customer_district) : ''}</div></div>
  ${o.notes ? `<p><b>Customer note:</b> ${esc(o.notes)}</p>` : ''}
  <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="tot" style="width:280px;margin-left:auto"><tr><td>Subtotal</td><td class="r">${fmt(o.subtotal)}</td></tr>
  ${+o.coupon_discount ? `<tr><td>Discount${o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : ''}</td><td class="r">−${fmt(o.coupon_discount)}</td></tr>` : ''}
  <tr><td>Delivery</td><td class="r">${fmt(o.delivery_charge)}</td></tr><tr><td><b>Total</b></td><td class="r"><b>${fmt(o.total)}</b></td></tr></table>
  <div class="due"><span>${due ? 'Collect from customer' : 'Already paid'} (${esc(o.payment_method)})</span><span>${fmt(due)}</span></div>
  <script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
}

/* ── Order details: slide-over panel ── */
function OrderDrawer({ order: o, stockOf, onClose, onStatus, onPaid, onReturn, busy, isMobile }) {
  const [history, setHistory] = useState([]);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    setHistory([]); setMoreOpen(false);
    getOrderHistory(o.id).then(r => setHistory(r.data.history || [])).catch(() => {});
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [o.id, o.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const when = (s) => { const h = [...history].reverse().find(x => x.status === s); return h ? fullDate(h.changed_at) : null; };
  const step = FLOW.indexOf(o.status);
  const next = NEXT[o.status];
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success('Copied'); };
  const address = [o.customer_address, o.customer_city, o.customer_district !== o.customer_city ? o.customer_district : null].filter(Boolean).join(', ');
  const label = { fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8 };
  const smallBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid rgba(15,23,42,.15)', borderRadius: 'var(--pill)', background: 'var(--bg-fff, #fff)', color: ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 900, animation: 'photoFade .2s ease' }} />
      <aside role="dialog" aria-label={`Order ${o.order_id}`}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : 480, background: 'var(--bg-fff, #fff)', zIndex: 901, display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(15,23,42,.18)', animation: 'drawerIn .28s cubic-bezier(.2,.8,.2,1)' }}>
        <style>{`@keyframes drawerIn { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: edge, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: ink }}>#{o.order_id}</span>
              <StatusBadge status={o.status} />
            </div>
            <div style={{ fontSize: 13, color: muted, marginTop: 3 }}>Placed {fullDate(o.created_at)}</div>
          </div>
          <button onClick={() => printSlip(o)} title="Print packing slip" aria-label="Print packing slip" style={{ ...smallBtn, padding: 8 }}><Printer size={16} /></button>
          <button onClick={onClose} aria-label="Close" style={{ ...smallBtn, padding: 8 }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 24px' }}>

          {/* Progress */}
          {step >= 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 20 }}>
              {FLOW.map((s, i) => {
                const done = i <= step;
                return (
                  <div key={s}>
                    <div style={{ height: 4, borderRadius: 2, background: done ? STATUS[FLOW[step]].dot : 'var(--bg-e2e8f0, #E2E8F0)', transition: 'background .3s' }} />
                    <div style={{ fontSize: 12, fontWeight: done ? 600 : 400, color: done ? ink : muted, marginTop: 6 }}>{STATUS[s].label === 'New' ? 'Placed' : STATUS[s].label}</div>
                    <div style={{ fontSize: 11, color: muted, lineHeight: 1.3 }}>{done ? (i === 0 ? fullDate(o.created_at) : when(s) || '') : ''}</div>
                  </div>
                );
              })}
            </div>
          )}
          {step < 0 && history.length > 1 && (
            <div style={{ fontSize: 13, color: muted, marginBottom: 16 }}>
              {history.map(h => `${STATUS[h.status]?.label || h.status} · ${fullDate(h.changed_at)}`).join('  →  ')}
            </div>
          )}

          {/* Primary action */}
          {next && (
            <button disabled={busy} onClick={() => next.action === 'return' ? onReturn() : onStatus(next.to)}
              style={{ width: '100%', padding: '12px', background: next.action === 'return' ? '#7C3AED' : '#1E88E5', color: '#fff', border: 'none', borderRadius: 'var(--pill)', fontSize: 15, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', marginBottom: 10, opacity: busy ? .7 : 1 }}>
              {busy ? 'Saving…' : next.label}
            </button>
          )}
          {o.status === 'return_requested' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FFEDD5', color: '#9A3412', padding: '10px 12px', borderRadius: 'var(--r-sm)', fontSize: 13.5, marginBottom: 10 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> The customer asked to return this order. Check the item, then process the return to put it back in stock.
            </div>
          )}

          {/* Customer */}
          <div style={{ ...panel, padding: 14, marginTop: 8 }}>
            <div style={label}>Customer</div>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: ink }}>{o.customer_name}</div>
            <div style={{ fontSize: 14, color: ink, marginTop: 2 }}>{o.customer_phone}{o.customer_email ? <span style={{ color: muted }}> · {o.customer_email}</span> : null}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, color: ink, marginTop: 8, lineHeight: 1.45 }}>
              <MapPin size={15} color={muted} style={{ flexShrink: 0, marginTop: 2 }} /> {address}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <a href={`tel:${phoneDigits(o.customer_phone)}`} style={smallBtn}><Phone size={14} /> Call</a>
              <a href={`https://wa.me/${waNumber(o.customer_phone)}?text=${encodeURIComponent(`Hello ${o.customer_name}, this is Lata Electric about your order #${o.order_id}.`)}`} target="_blank" rel="noopener noreferrer" style={smallBtn}><MessageCircle size={14} /> WhatsApp</a>
              <button onClick={() => copy(`${o.customer_name}\n${o.customer_phone}\n${address}`)} style={smallBtn}><Copy size={14} /> Copy address</button>
            </div>
            {o.notes && <div style={{ marginTop: 12, fontSize: 13.5, background: 'var(--bg-f8fafc, #F8FAFC)', padding: '8px 10px', borderRadius: 'var(--r-sm)', color: ink }}><b>Note:</b> {o.notes}</div>}
          </div>

          {/* Items with live stock */}
          <div style={{ ...panel, padding: 14, marginTop: 12 }}>
            <div style={label}>Items</div>
            {(o.items || []).map((it, i) => {
              const left = stockOf(it.id);
              return (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? edge : 'none' }}>
                  <span style={{ width: 48, height: 48, flexShrink: 0, border: edge, borderRadius: 'var(--r-sm)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {it.image ? <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={18} color="#94A3B8" />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: ink, lineHeight: 1.35 }}>{it.name}</div>
                    {it.variant && <div style={{ fontSize: 12.5, color: muted }}>{it.variant}</div>}
                    <div className="num" style={{ fontSize: 12.5, marginTop: 3, color: left == null ? muted : left <= 0 ? '#B42318' : left <= LOW ? '#B45309' : '#15803D' }}>
                      {left == null ? 'Product removed' : left <= 0 ? 'Out of stock now' : `${left} left in stock`}
                    </div>
                  </div>
                  <div className="num" style={{ textAlign: 'right', fontSize: 14, color: ink, whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>{fmt(it.price * it.qty)}</div>
                    <div style={{ fontSize: 12.5, color: muted }}>{it.qty} × {fmt(it.price)}</div>
                  </div>
                </div>
              );
            })}
            <div className="num" style={{ borderTop: edge, marginTop: 4, paddingTop: 10, fontSize: 14, color: ink, display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: muted }}>Subtotal</span><span>{fmt(o.subtotal)}</span></div>
              {+o.coupon_discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: muted }}>Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}</span><span>−{fmt(o.coupon_discount)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: muted }}>Delivery</span><span>{fmt(o.delivery_charge)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, marginTop: 4 }}><span>Total</span><span>{fmt(o.total)}</span></div>
            </div>
          </div>

          {/* Payment */}
          <div style={{ ...panel, padding: 14, marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={label}>Payment</div>
              <div style={{ fontSize: 14.5, color: ink, fontWeight: 600 }}>{o.payment_method}</div>
              {o.transaction_id && <div style={{ fontSize: 13, color: muted, display: 'flex', alignItems: 'center', gap: 6 }}>TrxID {o.transaction_id}
                <button onClick={() => copy(o.transaction_id)} aria-label="Copy transaction ID" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: muted }}><Copy size={13} /></button></div>}
            </div>
            {o.payment_paid
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#15803D', fontWeight: 600, fontSize: 14 }}><Check size={16} /> Paid</span>
              : <button onClick={onPaid} disabled={busy} style={{ ...smallBtn, background: '#15803D', color: '#fff', border: 'none', fontWeight: 600 }}>
                  {isCOD(o) ? `Cash received · ${fmt(o.total)}` : 'Mark as paid'}
                </button>}
          </div>

          {o.status === 'returned' && (
            <div style={{ ...panel, padding: 14, marginTop: 12, fontSize: 14, color: ink }}>
              <div style={label}>Return</div>
              Items were put back in stock.{o.return_reason ? <div style={{ marginTop: 6 }}><b>Reason:</b> {o.return_reason}</div> : null}
            </div>
          )}

          {/* Other actions */}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setMoreOpen(v => !v)} style={{ ...smallBtn, border: 'none', padding: '6px 0', color: muted }}>
              Change status manually <ChevronDown size={14} style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {moreOpen && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {Object.keys(STATUS).filter(s => s !== o.status && s !== 'returned').map(s => (
                  <button key={s} disabled={busy} onClick={() => onStatus(s)}
                    style={{ ...smallBtn, padding: '6px 11px', fontSize: 12.5, color: s === 'cancelled' ? '#B42318' : ink }}>
                    {s === 'cancelled' ? 'Cancel order' : `Set to ${STATUS[s].label.toLowerCase()}`}
                  </button>
                ))}
                {['delivered', 'shipped'].includes(o.status) && (
                  <button disabled={busy} onClick={onReturn} style={{ ...smallBtn, padding: '6px 11px', fontSize: 12.5, color: '#5B21B6' }}><RotateCcw size={13} /> Process return</button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

/* ── Inventory at a glance ── */
function InventoryPanel({ products, orders }) {
  const active = products.filter(p => p.is_active !== false);
  const out = active.filter(p => (p.stock || 0) <= 0);
  const low = active.filter(p => p.stock > 0 && p.stock <= LOW).sort((a, b) => a.stock - b.stock);
  const byId = Object.fromEntries(products.map(p => [p.id, p]));

  // Units in orders that still have to be packed (new + confirmed)
  const pack = {};
  orders.filter(o => o.status === 'pending' || o.status === 'confirmed').forEach(o => (o.items || []).forEach(it => {
    const k = it.id;
    pack[k] = pack[k] || { id: k, name: it.name, image: it.image, qty: 0, orders: 0 };
    pack[k].qty += +it.qty || 0; pack[k].orders += 1;
  }));
  const packList = Object.values(pack).sort((a, b) => b.qty - a.qty);

  const head = { fontSize: 13, fontWeight: 600, color: ink, margin: '0 0 8px' };
  const Row = ({ img, name, right, rightColor, sub }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: edge }}>
      <span style={{ width: 32, height: 32, flexShrink: 0, border: edge, borderRadius: 'var(--r-sm)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={14} color="#94A3B8" />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {sub && <div style={{ fontSize: 12, color: muted }}>{sub}</div>}
      </div>
      <span className="num" style={{ fontSize: 13, fontWeight: 600, color: rightColor || ink, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  );

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ink }}>Inventory</h2>
        <Link to="/admin/products" className="more-link" style={{ fontSize: 13, fontWeight: 600, color: '#1E88E5' }}>Manage stock</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: edge, borderRadius: 'var(--r-sm)', marginBottom: 16 }}>
        {[['In stock', active.length - out.length, '#15803D'], ['Running low', low.length, '#B45309'], ['Out of stock', out.length, '#B42318']].map(([l, n, c], i) => (
          <div key={l} style={{ padding: '10px 10px', borderLeft: i ? edge : 'none' }}>
            <div className="num" style={{ fontSize: 20, fontWeight: 700, color: n ? c : ink, lineHeight: 1.1 }}>{n}</div>
            <div style={{ fontSize: 12, color: muted }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={head}>To pack now <span style={{ fontWeight: 400, color: muted }}>· new and confirmed orders</span></div>
      {packList.length === 0
        ? <div style={{ fontSize: 13, color: muted, padding: '6px 0 4px' }}>Nothing waiting to be packed.</div>
        : packList.slice(0, 6).map(p => {
            const left = byId[p.id]?.stock;
            return <Row key={p.id} img={p.image} name={p.name} sub={`${p.orders} order${p.orders !== 1 ? 's' : ''} · ${left == null ? 'removed' : left <= 0 ? 'none left after these' : `${left} left after these`}`}
              right={`× ${p.qty}`} rightColor={left != null && left <= 0 ? '#B42318' : ink} />;
          })}

      <div style={{ ...head, marginTop: 16 }}>Restock soon</div>
      {out.length + low.length === 0
        ? <div style={{ fontSize: 13, color: muted, padding: '6px 0 4px' }}>Every product has more than {LOW} in stock.</div>
        : [...out, ...low].slice(0, 8).map(p => (
            <Row key={p.id} img={p.image} name={p.name} right={p.stock <= 0 ? 'Out' : `${p.stock} left`} rightColor={p.stock <= 0 ? '#B42318' : '#B45309'} />
          ))}
      {out.length + low.length > 8 && (
        <Link to="/admin/products" className="more-link" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#1E88E5', fontWeight: 600 }}>
          See all {out.length + low.length}
        </Link>
      )}
    </div>
  );
}

export default function AdminOrders() {
  const { isMobile, isTablet } = useBreakpoint();
  const [orders,   setOrders]   = useState([]);
  const [products, setProducts] = useState([]);
  const [tab,      setTab]      = useState('all');
  const [range,    setRange]    = useState('all');
  const [unpaid,   setUnpaid]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [openId,   setOpenId]   = useState(null);
  const [busyId,   setBusyId]   = useState(null);
  const [returnFor, setReturnFor] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [showInv,  setShowInv]  = useState(false);

  const loadProducts = () => getProducts().then(r => setProducts(r.data.products || [])).catch(() => {});
  const load = async () => {
    setLoading(true);
    try {
      const [o] = await Promise.all([getOrders(), loadProducts()]);
      setOrders(o.data.orders || []);
    } catch (err) { toast.error(errMsg(err, 'Could not load orders')); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stockById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p.stock ?? 0])), [products]);
  const stockOf = (id) => (id in stockById ? stockById[id] : null);
  const patch = (id, change) => setOrders(prev => prev.map(o => o.id === id ? { ...o, ...change } : o));

  const setStatus = async (o, status) => {
    if (status === 'cancelled' && !window.confirm(`Cancel order #${o.order_id}? Its items go back into stock.`)) return;
    setBusyId(o.id);
    try {
      await updateOrderStatus(o.id, status);
      patch(o.id, { status });
      toast.success(`#${o.order_id} → ${STATUS[status].label}`);
      loadProducts();
    } catch (err) { toast.error(errMsg(err, 'Could not change the status')); }
    setBusyId(null);
  };
  const setPaid = async (o) => {
    setBusyId(o.id);
    try { await markOrderPaid(o.id); patch(o.id, { payment_paid: true }); toast.success(`#${o.order_id} marked as paid`); }
    catch (err) { toast.error(errMsg(err, 'Could not save')); }
    setBusyId(null);
  };
  const doReturn = async () => {
    const o = returnFor; if (!o) return;
    setBusyId(o.id);
    try {
      await returnOrder(o.id, returnReason);
      patch(o.id, { status: 'returned', return_reason: returnReason || null });
      toast.success(`Return done — ${(o.items || []).reduce((s, i) => s + (+i.qty || 0), 0)} unit(s) back in stock`);
      setReturnFor(null); setReturnReason(''); loadProducts();
    } catch (err) { toast.error(errMsg(err, 'Could not process the return')); }
    setBusyId(null);
  };

  /* Filters */
  const inRange = (o) => {
    if (range === 'all') return true;
    const d = new Date(o.created_at);
    if (range === 'today') return d.toDateString() === new Date().toDateString();
    return Date.now() - d < +range * 86400000;
  };
  const q = search.trim().toLowerCase();
  const matches = (o) => !q || o.order_id?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q) || o.customer_phone?.includes(q)
    || (o.items || []).some(i => i.name?.toLowerCase().includes(q));
  const base = orders.filter(o => inRange(o) && matches(o) && (!unpaid || !o.payment_paid));
  const visible = tab === 'all' ? base : base.filter(o => o.status === tab);
  const count = (s) => base.filter(o => o.status === s).length;

  /* Work queue */
  const toCollect = orders.filter(o => !o.payment_paid && ['shipped', 'delivered'].includes(o.status));
  const today = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString() && o.status !== 'cancelled');
  const queue = [
    { key: 'pending',          label: 'New — to confirm', n: orders.filter(o => o.status === 'pending').length, color: '#B45309' },
    { key: 'confirmed',        label: 'To pack & ship',   n: orders.filter(o => o.status === 'confirmed').length, color: '#1E40AF' },
    { key: 'shipped',          label: 'On the way',       n: orders.filter(o => o.status === 'shipped').length, color: '#155E75' },
    { key: 'return_requested', label: 'Returns to check', n: orders.filter(o => o.status === 'return_requested').length, color: '#9A3412' },
    { key: 'collect',          label: 'Cash to collect',  n: fmt(toCollect.reduce((s, o) => s + (+o.total || 0), 0)), sub: `${toCollect.length} order${toCollect.length !== 1 ? 's' : ''}`, color: ink },
    { key: 'today',            label: 'Sales today',      n: fmt(today.reduce((s, o) => s + (+o.total || 0), 0)), sub: `${today.length} order${today.length !== 1 ? 's' : ''}`, color: ink },
  ];
  const pickQueue = (k) => {
    if (k === 'collect') { setTab('all'); setUnpaid(true); setRange('all'); return; }
    if (k === 'today') { setTab('all'); setUnpaid(false); setRange('today'); return; }
    setUnpaid(false); setRange('all'); setTab(k);
  };

  const opened = orders.find(o => o.id === openId);
  const wide = !isMobile && !isTablet;
  const th = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: muted, borderBottom: edge, whiteSpace: 'nowrap', background: 'var(--bg-f8fafc, #F8FAFC)' };
  const td = { padding: '12px 14px', borderBottom: edge, verticalAlign: 'middle' };

  const NextButton = ({ o, full }) => {
    const n = NEXT[o.status];
    const payNow = !n && !o.payment_paid && o.status === 'delivered';
    if (!n && !payNow) return null;
    const isBusy = busyId === o.id;
    return (
      <button disabled={isBusy}
        onClick={e => { e.stopPropagation(); if (payNow) setPaid(o); else if (n.action === 'return') setReturnFor(o); else setStatus(o, n.to); }}
        style={{ padding: '7px 14px', width: full ? '100%' : 'auto', borderRadius: 'var(--pill)', border: payNow ? '1px solid #15803D' : 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: isBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          background: payNow ? 'transparent' : n.action === 'return' ? '#7C3AED' : '#1E88E5', color: payNow ? '#15803D' : '#fff', opacity: isBusy ? .6 : 1 }}>
        {isBusy ? 'Saving…' : payNow ? 'Cash received' : n.label}
      </button>
    );
  };

  return (
    <AdminLayout title="Orders">
      {/* ── Work queue ── */}
      <div style={{ ...panel, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', marginBottom: 16, overflow: 'hidden' }}>
        {queue.map((c, i) => {
          const on = (c.key === tab && !unpaid && range === 'all') || (c.key === 'collect' && unpaid) || (c.key === 'today' && range === 'today' && !unpaid && tab === 'all');
          return (
            <button key={c.key} onClick={() => pickQueue(c.key)}
              style={{ textAlign: 'left', padding: isMobile ? '12px 12px' : '14px 16px', border: 'none', borderLeft: (isMobile ? i % 2 : i) ? edge : 'none', borderTop: (isMobile && i > 1) || (isTablet && i > 2) ? edge : 'none',
                background: on ? 'var(--bg-f8fafc, #F8FAFC)' : 'transparent', boxShadow: on ? 'inset 0 -2px 0 #1E88E5' : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div className="num" style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: (typeof c.n === 'number' && c.n > 0) ? c.color : ink, lineHeight: 1.15 }}>{c.n}</div>
              <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{c.label}{c.sub ? <span> · {c.sub}</span> : null}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0, 1fr) 320px' : '1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          {/* ── Toolbar ── */}
          <div style={{ ...panel, padding: isMobile ? 10 : '10px 14px', marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(15,23,42,.14)', borderRadius: 'var(--pill)', padding: '8px 14px', background: 'var(--bg-fff, #fff)' }}>
              <Search size={16} color="#94A3B8" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order ID, name, phone or product"
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: ink, fontFamily: 'inherit', minWidth: 0 }} />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" style={{ border: 'none', background: 'none', cursor: 'pointer', color: muted, padding: 0, display: 'flex' }}><X size={15} /></button>}
            </label>
            <select value={range} onChange={e => setRange(e.target.value)} style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,.14)', borderRadius: 'var(--pill)', fontSize: 14, background: 'var(--bg-fff, #fff)', color: ink, fontFamily: 'inherit', cursor: 'pointer' }}>
              {RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, color: ink, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={unpaid} onChange={e => setUnpaid(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#1E88E5' }} /> Unpaid only
            </label>
            {!wide && (
              <button onClick={() => setShowInv(v => !v)} style={{ marginLeft: 'auto', padding: '8px 14px', border: '1px solid rgba(15,23,42,.14)', borderRadius: 'var(--pill)', background: showInv ? 'var(--ink)' : 'var(--bg-fff, #fff)', color: showInv ? 'var(--bg-fff, #fff)' : ink, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Inventory
              </button>
            )}
          </div>
          {!wide && showInv && <div style={{ marginBottom: 12 }}><InventoryPanel products={products} orders={orders} /></div>}

          {/* ── Status tabs ── */}
          <div className="hide-scrollbar" style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: edge, marginBottom: 12 }}>
            {TABS.map(([k, l]) => {
              const n = k === 'all' ? base.length : count(k);
              return (
                <button key={k} className="u-tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                  {l} <span className="num" style={{ color: muted, fontWeight: 500 }}>{n}</span>
                </button>
              );
            })}
          </div>

          {/* ── List ── */}
          {loading ? (
            <div style={{ ...panel, padding: 14 }}>{[0, 1, 2, 3, 4].map(i => <div key={i} className="skel" style={{ height: 44, marginBottom: 10 }} />)}</div>
          ) : visible.length === 0 ? (
            <div style={{ ...panel, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: ink }}>{orders.length ? 'No orders match' : 'No orders yet'}</div>
              <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>{orders.length ? 'Try another tab, date range or search.' : 'New orders from the shop appear here.'}</div>
            </div>
          ) : isMobile ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {visible.map(o => (
                <div key={o.id} onClick={() => setOpenId(o.id)} style={{ ...panel, padding: 14, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: ink }}>#{o.order_id}</span>
                    <StatusBadge status={o.status} size={12} />
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, color: muted }}>{ago(o.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: ink }}>{o.customer_name}</div>
                      <div style={{ fontSize: 13, color: muted }}>{o.customer_phone}{o.customer_city ? ` · ${o.customer_city}` : ''}</div>
                    </div>
                    <div className="num" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700, color: ink }}>{fmt(o.total)}</div>
                      <div style={{ fontSize: 12, color: o.payment_paid ? '#15803D' : muted }}>{o.payment_paid ? 'Paid' : isCOD(o) ? 'COD' : o.payment_method}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                    <Thumbs items={o.items} />
                    <NextButton o={o} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...panel, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Items</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(o => {
                    const short = (o.items || []).some(it => { const s = stockOf(it.id); return s != null && s <= 0; }) && ['pending', 'confirmed'].includes(o.status);
                    return (
                      <tr key={o.id} onClick={() => setOpenId(o.id)} style={{ cursor: 'pointer', background: openId === o.id ? 'var(--bg-f8fafc, #F8FAFC)' : 'transparent' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-f8fafc, #F8FAFC)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = openId === o.id ? 'var(--bg-f8fafc, #F8FAFC)' : 'transparent'; }}>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: ink, whiteSpace: 'nowrap' }}>#{o.order_id}</div>
                          <div style={{ fontSize: 12.5, color: muted, whiteSpace: 'nowrap' }} title={fullDate(o.created_at)}>{ago(o.created_at)}</div>
                        </td>
                        <td style={td}>
                          <div style={{ fontWeight: 600, color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{o.customer_name}</div>
                          <div className="num" style={{ fontSize: 12.5, color: muted, whiteSpace: 'nowrap' }}>{o.customer_phone}</div>
                          {o.customer_city && <div style={{ fontSize: 12.5, color: muted, whiteSpace: 'nowrap' }}>{o.customer_city}</div>}
                        </td>
                        <td style={td}>
                          <Thumbs items={o.items} />
                          {short && <div style={{ fontSize: 12, color: '#B42318', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> Stock now 0</div>}
                        </td>
                        <td className="num" style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: ink }}>{fmt(o.total)}</div>
                          <div style={{ fontSize: 12.5, color: o.payment_paid ? '#15803D' : muted }}>{o.payment_paid ? '✓ Paid' : isCOD(o) ? 'Cash on delivery' : `${o.payment_method} · unpaid`}</div>
                        </td>
                        <td style={td}><StatusBadge status={o.status} /></td>
                        <td style={{ ...td, textAlign: 'right' }}><NextButton o={o} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {wide && <div style={{ position: 'sticky', top: 84 }}><InventoryPanel products={products} orders={orders} /></div>}
      </div>

      {opened && (
        <OrderDrawer order={opened} stockOf={stockOf} isMobile={isMobile} busy={busyId === opened.id}
          onClose={() => setOpenId(null)}
          onStatus={(s) => setStatus(opened, s)}
          onPaid={() => setPaid(opened)}
          onReturn={() => setReturnFor(opened)} />
      )}

      {/* ── Return confirmation ── */}
      {returnFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setReturnFor(null)}>
          <div style={{ ...panel, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: ink }}>Process return</h3>
            <div style={{ fontSize: 14, color: muted, marginBottom: 16 }}>Order #{returnFor.order_id}. These items go back into stock:</div>
            {(returnFor.items || []).map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '7px 0', borderTop: i ? edge : 'none', color: ink }}>
                <span>{it.name}</span><span className="num" style={{ fontWeight: 600, color: '#15803D', whiteSpace: 'nowrap' }}>+{it.qty}</span>
              </div>
            ))}
            <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: ink, margin: '16px 0 6px' }}>Reason <span style={{ fontWeight: 400, color: muted }}>(optional)</span></label>
            <textarea value={returnReason} onChange={e => setReturnReason(e.target.value)} rows={3} placeholder="e.g. Damaged on arrival, wrong size, customer changed mind"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid rgba(15,23,42,.18)', borderRadius: 'var(--r-sm)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--bg-fff, #fff)', color: ink }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => { setReturnFor(null); setReturnReason(''); }} style={{ flex: 1, padding: 11, background: 'transparent', border: '1px solid rgba(15,23,42,.18)', borderRadius: 'var(--pill)', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', color: ink }}>Not now</button>
              <button onClick={doReturn} disabled={busyId === returnFor.id} style={{ flex: 2, padding: 11, background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 'var(--pill)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                {busyId === returnFor.id ? 'Processing…' : 'Return & restock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
