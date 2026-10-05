import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Package } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { useCartStore } from '../../store/cartStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useSeo } from '../../lib/seo';

export default function Cart() {
  useSeo({ title: 'Shopping Cart', noindex: true });
  const { items, remove, update, clear } = useCartStore();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

  if (items.length === 0) return (
    <CustomerLayout>
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><ShoppingCart size={80} color="#1E88E5" /></div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-212529, #212529)', marginBottom: 8 }}>Your cart is empty</h2>
        <p style={{ color: 'var(--tx-9aa5b1, #9aa5b1)', marginBottom: 24 }}>Add some products to continue.</p>
        <Link to="/products" style={{ padding: '12px 28px', background: '#1E88E5', color: '#fff', textDecoration: 'none', borderRadius: 8, fontWeight: 700 }}>Shop Now</Link>
      </div>
    </CustomerLayout>
  );

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-212529, #212529)', marginBottom: 24 }}>Shopping Cart ({items.reduce((s, i) => s + i.qty, 0)} items)</h1>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 24, alignItems: 'start' }}>
          {/* Items */}
          <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            {items.map((item, i) => (
              <div key={item.key || item.id} style={{ display: 'flex', gap: 16, padding: '16px 20px', borderBottom: i < items.length - 1 ? '1px solid var(--bd-f8f9fa, #F8F9FA)' : 'none' }}>
                <div style={{ width: 70, height: 70, borderRadius: 10, background: 'var(--bg-f8f9fa, #F8F9FA)', backgroundImage: item.image ? `url(${item.image})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {!item.image && <Package size={30} color="#ccc" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--tx-212529, #212529)', marginBottom: 4 }}>{item.name}</div>
                  {item.variant && <div style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', marginBottom: 4 }}>{item.variant}</div>}
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1E88E5', marginBottom: 10 }}>৳{item.price} × {item.qty} = ৳{item.price * item.qty}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, overflow: 'hidden' }}>
                      <button onClick={() => update(item.key || item.id, item.qty - 1)} style={{ width: 32, height: 32, border: 'none', background: 'var(--bg-f8f9fa, #F8F9FA)', cursor: 'pointer', fontSize: 16 }}>−</button>
                      <div style={{ width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{item.qty}</div>
                      <button onClick={() => update(item.key || item.id, item.qty + 1)} disabled={item.stock != null && item.qty >= item.stock} style={{ width: 32, height: 32, border: 'none', background: 'var(--bg-f8f9fa, #F8F9FA)', cursor: item.stock != null && item.qty >= item.stock ? 'not-allowed' : 'pointer', opacity: item.stock != null && item.qty >= item.stock ? .4 : 1, fontSize: 16 }}>+</button>
                    </div>
                    <button onClick={() => remove(item.key || item.id)} style={{ fontSize: 12, color: '#1E88E5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Order Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
              <span>Subtotal</span><span style={{ fontWeight: 600 }}>৳{subtotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13, color: 'var(--tx-9aa5b1, #9aa5b1)' }}>
              <span>Delivery</span><span>Calculated at checkout</span>
            </div>
            <div style={{ borderTop: '1px solid var(--bd-f0f0f0, #f0f0f0)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, marginBottom: 20 }}>
              <span>Subtotal</span><span>৳{subtotal.toLocaleString('en-BD')}</span>
            </div>
            <button onClick={() => navigate('/checkout')}
              style={{ width: '100%', padding: '13px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 10 }}>
              Proceed to Checkout →
            </button>
            <Link to="/products" style={{ display: 'block', textAlign: 'center', fontSize: 13, color: 'var(--tx-9aa5b1, #9aa5b1)', textDecoration: 'none', marginTop: 8 }}>
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
