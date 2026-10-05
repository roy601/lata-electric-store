import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, Package, Minus, Plus, History } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getProducts, getCategories, getOrders, updateProduct, getStockMovements, errMsg } from '../../api/adminApi';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import toast from 'react-hot-toast';

const ink = 'var(--ink)';
const muted = 'var(--tx-64748b, #64748B)';
const edge = '1px solid var(--panel-edge)';
const panel = { background: 'var(--bg-fff, #fff)', border: edge, borderRadius: 'var(--r-md)' };
const fmt = (n) => '৳' + Math.round(Number(n || 0)).toLocaleString('en-BD');
const LOW = 5;
const DAY = 86400000;
const when = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/* Why stock changed, in plain words */
function reasonText(r) {
  const [kind, ref] = String(r || '').split(':');
  return {
    order:      `Sold · order #${ref}`,
    cancel:     `Order #${ref} cancelled`,
    return:     `Returned · order #${ref}`,
    reopen:     `Order #${ref} reopened`,
    admin_edit: 'Changed by admin',
    initial:    'Product added',
  }[kind] || r;
}

function Thumb({ src, size = 40 }) {
  return (
    <span style={{ width: size, height: size, flexShrink: 0, border: edge, borderRadius: 'var(--r-sm)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={15} color="#94A3B8" />}
    </span>
  );
}

function stockColor(n) { return n <= 0 ? '#B42318' : n <= LOW ? '#B45309' : ink; }

/* Stock number with − / + and Save */
function StockEditor({ product, onSaved }) {
  const [val, setVal] = useState(String(product.stock ?? 0));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setVal(String(product.stock ?? 0)); }, [product.stock]);
  const n = Math.max(0, parseInt(val, 10) || 0);
  const dirty = n !== (product.stock ?? 0);
  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try { await updateProduct(product.id, { stock: n }); onSaved(product.id, n); toast.success(`${product.name}: stock ${product.stock} → ${n}`); }
    catch (err) { toast.error(errMsg(err, 'Could not save')); }
    setSaving(false);
  };
  const btn = { width: 30, height: 32, border: 'none', background: 'none', cursor: 'pointer', color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <div onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${dirty ? '#1E88E5' : 'rgba(15,23,42,.15)'}`, borderRadius: 'var(--pill)', background: 'var(--bg-fff, #fff)' }}>
        <button style={btn} aria-label="One less" onClick={() => setVal(String(Math.max(0, n - 1)))}><Minus size={14} /></button>
        <input value={val} inputMode="numeric" onChange={e => setVal(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && save()} aria-label={`Stock for ${product.name}`}
          className="num" style={{ width: 44, textAlign: 'center', border: 'none', outline: 'none', fontSize: 14.5, fontWeight: 700, color: stockColor(n), background: 'transparent', fontFamily: 'inherit' }} />
        <button style={btn} aria-label="One more" onClick={() => setVal(String(n + 1))}><Plus size={14} /></button>
      </div>
      {dirty && (
        <button onClick={save} disabled={saving} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--pill)', background: '#1E88E5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {saving ? '…' : 'Save'}
        </button>
      )}
    </div>
  );
}

function HistoryList({ rows, showProduct }) {
  if (!rows) return <div>{[0, 1, 2, 3].map(i => <div key={i} className="skel" style={{ height: 36, marginBottom: 8 }} />)}</div>;
  if (!rows.length) return <div style={{ fontSize: 14, color: muted, padding: '10px 0' }}>No stock changes recorded yet.</div>;
  return rows.map((m, i) => (
    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? edge : 'none' }}>
      {showProduct && <Thumb src={m.products?.image} size={34} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {showProduct && <div style={{ fontSize: 13.5, color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.products?.name || `Product ${m.product_id}`}</div>}
        <div style={{ fontSize: showProduct ? 12.5 : 14, color: showProduct ? muted : ink }}>{reasonText(m.reason)}</div>
        <div style={{ fontSize: 12, color: muted }}>{when(m.created_at)}</div>
      </div>
      <div className="num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: m.change > 0 ? '#15803D' : '#B42318' }}>{m.change > 0 ? '+' : '−'}{Math.abs(m.change)}</div>
        <div style={{ fontSize: 12, color: muted }}>{m.stock_after} after</div>
      </div>
    </div>
  ));
}

export default function Inventory() {
  const { isMobile } = useBreakpoint();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('low');
  const [historyFor, setHistoryFor] = useState(null);   // product
  const [historyRows, setHistoryRows] = useState(null);
  const [feed, setFeed] = useState(null);                // all recent movements

  useEffect(() => {
    Promise.all([getProducts(), getCategories(), getOrders()])
      .then(([p, c, o]) => { setProducts(p.data.products || []); setCats(c.data.categories || []); setOrders(o.data.orders || []); })
      .catch(err => toast.error(errMsg(err, 'Could not load inventory')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== 'history' || feed) return;
    getStockMovements().then(r => setFeed(r.data.movements || [])).catch(err => { toast.error(errMsg(err, 'Could not load stock history')); setFeed([]); });
  }, [tab, feed]);

  const openHistory = (p) => {
    setHistoryFor(p); setHistoryRows(null);
    getStockMovements(p.id).then(r => setHistoryRows(r.data.movements || [])).catch(() => setHistoryRows([]));
  };
  const onSaved = (id, stock) => { setProducts(ps => ps.map(p => p.id === id ? { ...p, stock } : p)); setFeed(null); };

  // Units sold per product in the last 30 days (orders that still stand)
  const sold30 = useMemo(() => {
    const since = Date.now() - 30 * DAY, m = {};
    orders.filter(o => !['cancelled', 'returned'].includes(o.status) && new Date(o.created_at) >= since)
      .forEach(o => (o.items || []).forEach(it => { m[it.id] = (m[it.id] || 0) + (+it.qty || 0); }));
    return m;
  }, [orders]);

  const catName = Object.fromEntries(cats.map(c => [c.id, String(c.name).trim()]));
  const active = products.filter(p => p.is_active !== false);
  const units = active.reduce((a, p) => a + Math.max(0, p.stock || 0), 0);
  const value = active.reduce((a, p) => a + Math.max(0, p.stock || 0) * (+p.price || 0), 0);
  const outN = active.filter(p => (p.stock || 0) <= 0).length;
  const lowN = active.filter(p => p.stock > 0 && p.stock <= LOW).length;
  const slowN = active.filter(p => p.stock > 0 && !sold30[p.id]).length;

  const daysLeft = (p) => { const rate = (sold30[p.id] || 0) / 30; return rate > 0 ? Math.floor((p.stock || 0) / rate) : null; };
  const ql = q.trim().toLowerCase();
  let list = active.filter(p =>
    (!ql || p.name?.toLowerCase().includes(ql) || p.brand?.toLowerCase().includes(ql) || p.sku?.toLowerCase().includes(ql)) &&
    (!cat || String(p.category_id) === cat) &&
    (tab === 'all' || (tab === 'low' && p.stock > 0 && p.stock <= LOW) || (tab === 'out' && (p.stock || 0) <= 0) || (tab === 'slow' && p.stock > 0 && !sold30[p.id])));
  list = [...list].sort({
    low:   (a, b) => (a.stock || 0) - (b.stock || 0),
    sold:  (a, b) => (sold30[b.id] || 0) - (sold30[a.id] || 0),
    value: (a, b) => (b.stock || 0) * (+b.price || 0) - (a.stock || 0) * (+a.price || 0),
    name:  (a, b) => String(a.name).localeCompare(String(b.name)),
  }[sort]);

  const tabs = [['all', 'All products', active.length], ['low', 'Running low', lowN], ['out', 'Out of stock', outN], ['slow', 'Not selling', slowN], ['history', 'Stock history', null]];
  const th = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: muted, borderBottom: edge, background: 'var(--bg-f8fafc, #F8FAFC)', whiteSpace: 'nowrap' };
  const td = { padding: '10px 14px', borderBottom: edge, verticalAlign: 'middle', fontSize: 14 };
  const control = { padding: '8px 12px', border: '1px solid rgba(15,23,42,.14)', borderRadius: 'var(--pill)', fontSize: 14, background: 'var(--bg-fff, #fff)', color: ink, fontFamily: 'inherit', cursor: 'pointer' };

  return (
    <AdminLayout title="Inventory">
      {/* Summary */}
      <div style={{ ...panel, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', overflow: 'hidden', marginBottom: 16 }}>
        {[
          ['Products for sale', active.length, ink],
          ['Units in stock', units.toLocaleString('en-BD'), ink],
          ['Stock value (selling price)', fmt(value), ink],
          ['Running low (≤ 5)', lowN, lowN ? '#B45309' : ink, 'low'],
          ['Out of stock', outN, outN ? '#B42318' : ink, 'out'],
        ].map(([l, v, c, t], i) => (
          <button key={l} onClick={() => t && setTab(t)} style={{ textAlign: 'left', padding: isMobile ? '12px 14px' : '16px 18px', border: 'none', background: 'transparent', cursor: t ? 'pointer' : 'default', fontFamily: 'inherit',
            borderLeft: (isMobile ? i % 2 : i) ? edge : 'none', borderTop: isMobile && i > 1 ? edge : 'none', gridColumn: isMobile && i === 4 ? '1 / -1' : 'auto' }}>
            <div className="num" style={{ fontSize: isMobile ? 21 : 24, fontWeight: 700, color: c, letterSpacing: '-0.02em' }}>{loading ? '—' : v}</div>
            <div style={{ fontSize: 13, color: muted }}>{l}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="hide-scrollbar" style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: edge, marginBottom: 12 }}>
        {tabs.map(([k, l, n]) => (
          <button key={k} className="u-tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}{n != null && <span className="num" style={{ color: muted, fontWeight: 500 }}> {n}</span>}
          </button>
        ))}
      </div>

      {tab === 'history' ? (
        <section style={{ ...panel, padding: isMobile ? 14 : 20 }}>
          <div style={{ fontSize: 14, color: muted, marginBottom: 10 }}>Every stock change: sales, cancellations, returns and edits — newest first.</div>
          <HistoryList rows={feed} showProduct />
        </section>
      ) : (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <label style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8, ...control, cursor: 'text' }}>
              <Search size={16} color="#94A3B8" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, brand or SKU" style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: ink, fontFamily: 'inherit', minWidth: 0 }} />
              {q && <button onClick={() => setQ('')} aria-label="Clear" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: muted, display: 'flex' }}><X size={15} /></button>}
            </label>
            <select value={cat} onChange={e => setCat(e.target.value)} style={control}>
              <option value="">All categories</option>
              {cats.map(c => <option key={c.id} value={c.id}>{String(c.name).trim()}</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)} style={control}>
              <option value="low">Lowest stock first</option>
              <option value="sold">Best selling (30 days)</option>
              <option value="value">Highest stock value</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          {loading ? (
            <div style={{ ...panel, padding: 14 }}>{[0, 1, 2, 3, 4].map(i => <div key={i} className="skel" style={{ height: 44, marginBottom: 10 }} />)}</div>
          ) : list.length === 0 ? (
            <div style={{ ...panel, padding: '40px 20px', textAlign: 'center', color: muted, fontSize: 14.5 }}>
              {tab === 'out' ? 'Nothing is out of stock.' : tab === 'low' ? `No product has ${LOW} or fewer left.` : tab === 'slow' ? 'Every product in stock sold in the last 30 days.' : 'No products match.'}
            </div>
          ) : isMobile ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {list.map(p => (
                <div key={p.id} style={{ ...panel, padding: 12 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Thumb src={p.image} size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: ink, lineHeight: 1.3 }}>{p.name}</div>
                      <div style={{ fontSize: 12.5, color: muted }}>{fmt(p.price)} · {sold30[p.id] || 0} sold in 30 days{daysLeft(p) != null ? ` · ≈${daysLeft(p)} days left` : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <StockEditor product={p} onSaved={onSaved} />
                    <button onClick={() => openHistory(p)} style={{ ...control, padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}><History size={14} /> History</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...panel, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Product</th><th style={th}>Category</th><th style={{ ...th, textAlign: 'right' }}>Price</th>
                  <th style={{ ...th, textAlign: 'right' }}>Sold · 30 days</th><th style={{ ...th, textAlign: 'right' }}>Lasts about</th><th style={th}>In stock</th><th style={th} />
                </tr></thead>
                <tbody>
                  {list.map(p => {
                    const dl = daysLeft(p);
                    return (
                      <tr key={p.id}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Thumb src={p.image} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: ink, fontWeight: 500, maxWidth: 340, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</div>
                              <div style={{ fontSize: 12.5, color: muted }}>{[p.brand, p.sku].filter(Boolean).join(' · ') || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: muted, fontSize: 13 }}>{catName[p.category_id] || 'No category'}</td>
                        <td className="num" style={{ ...td, textAlign: 'right', color: ink }}>{fmt(p.price)}</td>
                        <td className="num" style={{ ...td, textAlign: 'right', color: sold30[p.id] ? ink : muted }}>{sold30[p.id] || 0}</td>
                        <td className="num" style={{ ...td, textAlign: 'right', color: dl != null && dl <= 7 ? '#B42318' : muted }}>{(p.stock || 0) <= 0 ? '—' : dl == null ? 'No recent sales' : dl === 0 ? 'Under a day' : `${dl} day${dl !== 1 ? 's' : ''}`}</td>
                        <td style={td}><StockEditor product={p} onSaved={onSaved} /></td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <button onClick={() => openHistory(p)} title="Stock history" aria-label={`Stock history for ${p.name}`}
                            style={{ ...control, padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}><History size={14} /> History</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 13, color: muted, marginTop: 10 }}>
            Stock goes down when an order is placed and back up when an order is cancelled or returned. To change prices, photos or details use <Link to="/admin/products" className="more-link" style={{ color: '#1E88E5' }}>Products</Link>.
          </div>
        </>
      )}

      {/* Per-product history */}
      {historyFor && (
        <>
          <div onClick={() => setHistoryFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 900 }} />
          <aside role="dialog" aria-label={`Stock history: ${historyFor.name}`}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : 440, background: 'var(--bg-fff, #fff)', zIndex: 901, display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(15,23,42,.18)' }}>
            <div style={{ padding: '16px 20px', borderBottom: edge, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Thumb src={historyFor.image} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: ink, lineHeight: 1.3 }}>{historyFor.name}</div>
                <div className="num" style={{ fontSize: 13, color: muted }}>Now <b style={{ color: stockColor(historyFor.stock || 0) }}>{historyFor.stock ?? 0}</b> in stock · {sold30[historyFor.id] || 0} sold in 30 days</div>
              </div>
              <button onClick={() => setHistoryFor(null)} aria-label="Close" style={{ ...control, padding: 8, display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
              <HistoryList rows={historyRows} />
            </div>
          </aside>
        </>
      )}
    </AdminLayout>
  );
}
