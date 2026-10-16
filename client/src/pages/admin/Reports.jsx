import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Download, Sparkles, Copy, Check, FileText } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getReport, getReportSummary, errMsg } from '../../api/adminApi';
import { downloadReportExcel, downloadReportCsv } from '../../lib/reportExcel';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import toast from 'react-hot-toast';

const ink = 'var(--ink)';
const muted = 'var(--tx-64748b, #64748B)';
const edge = '1px solid var(--panel-edge)';
const panel = { background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)' };
const BLUE = '#1E88E5';
const fmt = (n) => '৳' + Math.round(Number(n || 0)).toLocaleString('en-BD');
const STATUS = { pending: 'New', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', return_requested: 'Return requested', returned: 'Returned' };

/* Dates in Bangladesh time */
const today = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
const shift = (ymd, d) => new Date(Date.parse(ymd + 'T00:00:00Z') + d * 86400e3).toISOString().slice(0, 10);
const monthStart = (ymd) => ymd.slice(0, 8) + '01';
const PRESETS = {
  week:      () => ({ from: shift(today(), -6), to: today(), label: 'Last 7 days' }),
  month:     () => ({ from: monthStart(today()), to: today(), label: 'This month' }),
  lastmonth: () => { const end = shift(monthStart(today()), -1); return { from: monthStart(end), to: end, label: 'Last month' }; },
  d30:       () => ({ from: shift(today(), -29), to: today(), label: 'Last 30 days' }),
};
const nice = (ymd) => new Date(ymd + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const inline = (t) => String(t).split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
function Formatted({ text }) {
  const out = []; let list = null;
  String(text || '').split('\n').forEach((line, i) => {
    const b = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (b) { if (!list) { list = []; out.push(<ul key={i} style={{ margin: '4px 0 10px', paddingLeft: 20 }}>{list}</ul>); } list.push(<li key={i} style={{ margin: '3px 0' }}>{inline(b[1])}</li>); return; }
    list = null;
    if (line.trim()) out.push(<p key={i} style={{ margin: '6px 0' }}>{inline(line.replace(/^#+\s*/, ''))}</p>);
  });
  return out;
}

function Change({ now, before }) {
  if (!before) return <span style={{ fontSize: 12.5, color: muted }}>{now ? 'No sales before' : ' '}</span>;
  const pct = Math.round((now - before) / before * 100);
  if (pct === 0) return <span style={{ fontSize: 12.5, color: muted }}>Same as previous</span>;
  const up = pct > 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12.5, fontWeight: 600, color: up ? '#15803D' : '#B42318' }}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(pct)}% vs previous
    </span>
  );
}

function Section({ title, sub, csv, children, style }) {
  return (
    <section style={{ ...panel, padding: 18, ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ink }}>{title}</h2>
        {sub && <span style={{ fontSize: 13, color: muted }}>{sub}</span>}
        {csv && <button onClick={csv} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: BLUE, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>CSV</button>}
      </div>
      {children}
    </section>
  );
}

function Table({ head, rows, align = [] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: align[i] || 'left', padding: '7px 8px', fontSize: 12, fontWeight: 600, color: muted, borderBottom: edge, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, k) => <tr key={k}>{r.map((c, i) => <td key={i} className="num" style={{ textAlign: align[i] || 'left', padding: '8px 8px', borderBottom: edge, color: ink, verticalAlign: 'middle' }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
const Bar = ({ value, max, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
    <div style={{ flex: 1, height: 6, background: 'var(--bg-f1f5f9, #F1F5F9)', borderRadius: 3 }}><div style={{ width: `${max ? value / max * 100 : 0}%`, height: '100%', background: 'var(--chart)', borderRadius: 3 }} /></div>
    <span style={{ minWidth: 70, textAlign: 'right' }}>{label}</span>
  </div>
);

export default function Reports() {
  const { isMobile } = useBreakpoint();
  const [preset, setPreset] = useState('week');
  const [range, setRange] = useState(PRESETS.week());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [writing, setWriting] = useState(false);
  const [lang, setLang] = useState('en');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!range.from || !range.to || range.from > range.to) return;
    setLoading(true); setSummary('');
    getReport(range.from, range.to).then(r => setReport(r.data.report)).catch(err => toast.error(errMsg(err, 'Could not load the report'))).finally(() => setLoading(false));
  }, [range.from, range.to]);

  const pick = (k) => { setPreset(k); if (k !== 'custom') setRange(PRESETS[k]()); };
  const writeSummary = async () => {
    setWriting(true);
    try { const { data } = await getReportSummary(range.from, range.to, lang); setSummary(data.summary); }
    catch (err) { toast.error(errMsg(err, 'Could not write the summary')); }
    setWriting(false);
  };
  const excel = async () => { setExporting(true); try { await downloadReportExcel(report); } catch { toast.error('Could not create the Excel file'); } setExporting(false); };

  const r = report, s = r?.summary, p = r?.previous_summary;
  const btn = (primary) => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 'var(--pill)', border: primary ? 'none' : '1px solid rgba(15,23,42,.16)', background: primary ? BLUE : 'var(--bg-fff, #fff)', color: primary ? '#fff' : ink, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' });

  return (
    <AdminLayout title="Reports">
      {/* Period + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="hide-scrollbar" style={{ display: 'inline-flex', ...panel, padding: 3, borderRadius: 'var(--pill)', overflowX: 'auto', maxWidth: '100%' }}>
          {[['week', 'Last 7 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['d30', 'Last 30 days'], ['custom', 'Custom']].map(([k, l]) => (
            <button key={k} onClick={() => pick(k)} style={{ padding: '6px 13px', border: 'none', borderRadius: 'var(--pill)', background: preset === k ? 'var(--ink)' : 'transparent', color: preset === k ? 'var(--bg-fff, #fff)' : muted, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{l}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 14, color: ink }}>
            <input type="date" value={range.from} max={range.to} onChange={e => setRange(x => ({ ...x, from: e.target.value }))} style={{ padding: '7px 10px', border: '1px solid rgba(15,23,42,.16)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', color: ink, background: 'var(--bg-fff, #fff)' }} />
            to
            <input type="date" value={range.to} min={range.from} max={today()} onChange={e => setRange(x => ({ ...x, to: e.target.value }))} style={{ padding: '7px 10px', border: '1px solid rgba(15,23,42,.16)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', color: ink, background: 'var(--bg-fff, #fff)' }} />
          </span>
        )}
        <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', gap: 8 }}>
          <button onClick={excel} disabled={!r || exporting} style={btn(true)}><Download size={16} /> {exporting ? 'Preparing…' : 'Download Excel'}</button>
        </div>
      </div>

      {r && <div style={{ fontSize: 14, color: muted, marginBottom: 14 }}><b style={{ color: ink }}>{nice(r.period.from)} – {nice(r.period.to)}</b> · compared with {nice(r.previous_period.from)} – {nice(r.previous_period.to)}. Sales exclude cancelled and returned orders.</div>}

      {loading || !r ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}><div className="skel" style={{ height: 96, borderRadius: 'var(--r-md)' }} /><div className="skel" style={{ height: 300, borderRadius: 'var(--r-md)' }} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          {/* Headline numbers */}
          <div style={{ ...panel, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', overflow: 'hidden' }}>
            {[
              ['Sales', fmt(s.booked.revenue), <Change key="c" now={s.booked.revenue} before={p.booked.revenue} />],
              ['Orders', s.booked.orders, <Change key="c" now={s.booked.orders} before={p.booked.orders} />],
              ['Average order', fmt(s.booked.avg_order_value), <span key="c" style={{ fontSize: 12.5, color: muted }}>{s.booked.units_sold} units sold</span>],
              ['Delivered', fmt(s.delivered.revenue), <span key="c" style={{ fontSize: 12.5, color: muted }}>{s.delivered.orders} orders</span>],
              ['Not yet paid', fmt(s.not_marked_paid.amount), <span key="c" style={{ fontSize: 12.5, color: muted }}>{s.not_marked_paid.orders} orders</span>],
            ].map(([l, v, extra], i) => (
              <div key={l} style={{ padding: '14px 16px', borderLeft: (isMobile ? i % 2 : i) ? edge : 'none', borderTop: isMobile && i > 1 ? edge : 'none' }}>
                <div style={{ fontSize: 13, color: muted }}>{l}</div>
                <div className="num" style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: ink, letterSpacing: '-0.02em', margin: '2px 0' }}>{v}</div>
                {extra}
              </div>
            ))}
          </div>

          {/* AI summary */}
          <section style={{ ...panel, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#E3F2FD', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={15} /></span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ink, flex: '1 1 140px' }}>Written summary</h2>
              <div style={{ display: 'inline-flex', border: edge, borderRadius: 'var(--pill)', padding: 2 }}>
                {[['en', 'English'], ['bn', 'বাংলা']].map(([k, l]) => <button key={k} onClick={() => setLang(k)} style={{ padding: '4px 10px', border: 'none', borderRadius: 'var(--pill)', background: lang === k ? 'var(--ink)' : 'transparent', color: lang === k ? 'var(--bg-fff, #fff)' : muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
              </div>
              <button onClick={writeSummary} disabled={writing} style={btn(!summary)}>{writing ? 'Writing…' : summary ? 'Write again' : 'Write with AI'}</button>
              {summary && <button onClick={() => { navigator.clipboard?.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ ...btn(false), padding: '9px 12px' }}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>}
            </div>
            {writing ? <div style={{ marginTop: 14 }}>{[95, 80, 88, 60].map((w, i) => <div key={i} className="skel" style={{ height: 13, width: `${w}%`, marginBottom: 10 }} />)}</div>
              : summary ? <div className="slide-in" style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.6, color: ink }}><Formatted text={summary} /></div>
              : <p style={{ margin: '10px 0 0', fontSize: 14, color: muted }}>Get a short "how did we do" note with what went well, what needs attention and what to do next — written from these exact figures. Copy it into WhatsApp for your team.</p>}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
            {/* Sales by day */}
            <Section title={r.trend[0]?.period?.length === 10 ? 'Sales by day' : 'Sales by week'} csv={() => downloadReportCsv(r, 'Sales by day')}>
              {(() => { const max = Math.max(...r.trend.map(t => t.booked_revenue), 1); return (
                <Table head={['Date', 'Orders', 'Sales']} align={['left', 'right', 'left']}
                  rows={r.trend.map(t => [nice(t.period.slice(0, 10)), t.orders || <span style={{ color: muted }}>0</span>, <Bar value={t.booked_revenue} max={max} label={fmt(t.booked_revenue)} />])} />
              ); })()}
            </Section>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
              {/* Orders & customers */}
              <Section title="Orders and customers">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px', fontSize: 14, color: ink }}>
                  {Object.entries(s.orders_by_status).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: edge, padding: '5px 0' }}><span style={{ color: muted }}>{STATUS[k] || k}</span><b className="num">{n}</b></div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: edge, padding: '5px 0' }}><span style={{ color: muted }}>New customers</span><b className="num">{r.customers.new_customers}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: edge, padding: '5px 0' }}><span style={{ color: muted }}>Returning customers</span><b className="num">{r.customers.returning_customers}</b></div>
                </div>
                {s.by_payment_method.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 13.5, color: muted }}>
                    {s.by_payment_method.map(m => <span key={m.payment_method} style={{ marginRight: 14 }}>{m.payment_method}: <b className="num" style={{ color: ink }}>{fmt(m.revenue)}</b> ({m.orders})</span>)}
                  </div>
                )}
                {r.returns.cancel_or_return_rate_pct > 0 && <div style={{ marginTop: 8, fontSize: 13.5, color: '#B45309' }}>{r.returns.cancel_or_return_rate_pct}% of orders were cancelled or returned.</div>}
              </Section>

              {/* Categories */}
              <Section title="Categories" csv={() => downloadReportCsv(r, 'Categories')}>
                {(() => { const rows = r.categories.filter(c => c.revenue > 0); const max = Math.max(...rows.map(c => c.revenue), 1);
                  return rows.length ? <Table head={['Category', 'Units', 'Sales']} align={['left', 'right', 'left']} rows={rows.map(c => [c.category, c.units_sold, <Bar value={c.revenue} max={max} label={fmt(c.revenue)} />])} />
                    : <div style={{ fontSize: 14, color: muted }}>No sales in this period.</div>; })()}
              </Section>
            </div>
          </div>

          {/* Products */}
          <Section title="Products sold" sub={`${r.products.length} product${r.products.length !== 1 ? 's' : ''}`} csv={() => downloadReportCsv(r, 'Products')}>
            {r.products.length ? <Table head={['Product', 'Category', 'Units', 'Orders', 'Sales', 'Stock now']} align={['left', 'left', 'right', 'right', 'right', 'right']}
              rows={r.products.slice(0, 15).map(x => [x.name, <span style={{ color: muted }}>{x.category || '—'}</span>, x.units_sold, x.orders, fmt(x.revenue),
                x.in_catalogue === false ? <span style={{ color: muted }}>Deleted</span> : <span style={{ color: x.current_stock <= 0 ? '#B42318' : x.current_stock <= 5 ? '#B45309' : ink }}>{x.current_stock}</span>])} />
              : <div style={{ fontSize: 14, color: muted }}>No products sold in this period.</div>}
            {r.products.length > 15 && <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>Showing the top 15 — all {r.products.length} are in the Excel file.</div>}
          </Section>

          {/* Orders */}
          <Section title="Orders" sub={`${r.orders.length} in this period`} csv={() => downloadReportCsv(r, 'Orders')}>
            {r.orders.length ? <Table head={['Order', 'Date', 'Customer', 'Status', 'Total', 'Paid']} align={['left', 'left', 'left', 'left', 'right', 'left']}
              rows={r.orders.slice(0, 20).map(o => [<b>#{o.order_id}</b>, nice(new Date(new Date(o.created_at).getTime() + 6 * 3600e3).toISOString().slice(0, 10)), o.customer, STATUS[o.status] || o.status, fmt(o.total), o.paid ? <span style={{ color: '#15803D' }}>Yes</span> : <span style={{ color: muted }}>No</span>])} />
              : <div style={{ fontSize: 14, color: muted }}>No orders in this period.</div>}
            {r.orders.length > 20 && <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>Showing the latest 20 — all {r.orders.length} are in the Excel file.</div>}
          </Section>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: muted }}>
            <FileText size={15} /> The Excel file has a sheet each for summary, sales by day, products, categories, customers, all orders and current inventory.
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
