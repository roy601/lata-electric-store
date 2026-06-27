import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Inbox, Clock, CheckCircle2, Truck, XCircle, RotateCcw, Search, LogIn, LogOut, User } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { supabase } from '../../lib/supabase';

const STATUS_META = {
  pending:          { bg: '#fff3cd', color: '#856404',  Icon: Clock,         label: 'Pending' },
  confirmed:        { bg: '#cfe2ff', color: '#084298',  Icon: CheckCircle2,  label: 'Confirmed' },
  shipped:          { bg: '#d1ecf1', color: '#0c5460',  Icon: Truck,         label: 'Shipped' },
  delivered:        { bg: '#d1e7dd', color: '#0f5132',  Icon: Package,       label: 'Delivered' },
  cancelled:        { bg: '#f8d7da', color: '#842029',  Icon: XCircle,       label: 'Cancelled' },
  return_requested: { bg: '#fff0e0', color: '#7d4000',  Icon: RotateCcw,     label: 'Return Requested' },
  returned:         { bg: '#ede7f6', color: '#4527a0',  Icon: RotateCcw,     label: 'Returned' },
};

export default function Account() {
  const { user, loading: authLoading, signOut } = useCustomerAuth();
  const [orders,   setOrders]   = useState([]);
  const [fetching, setFetching] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    supabase
      .from('orders')
      .select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders(data || []);
        setFetching(false);
      });
  }, [user]);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const fmt = (n) => '৳' + Number(n || 0).toLocaleString('en-BD');

  /* ── auth loading ── */
  if (authLoading) {
    return (
      <CustomerLayout>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #f0f0f0', borderTop: '3px solid #1E88E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      </CustomerLayout>
    );
  }

  /* ── not logged in ── */
  if (!user) {
    return (
      <CustomerLayout>
        <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Package size={32} color="#1E3A5F" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#212529', margin: '0 0 10px' }}>My Orders</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>
            Log in to view your full order history, track deliveries, and manage returns.
          </p>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 32px', background: '#1E3A5F', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>
            <LogIn size={16} /> Login to My Account
          </Link>
          <div style={{ marginTop: 24, fontSize: 13, color: '#9aa5b1' }}>
            Placed a guest order?{' '}
            <Link to="/track" style={{ color: '#1E88E5', fontWeight: 600, textDecoration: 'none' }}>Track it here →</Link>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.first_name || user.email;

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>

        {/* ── Profile header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#212529', margin: 0 }}>{displayName}</h1>
              <div style={{ fontSize: 13, color: '#9aa5b1', marginTop: 2 }}>{user.email}</div>
            </div>
          </div>
          <button onClick={signOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#f8f9fa', color: '#555', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        {/* ── Loading orders ── */}
        {fetching && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5b1' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #f0f0f0', borderTop: '3px solid #1E88E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Loading your orders…
          </div>
        )}

        {/* ── No orders ── */}
        {!fetching && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5b1' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Inbox size={56} color="#ccc" /></div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#374151' }}>No orders found</div>
            <p style={{ fontSize: 14, color: '#9aa5b1', maxWidth: 340, margin: '0 auto 20px', lineHeight: 1.6 }}>
              Orders placed as a guest without your account email won't appear here.
              Use the order tracker to find those.
            </p>
            <Link to="/track" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#212529', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
              <Search size={13} /> Track a Guest Order
            </Link>
          </div>
        )}

        {/* ── Summary bar ── */}
        {orders.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', borderRadius: 10, padding: '10px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', fontSize: 13 }}>
              <span style={{ color: '#9aa5b1' }}>Total orders: </span>
              <span style={{ fontWeight: 700, color: '#212529' }}>{orders.length}</span>
            </div>
            <div style={{ background: '#fff', borderRadius: 10, padding: '10px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', fontSize: 13 }}>
              <span style={{ color: '#9aa5b1' }}>Total spent: </span>
              <span style={{ fontWeight: 700, color: '#1E88E5' }}>{fmt(orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0))}</span>
            </div>
          </div>
        )}

        {/* ── Order cards ── */}
        {orders.map(o => {
          const meta = STATUS_META[o.status] || STATUS_META.pending;
          const isExpanded = expanded[o.id];
          const itemList = o.items || [];

          return (
            <div key={o.id} style={{ background: '#fff', borderRadius: 14, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'hidden' }}>

              {/* Card header */}
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, cursor: 'pointer' }}
                onClick={() => toggleExpand(o.id)}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#212529' }}>#{o.order_id}</span>
                    <span style={{ background: meta.bg, color: meta.color, padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <meta.Icon size={12} /> {meta.label}
                    </span>
                    {o.payment_paid && (
                      <span style={{ background: '#d1e7dd', color: '#0f5132', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Paid</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 4 }}>
                    {new Date(o.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E88E5' }}>{fmt(o.total)}</div>
                    <div style={{ fontSize: 12, color: '#9aa5b1' }}>{o.payment_method}</div>
                  </div>
                  <span style={{ fontSize: 18, color: '#bbb', transition: 'transform .2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>⌄</span>
                </div>
              </div>

              {/* Item thumbnails (always visible) */}
              <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {itemList.slice(0, 4).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8f9fa', borderRadius: 8, padding: '5px 10px', fontSize: 13 }}>
                    {item.image && <img src={item.image} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover' }} />}
                    <span style={{ color: '#333', fontWeight: 500 }}>{item.name}</span>
                    <span style={{ color: '#9aa5b1' }}>×{item.qty}</span>
                  </div>
                ))}
                {itemList.length > 4 && (
                  <div style={{ background: '#f0f0f0', borderRadius: 8, padding: '5px 10px', fontSize: 13, color: '#9aa5b1' }}>+{itemList.length - 4} more</div>
                )}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '16px 20px' }}>

                  {/* Delivery address */}
                  <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Delivery Address</div>
                    <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>
                      <div><strong>{o.customer_name}</strong> · {o.customer_phone}</div>
                      <div>{o.customer_address}, {o.customer_city}{o.customer_district && o.customer_district !== o.customer_city ? `, ${o.customer_district}` : ''}</div>
                    </div>
                  </div>

                  {/* Itemised breakdown */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Order Items</div>
                    {itemList.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0f0f0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.image
                              ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <Package size={18} color="#ccc" />}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#212529' }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: '#9aa5b1' }}>৳{item.price} × {item.qty}</div>
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#212529' }}>৳{item.price * item.qty}</span>
                      </div>
                    ))}

                    <div style={{ borderTop: '1px solid #eee', marginTop: 10, paddingTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginBottom: 4 }}>
                        <span>Subtotal</span><span>৳{o.subtotal}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginBottom: 8 }}>
                        <span>Delivery</span><span>{o.delivery_charge === 0 ? 'Free' : `৳${o.delivery_charge}`}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17 }}>
                        <span>Total</span><span style={{ color: '#1E88E5' }}>{fmt(o.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Return reason if returned */}
                  {o.return_reason && (
                    <div style={{ background: '#ede7f6', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4527a0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Return Reason</div>
                      <div style={{ fontSize: 13, color: '#333' }}>{o.return_reason}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link to={`/track/${o.order_id}`}
                      style={{ padding: '9px 20px', background: '#212529', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Search size={13} /> Track Order
                    </Link>
                    {o.status === 'delivered' && (
                      <a href="tel:01700-000000"
                        style={{ padding: '9px 20px', background: '#f8f9fa', color: '#333', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, border: '1px solid #e0e0e0' }}>
                        ↩ Request Return
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

      </div>
    </CustomerLayout>
  );
}
