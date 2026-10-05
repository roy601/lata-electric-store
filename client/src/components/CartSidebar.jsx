import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, X, Package, Trash2 } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useBreakpoint } from '../hooks/useBreakpoint';
import EmptyState from './common/EmptyState';

export default function CartSidebar({ open, onClose }) {
  const { items, remove, update, clear } = useCartStore();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 900, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .25s' }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: isMobile ? 'auto' : 0, right: 0, bottom: 0,
        left: isMobile ? 0 : 'auto',
        width: isMobile ? '100%' : 390, maxWidth: '100vw',
        background: 'var(--bg-fff, #fff)', zIndex: 901, display: 'flex', flexDirection: 'column',
        transform: open ? (isMobile ? 'translateY(0)' : 'translateX(0)') : (isMobile ? 'translateY(100%)' : 'translateX(100%)'),
        transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
        boxShadow: isMobile ? '0 -6px 32px rgba(0,0,0,.18)' : '-6px 0 32px rgba(0,0,0,.18)',
        borderRadius: isMobile ? '16px 16px 0 0' : 0,
        maxHeight: isMobile ? '92vh' : '100vh',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd-f0f0f0, #f0f0f0)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-fff, #fff)' }}>
          <div style={{ width: 38, height: 38, background: 'var(--bg-e3f2fd, #E3F2FD)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={20} color="#1E88E5" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--tx-212529, #212529)' }}>Shopping Cart</div>
            <div style={{ fontSize: 12, color: 'var(--tx-9aa5b1, #9aa5b1)' }}>{count} {count === 1 ? 'item' : 'items'}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-bbb, #bbb)', padding: 4, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--tx-333, #333)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--tx-bbb, #bbb)'}>
            <X size={22} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {items.length === 0 ? (
            <div style={{ padding: '8px 20px' }}>
              <EmptyState title="Your cart is empty" text="Products you add will wait here until you check out." action="Browse products"
                onAction={() => { onClose(); navigate('/products'); }} style={{ padding: '24px 0' }} />
            </div>
          ) : (
            items.map(item => (
              <div key={item.key || item.id} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--bd-f8f9fa, #f8f9fa)', alignItems: 'flex-start' }}>
                <div style={{ width: 64, height: 64, borderRadius: 'var(--r-md)', background: 'var(--bg-f8f9fa, #F8F9FA)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.image
                    ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Package size={26} color="#ccc" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-212529, #212529)', lineHeight: 1.4, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.name}</div>
                  {item.variant && <div style={{ fontSize: 11, color: 'var(--tx-7f8c9a, #7f8c9a)', marginBottom: 4 }}>{item.variant}</div>}
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1E88E5', marginBottom: 8 }}>৳{(item.price * item.qty).toLocaleString('en-BD')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, overflow: 'hidden' }}>
                      <button onClick={() => update(item.key || item.id, item.qty - 1)}
                        style={{ width: 30, height: 30, border: 'none', background: 'var(--bg-f8f9fa, #f8f9fa)', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: 'var(--tx-555, #555)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ width: 32, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{item.qty}</span>
                      <button onClick={() => update(item.key || item.id, item.qty + 1)} disabled={item.stock != null && item.qty >= item.stock}
                        style={{ width: 30, height: 30, border: 'none', background: 'var(--bg-f8f9fa, #f8f9fa)', cursor: item.stock != null && item.qty >= item.stock ? 'not-allowed' : 'pointer', opacity: item.stock != null && item.qty >= item.stock ? .4 : 1, fontSize: 16, fontWeight: 700, color: 'var(--tx-555, #555)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <button onClick={() => remove(item.key || item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-bbb, #bbb)', padding: 4, display: 'flex', alignItems: 'center', transition: 'color .15s' }}
                      onMouseEnter={e => e.currentTarget.style.color='#DC3545'}
                      onMouseLeave={e => e.currentTarget.style.color='var(--tx-bbb, #bbb)'}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--bd-f0f0f0, #f0f0f0)', background: 'var(--bg-fff, #fff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--tx-7f8c9a, #7f8c9a)' }}>Subtotal ({count} items)</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>৳{total.toLocaleString('en-BD')}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx-9aa5b1, #9aa5b1)', marginBottom: 14 }}>Delivery charges calculated at checkout</div>
            <button onClick={() => { onClose(); navigate('/checkout'); }}
              style={{ width: '100%', padding: '13px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 8, transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background='#1565C0'}
              onMouseLeave={e => e.currentTarget.style.background='#1E88E5'}>
              Checkout — ৳{total.toLocaleString('en-BD')} →
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { if (window.confirm('Clear cart?')) clear(); }}
                style={{ flex: 1, padding: '9px', background: 'var(--bg-fff, #fff)', color: '#1E88E5', border: '1px solid #1E88E5', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Clear Cart
              </button>
              <button onClick={onClose}
                style={{ flex: 1, padding: '9px', background: 'var(--bg-f8f9fa, #F8F9FA)', color: 'var(--tx-555, #555)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
