import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getOrders, getProducts, errMsg } from '../../api/adminApi';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import toast from 'react-hot-toast';

/* Everything here is worked out from the orders and products lists. */
const ink = 'var(--ink)';
const muted = 'var(--tx-64748b, #64748B)';
const edge = '1px solid var(--panel-edge)';
const panel = { background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)' };
const fmt = (n) => '৳' + Math.round(Number(n || 0)).toLocaleString('en-BD');
const short = (n) => (n >= 100000 ? `৳${(n / 100000).toFixed(n >= 1e6 ? 0 : 1)}L` : n >= 1000 ? `৳${(n / 1000).toFixed(n >= 1e4 ? 0 : 1)}k` : fmt(n));
const DAY = 86400000;
const COUNTS = (o) => !['cancelled', 'returned'].includes(o.status);   // a sale that still stands
const PERIODS = [['1', 'Today'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days']];
const LOW = 5;
const STATUS_LABEL = { pending: 'New', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', return_requested: 'Return requested', returned: 'Returned' };

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/* ── Sales column chart (single series, hover for details) ── */
function SalesChart({ buckets, isMobile }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...buckets.map(b => b.sales));
  // round the top of the scale to a tidy number
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const H = isMobile ? 150 : 200;
  const labelEvery = Math.ceil(buckets.length / (isMobile ? 6 : 10));

  return (
    <div style={{ position: 'relative', paddingLeft: 44 }}>
      {/* grid + y labels */}
      {[0, 0.5, 1].map(f => (
        <div key={f} style={{ position: 'absolute', left: 44, right: 0, top: (1 - f) * H, borderTop: `1px ${f ? 'dashed' : 'solid'} var(--panel-edge)` }}>
          <span className="num" style={{ position: 'absolute', left: -44, top: -8, width: 38, textAlign: 'right', fontSize: 11, color: muted }}>{short(top * f)}</span>
        </div>
      ))}
      <div role="img" aria-label="Sales by day" style={{ position: 'relative', height: H, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {buckets.map((b, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'default' }}>
            <div style={{ width: '100%', maxWidth: 24, height: `${(b.sales / top) * 100}%`, minHeight: b.sales ? 2 : 0, background: 'var(--chart)', borderRadius: '4px 4px 0 0', opacity: hover == null || hover === i ? 1 : .45, transition: 'opacity .15s, height .4s ease' }} />
          </div>
        ))}
        {hover != null && (() => {
          const b = buckets[hover];
          const left = ((hover + 0.5) / buckets.length) * 100;
          return (
            <div style={{ position: 'absolute', bottom: `${Math.min(92, (b.sales / top) * 100 + 4)}%`, left: `${left}%`, transform: `translateX(${left > 75 ? '-100%' : left < 25 ? '0' : '-50%'})`, background: 'var(--ink)', color: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-sm)', padding: '7px 10px', fontSize: 12.5, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>
              <div style={{ opacity: .75 }}>{b.label}</div>
              <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmt(b.sales)}</div>
              <div className="num" style={{ opacity: .75 }}>{b.orders} order{b.orders !== 1 ? 's' : ''}</div>
            </div>
          );
        })()}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: muted, whiteSpace: 'nowrap', overflow: 'visible' }}>{i % labelEvery === 0 ? b.tick : ''}</div>
        ))}
      </div>
    </div>
  );
}

function Thumb({ src, size = 36 }) {
  return (
    <span style={{ width: size, height: size, flexShrink: 0, border: edge, borderRadius: 'var(--r-sm)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={14} color="#94A3B8" />}
    </span>
  );
}

export default function Dashboard() {
  const { isMobile, isTablet } = useBreakpoint();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    Promise.all([getOrders(), getProducts()])
      .then(([o, p]) => { setOrders(o.data.orders || []); setProducts(p.data.products || []); })
      .catch(err => toast.error(errMsg(err, 'Could not load the dashboard')))
      .finally(() => setLoading(false));
  }, []);

  const s = useMemo(() => {
    const days = +period;
    const from = days === 1 ? startOfDay() : new Date(startOfDay() - (days - 1) * DAY);
    const prevFrom = new Date(from - days * DAY);
    const inP = orders.filter(o => new Date(o.created_at) >= from);
    const inPrev = orders.filter(o => { const d = new Date(o.created_at); return d >= prevFrom && d < from; });
    const sales = inP.filter(COUNTS).reduce((a, o) => a + (+o.total || 0), 0);
    const prevSales = inPrev.filter(COUNTS).reduce((a, o) => a + (+o.total || 0), 0);
    const nOrders = inP.filter(COUNTS).length;
    const cancelled = inP.filter(o => o.status === 'cancelled').length;
    const received = inP.filter(o => o.payment_paid && COUNTS(o)).reduce((a, o) => a + (+o.total || 0), 0);
    const toCollect = orders.filter(o => !o.payment_paid && ['shipped', 'delivered'].includes(o.status));

    // chart buckets: hours for today, days otherwise
    const buckets = [];
    if (days === 1) {
      for (let h = 0; h < 24; h++) buckets.push({ sales: 0, orders: 0, label: `${h}:00 – ${h + 1}:00`, tick: h % 3 === 0 ? `${h}h` : '' });
      inP.filter(COUNTS).forEach(o => { const b = buckets[new Date(o.created_at).getHours()]; b.sales += +o.total || 0; b.orders += 1; });
    } else {
      for (let i = 0; i < days; i++) {
        const d = new Date(+from + i * DAY);
        buckets.push({ sales: 0, orders: 0, date: d, label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), tick: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
      }
      inP.filter(COUNTS).forEach(o => { const i = Math.floor((startOfDay(new Date(o.created_at)) - from) / DAY); if (buckets[i]) { buckets[i].sales += +o.total || 0; buckets[i].orders += 1; } });
    }

    // best sellers in the period
    const sold = {};
    inP.filter(COUNTS).forEach(o => (o.items || []).forEach(it => {
      const k = it.id; sold[k] = sold[k] || { id: k, name: it.name, image: it.image, units: 0, revenue: 0 };
      sold[k].units += +it.qty || 0; sold[k].revenue += (+it.qty || 0) * (+it.price || 0);
    }));
    const best = Object.values(sold).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

    // slow movers: in stock, nothing sold in the last 30 days
    const since30 = Date.now() - 30 * DAY;
    const sold30 = new Set();
    orders.filter(o => COUNTS(o) && new Date(o.created_at) >= since30).forEach(o => (o.items || []).forEach(it => sold30.add(it.id)));
    const active = products.filter(p => p.is_active !== false);
    const slow = active.filter(p => p.stock > 0 && !sold30.has(p.id)).map(p => ({ ...p, value: p.stock * (+p.price || 0) })).sort((a, b) => b.value - a.value);

    const status = Object.keys(STATUS_LABEL).map(k => ({ k, n: inP.filter(o => o.status === k).length })).filter(x => x.n);
    return {
      sales, prevSales, nOrders, cancelled, received, aov: nOrders ? sales / nOrders : 0, toCollect, buckets, best, slow, status, inP,
      newOrders: orders.filter(o => o.status === 'pending').length,
      toShip: orders.filter(o => o.status === 'confirmed').length,
      returns: orders.filter(o => o.status === 'return_requested').length,
      out: active.filter(p => (p.stock || 0) <= 0).length,
      low: active.filter(p => p.stock > 0 && p.stock <= LOW).length,
      stockValue: active.reduce((a, p) => a + Math.max(0, p.stock || 0) * (+p.price || 0), 0),
    };
  }, [orders, products, period]);

  const change = s.prevSales ? Math.round((s.sales - s.prevSales) / s.prevSales * 100) : null;
  const periodName = PERIODS.find(p => p[0] === period)[1].toLowerCase();
  const h2 = { margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: ink };
  const cols = isMobile ? '1fr' : isTablet ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)';

  if (loading) return (
    <AdminLayout title="Dashboard">
      <div className="skel" style={{ height: 90, borderRadius: 'var(--r-md)', marginBottom: 16 }} />
      <div className="skel" style={{ height: 280, borderRadius: 'var(--r-md)' }} />
    </AdminLayout>
  );

  const attention = [
    { n: s.newOrders, text: 'new order(s) to confirm', to: '/admin/orders', color: '#B45309' },
    { n: s.toShip, text: 'order(s) to pack and ship', to: '/admin/orders', color: '#1E40AF' },
    { n: s.returns, text: 'return request(s) to check', to: '/admin/orders', color: '#9A3412' },
    { n: s.out, text: 'product(s) out of stock', to: '/admin/inventory', color: '#B42318' },
    { n: s.low, text: `product(s) with ${LOW} or fewer left`, to: '/admin/inventory', color: '#B45309' },
  ].filter(a => a.n > 0);

  return (
    <AdminLayout title="Dashboard">
      {/* Period */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: muted }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div role="tablist" style={{ display: 'inline-flex', ...panel, padding: 3, borderRadius: 'var(--pill)' }}>
          {PERIODS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)}
              style={{ padding: '6px 14px', border: 'none', borderRadius: 'var(--pill)', background: period === k ? 'var(--ink)' : 'transparent', color: period === k ? 'var(--bg-fff, #fff)' : muted, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Headline numbers */}
      <div style={{ ...panel, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', overflow: 'hidden', marginBottom: 16 }}>
        {[
          { label: `Sales · ${periodName}`, value: fmt(s.sales), extra: change != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12.5, fontWeight: 600, color: change >= 0 ? '#15803D' : '#B42318' }}>
                {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(change)}% vs previous {period === '1' ? 'day' : `${period} days`}
              </span>) },
          { label: 'Orders', value: s.nOrders, extra: s.cancelled ? <span style={{ fontSize: 12.5, color: muted }}>{s.cancelled} cancelled</span> : null },
          { label: 'Average order', value: fmt(s.aov) },
          { label: 'Money received', value: fmt(s.received) },
          { label: 'Still to collect', value: fmt(s.toCollect.reduce((a, o) => a + (+o.total || 0), 0)), extra: <span style={{ fontSize: 12.5, color: muted }}>{s.toCollect.length} shipped / delivered unpaid</span> },
        ].map((c, i) => (
          <div key={c.label} style={{ padding: isMobile ? '12px 14px' : '16px 18px', borderLeft: (isMobile ? i > 0 && i % 2 === 0 : i) ? edge : 'none', borderTop: isMobile && i > 0 ? edge : 'none', gridColumn: isMobile && i === 0 ? '1 / -1' : 'auto' }}>
            <div style={{ fontSize: 13, color: muted }}>{c.label}</div>
            <div className="num" style={{ fontSize: isMobile ? 21 : 25, fontWeight: 700, color: ink, letterSpacing: '-0.02em', margin: '2px 0' }}>{c.value}</div>
            {c.extra}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16, marginBottom: 16, alignItems: 'start' }}>
        {/* Chart */}
        <section style={{ ...panel, padding: isMobile ? 14 : 20 }}>
          <h2 style={h2}>Sales {period === '1' ? 'by hour today' : `by day · last ${period} days`}</h2>
          {s.sales > 0 ? <SalesChart buckets={s.buckets} isMobile={isMobile} />
            : <div style={{ padding: '50px 0', textAlign: 'center', color: muted, fontSize: 14 }}>No sales in this period yet.</div>}
        </section>

        {/* Needs attention */}
        <section style={{ ...panel, padding: isMobile ? 14 : 20 }}>
          <h2 style={h2}>Needs your attention</h2>
          {attention.length === 0
            ? <div style={{ fontSize: 14, color: muted }}>All clear — no orders waiting and nothing out of stock.</div>
            : attention.map(a => (
                <Link key={a.text} to={a.to} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 0', borderTop: edge, textDecoration: 'none' }}>
                  <span className="num" style={{ fontSize: 20, fontWeight: 700, color: a.color, minWidth: 28 }}>{a.n}</span>
                  <span style={{ fontSize: 14, color: ink }}>{a.text}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 13, color: '#1E88E5', fontWeight: 600 }}>Open</span>
                </Link>
              ))}
          <div style={{ borderTop: edge, marginTop: 6, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
            <span style={{ color: muted }}>Stock value (selling price)</span>
            <span className="num" style={{ fontWeight: 700, color: ink }}>{fmt(s.stockValue)}</span>
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {/* Best sellers */}
        <section style={{ ...panel, padding: isMobile ? 14 : 20 }}>
          <h2 style={h2}>Best sellers · {periodName}</h2>
          {s.best.length === 0 ? <div style={{ fontSize: 14, color: muted }}>No sales in this period.</div>
            : s.best.map((b, i) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? edge : 'none' }}>
                  <Thumb src={b.image} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                    <div style={{ height: 4, background: 'var(--bg-f1f5f9, #F1F5F9)', borderRadius: 2, marginTop: 5 }}>
                      <div style={{ width: `${(b.revenue / s.best[0].revenue) * 100}%`, height: '100%', background: 'var(--chart)', borderRadius: 2 }} />
                    </div>
                  </div>
                  <div className="num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: ink }}>{fmt(b.revenue)}</div>
                    <div style={{ fontSize: 12, color: muted }}>{b.units} sold</div>
                  </div>
                </div>
              ))}
        </section>

        {/* Slow movers */}
        <section style={{ ...panel, padding: isMobile ? 14 : 20 }}>
          <h2 style={{ ...h2, marginBottom: 2 }}>Not selling</h2>
          <div style={{ fontSize: 13, color: muted, marginBottom: 10 }}>In stock but no sale in 30 days — consider a discount or a banner.</div>
          {s.slow.length === 0 ? <div style={{ fontSize: 14, color: muted }}>Everything in stock sold at least once.</div>
            : s.slow.slice(0, 6).map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? edge : 'none' }}>
                  <Thumb src={p.image} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div className="num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: ink }}>{p.stock} in stock</div>
                    <div style={{ fontSize: 12, color: muted }}>{fmt(p.value)} tied up</div>
                  </div>
                </div>
              ))}
          {s.slow.length > 6 && <Link to="/admin/inventory" className="more-link" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 600, color: '#1E88E5' }}>See all {s.slow.length}</Link>}
        </section>

        {/* Recent orders */}
        <section style={{ ...panel, padding: isMobile ? 14 : 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={h2}>Latest orders</h2>
            <Link to="/admin/orders" className="more-link" style={{ fontSize: 13, fontWeight: 600, color: '#1E88E5' }}>All orders</Link>
          </div>
          {orders.slice(0, 6).map((o, i) => (
            <Link key={o.id} to="/admin/orders" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? edge : 'none', textDecoration: 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: ink }}>{o.customer_name}</div>
                <div style={{ fontSize: 12, color: muted }}>#{o.order_id} · {STATUS_LABEL[o.status] || o.status}</div>
              </div>
              <div className="num" style={{ fontSize: 13.5, fontWeight: 600, color: ink }}>{fmt(o.total)}</div>
            </Link>
          ))}
          {orders.length === 0 && <div style={{ fontSize: 14, color: muted }}>No orders yet.</div>}
        </section>
      </div>
    </AdminLayout>
  );
}
