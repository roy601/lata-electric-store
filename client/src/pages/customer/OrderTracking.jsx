import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Truck, Star, X, LogIn } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { supabase } from '../../lib/supabase';

const STEPS = [
  { key: 'pending',   label: 'Order Placed',  Icon: ClipboardList,  desc: 'Your order has been received.' },
  { key: 'confirmed', label: 'Confirmed',      Icon: CheckCircle2,   desc: 'Order confirmed and being prepared.' },
  { key: 'shipped',   label: 'Shipped',        Icon: Truck,          desc: 'Out for delivery.' },
  { key: 'delivered', label: 'Delivered',      Icon: Star,           desc: 'Order delivered successfully!' },
];

const stepIndex = (status) => {
  const idx = STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
};

export default function OrderTracking() {
  const { orderId: urlOrderId } = useParams();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState(urlOrderId || '');
  const [phone,   setPhone]   = useState('');
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const lookup = async (id, ph) => {
    if (!id || !ph) return;
    setLoading(true); setError(''); setOrder(null);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', id.trim().toUpperCase())
      .eq('customer_phone', ph.trim())
      .single();
    if (!data) setError('Order not found. Please check your Order ID and phone number.');
    else setOrder(data);
    setLoading(false);
  };

  /* auto-lookup only when URL has orderId and user supplies phone */
  const handleSearch = (e) => {
    e.preventDefault();
    if (!orderId.trim() || !phone.trim()) {
      setError('Please enter both your Order ID and phone number.');
      return;
    }
    navigate(`/track/${orderId.trim().toUpperCase()}`);
    lookup(orderId.trim(), phone.trim());
  };

  const current = order ? stepIndex(order.status) : -1;

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#212529', marginBottom: 4 }}>Track Your Order</h1>
        <p style={{ color: '#9aa5b1', fontSize: 14, marginBottom: 24 }}>
          Enter your Order ID and the phone number used at checkout.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          <input
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
            placeholder="Order ID — e.g. LE1A2B3C"
            style={{ padding: '12px 16px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 15, outline: 'none', transition: 'border-color .2s', fontFamily: 'inherit' }}
            onFocus={e => e.target.style.borderColor = '#1E88E5'}
            onBlur={e  => e.target.style.borderColor = '#e0e0e0'}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone number used at checkout — 01XXXXXXXXX"
              style={{ flex: 1, padding: '12px 16px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 15, outline: 'none', transition: 'border-color .2s', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = '#1E88E5'}
              onBlur={e  => e.target.style.borderColor = '#e0e0e0'}
            />
            <button type="submit" disabled={loading}
              style={{ padding: '12px 28px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, opacity: loading ? .7 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {loading ? '…' : 'Track'}
            </button>
          </div>
        </form>

        {/* Login nudge */}
        <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '12px 16px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#374151' }}>Have an account? View all your orders in one place.</span>
          <Link to="/account" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#1E3A5F', textDecoration: 'none' }}>
            <LogIn size={13} /> My Account →
          </Link>
        </div>

        {error && (
          <div style={{ background: '#f8d7da', color: '#842029', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>{error}</div>
        )}

        {order && !loading && (
          <>
            {/* Order info */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
                <div>
                  <div style={{ color: '#9aa5b1', fontSize: 12 }}>ORDER ID</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>#{order.order_id}</div>
                </div>
                <div>
                  <div style={{ color: '#9aa5b1', fontSize: 12 }}>DATE</div>
                  <div style={{ fontWeight: 600 }}>{new Date(order.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <div>
                  <div style={{ color: '#9aa5b1', fontSize: 12 }}>CUSTOMER</div>
                  <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                  <div style={{ color: '#555', fontSize: 13 }}>{order.customer_phone}</div>
                </div>
                <div>
                  <div style={{ color: '#9aa5b1', fontSize: 12 }}>TOTAL</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#1E88E5' }}>৳{order.total}</div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            {order.status !== 'cancelled' ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                <h3 style={{ margin: '0 0 24px', fontSize: 15, fontWeight: 700 }}>Order Status</h3>
                {STEPS.map((step, i) => {
                  const done   = i <= current;
                  const active = i === current;
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: done ? '#1E88E5' : '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: active ? '3px solid #e74c3c' : 'none', boxShadow: active ? '0 0 0 4px #ffeaea' : 'none' }}>
                          {done ? <step.Icon size={18} color="#fff" /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ccc', display: 'block' }} />}
                        </div>
                        {i < STEPS.length - 1 && <div style={{ width: 2, height: 32, background: i < current ? '#1E88E5' : '#f0f0f0', marginTop: 2, marginBottom: 2 }} />}
                      </div>
                      <div style={{ paddingTop: 8, paddingBottom: i < STEPS.length - 1 ? 16 : 0 }}>
                        <div style={{ fontWeight: active ? 700 : 600, fontSize: 15, color: done ? '#212529' : '#9aa5b1' }}>{step.label}</div>
                        {done && <div style={{ fontSize: 13, color: '#7f8c9a', marginTop: 2 }}>{step.desc}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ background: '#f8d7da', color: '#842029', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
                <X size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> This order has been cancelled.
              </div>
            )}

            {/* Items */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Items Ordered</h3>
              {(order.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', borderBottom: i < order.items.length - 1 ? '1px solid #F8F9FA' : 'none' }}>
                  <span>{item.name} × {item.qty}</span>
                  <span style={{ fontWeight: 600 }}>৳{item.price * item.qty}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8, color: '#555' }}>
                <span>Delivery</span><span>৳{order.delivery_charge}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, marginTop: 8, paddingTop: 8, borderTop: '2px solid #f0f0f0' }}>
                <span>Total</span><span style={{ color: '#1E88E5' }}>৳{order.total}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
