import { useEffect, useState } from 'react';
import { Phone, MapPin, AlertTriangle, X, CheckCircle2, Package, RotateCcw } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];

const STATUS_META = {
  pending:          { bg: '#fff3cd', color: '#856404',  label: 'Pending' },
  confirmed:        { bg: '#cfe2ff', color: '#084298',  label: 'Confirmed' },
  shipped:          { bg: '#d1ecf1', color: '#0c5460',  label: 'Shipped' },
  delivered:        { bg: '#d1e7dd', color: '#0f5132',  label: 'Delivered' },
  cancelled:        { bg: '#f8d7da', color: '#842029',  label: 'Cancelled' },
  return_requested: { bg: '#fff0e0', color: '#7d4000',  label: 'Return Req.' },
  returned:         { bg: '#ede7f6', color: '#4527a0',  label: 'Returned' },
};

const FILTER_TABS = ['all', ...STATUSES];

export default function AdminOrders() {
  const [orders,   setOrders]   = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [returning, setReturning] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    toast.success('Status updated to ' + STATUS_META[status]?.label);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
  };

  const markPaid = async (id) => {
    const { error } = await supabase.from('orders').update({ payment_paid: true }).eq('id', id);
    if (error) { toast.error('Failed'); return; }
    toast.success('Payment marked as received');
    setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_paid: true } : o));
    if (selected?.id === id) setSelected(prev => ({ ...prev, payment_paid: true }));
  };

  const processReturn = async () => {
    if (!selected) return;
    setReturning(true);

    // 1. Mark order as returned with reason
    const { error: orderErr } = await supabase.from('orders')
      .update({ status: 'returned', return_reason: returnReason || null })
      .eq('id', selected.id);

    if (orderErr) { toast.error('Failed: ' + orderErr.message); setReturning(false); return; }

    // 2. Add items back to inventory
    const items = selected.items || [];
    const stockErrors = [];
    for (const item of items) {
      // Get current stock
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
      if (prod) {
        const newStock = (prod.stock || 0) + item.qty;
        const { error: stockErr } = await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
        if (stockErr) stockErrors.push(item.name);
      }
    }

    setReturning(false);
    setShowReturnModal(false);
    setReturnReason('');

    if (stockErrors.length > 0) {
      toast.error(`Return saved but stock update failed for: ${stockErrors.join(', ')}`);
    } else {
      toast.success(`Return processed — ${items.length} item(s) restocked`);
    }

    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'returned', return_reason: returnReason || null } : o));
    setSelected(prev => ({ ...prev, status: 'returned', return_reason: returnReason || null }));
  };

  const fmt = (n) => '৳' + Number(n || 0).toLocaleString('en-BD');

  const visible = orders.filter(o =>
    !search ||
    o.order_id?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_phone?.includes(search)
  );

  const counts = FILTER_TABS.reduce((acc, s) => {
    acc[s] = s === 'all' ? orders.length : orders.filter(o => o.status === s).length;
    return acc;
  }, {});

  return (
    <AdminLayout title="Orders">

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input placeholder="Search by order ID, customer name, phone…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 420, padding: '9px 14px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14 }} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(s => {
          const meta  = STATUS_META[s];
          const count = counts[s];
          const active = filter === s;
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: active ? '#212529' : (meta?.bg || '#f0f0f0'),
              color:      active ? '#fff'    : (meta?.color || '#555'),
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {meta?.label || 'All'}
              {count > 0 && <span style={{ background: active ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.12)', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Table ── */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>No orders found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['Order ID', 'Customer', 'Total', 'Payment', 'Status', 'Paid', 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#7f8c9a', fontWeight: 600, borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(o => {
                  const meta = STATUS_META[o.status] || STATUS_META.pending;
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #F8F9FA', background: selected?.id === o.id ? '#fff8f8' : '#fff', cursor: 'pointer' }}
                      onClick={() => setSelected(o)}>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: '#212529' }}>#{o.order_id}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                        <div style={{ color: '#9aa5b1', fontSize: 11 }}>{o.customer_phone}</div>
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 600 }}>{fmt(o.total)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#4a5568' }}>{o.payment_method}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ background: meta.bg, color: meta.color, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{meta.label}</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {o.payment_paid
                          ? <CheckCircle2 size={16} color="#28A745" />
                          : <span style={{ color: '#bbb', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px', color: '#9aa5b1', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {new Date(o.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <button onClick={e => { e.stopPropagation(); setSelected(o); }}
                          style={{ padding: '4px 11px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#212529' }}>#{selected.order_id}</div>
                <div style={{ fontSize: 12, color: '#9aa5b1' }}>{new Date(selected.created_at).toLocaleString('en-BD')}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>

            {/* Customer info */}
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Customer</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{selected.customer_name}</div>
              <div style={{ fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={12} color="#1E88E5" /> {selected.customer_phone}</div>
              <div style={{ fontSize: 13, color: '#555', display: 'flex', alignItems: 'flex-start', gap: 5 }}><MapPin size={12} color="#1E88E5" style={{ marginTop: 2, flexShrink: 0 }} /> {selected.customer_address}, {selected.customer_city}</div>
              {selected.customer_district && selected.customer_district !== selected.customer_city && (
                <div style={{ fontSize: 13, color: '#555' }}>{selected.customer_district}</div>
              )}
            </div>

            {/* Items */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Items</div>
              {(selected.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.image && <img src={item.image} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover', background: '#eee' }} />}
                    <span>{item.name} <span style={{ color: '#9aa5b1' }}>× {item.qty}</span></span>
                  </div>
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>৳{item.price * item.qty}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #eee', marginTop: 10, paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginBottom: 4 }}>
                  <span>Subtotal</span><span>৳{selected.subtotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginBottom: 6 }}>
                  <span>Delivery</span><span>৳{selected.delivery_charge}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}>
                  <span>Total</span><span style={{ color: '#1E88E5' }}>{fmt(selected.total)}</span>
                </div>
              </div>
            </div>

            {/* Payment info */}
            <div style={{ background: selected.payment_paid ? '#e8f5e9' : '#fff8f0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1 }}>Payment</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{selected.payment_method}</div>
                {selected.transaction_id && <div style={{ fontSize: 11, color: '#7f8c9a' }}>TrxID: {selected.transaction_id}</div>}
              </div>
              {selected.payment_paid
                ? <span style={{ background: '#28A745', color: '#fff', fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Paid</span>
                : <button onClick={() => markPaid(selected.id)}
                    style={{ padding: '6px 14px', background: '#28A745', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                    Mark as Paid
                  </button>}
            </div>

            {/* Return reason if returned */}
            {selected.status === 'returned' && selected.return_reason && (
              <div style={{ background: '#ede7f6', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4527a0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Return Reason</div>
                <div style={{ fontSize: 13, color: '#333' }}>{selected.return_reason}</div>
              </div>
            )}

            {/* Status buttons */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Update Status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['pending','confirmed','shipped','delivered','cancelled'].map(s => {
                  const meta = STATUS_META[s];
                  const active = selected.status === s;
                  return (
                    <button key={s} onClick={() => updateStatus(selected.id, s)} style={{
                      padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: active ? '#212529' : meta.bg,
                      color:      active ? '#fff'    : meta.color,
                    }}>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Return section — only show if delivered and not already returned */}
            {['delivered', 'return_requested'].includes(selected.status) && (
              <div style={{ borderTop: '2px dashed #eee', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Return Management</div>
                {selected.status === 'return_requested' && (
                  <div style={{ background: '#fff0e0', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10, color: '#7d4000', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> Customer has requested a return
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.status === 'delivered' && (
                    <button onClick={() => updateStatus(selected.id, 'return_requested')}
                      style={{ flex: 1, padding: '8px', background: '#fff0e0', color: '#7d4000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      Mark Return Requested
                    </button>
                  )}
                  <button onClick={() => { setShowReturnModal(true); }}
                    style={{ flex: 1, padding: '8px', background: '#4527a0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                    <RotateCcw size={13} style={{ marginRight: 5 }} /> Process Return + Restock
                  </button>
                </div>
              </div>
            )}

            {selected.status === 'returned' && (
              <div style={{ background: '#ede7f6', borderRadius: 8, padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#4527a0' }}>
                <CheckCircle2 size={14} style={{ marginRight: 5 }} /> Return processed — items restocked
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Return Modal ── */}
      {showReturnModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowReturnModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>Process Return</h3>
            <div style={{ fontSize: 13, color: '#7f8c9a', marginBottom: 20 }}>Order #{selected.order_id} — items will be added back to stock</div>

            {/* Items to restock */}
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 12, marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9aa5b1', marginBottom: 8 }}>Items to restock:</div>
              {(selected.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{item.name}</span>
                  <span style={{ fontWeight: 700, color: '#28A745' }}>+{item.qty} units</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Return Reason (optional)</label>
              <textarea value={returnReason} onChange={e => setReturnReason(e.target.value)}
                placeholder="e.g. Wrong product, damaged item, customer changed mind…"
                rows={3}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowReturnModal(false); setReturnReason(''); }}
                style={{ flex: 1, padding: '11px', background: '#f0f0f0', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={processReturn} disabled={returning}
                style={{ flex: 2, padding: '11px', background: '#4527a0', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}>
                {returning ? 'Processing…' : '↩ Confirm Return & Restock'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
