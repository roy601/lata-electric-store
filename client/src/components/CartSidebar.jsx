import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, X, Package, Trash2 } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useBreakpoint } from '../hooks/useBreakpoint';

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
        background: '#fff', zIndex: 901, display: 'flex', flexDirection: 'column',
        transform: open ? (isMobile ? 'translateY(0)' : 'translateX(0)') : (isMobile ? 'translateY(100%)' : 'translateX(100%)'),
        transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
        boxShadow: isMobile ? '0 -6px 32px rgba(0,0,0,.18)' : '-6px 0 32px rgba(0,0,0,.18)',
        borderRadius: isMobile ? '16px 16px 0 0' : 0,
        maxHeight: isMobile ? '92vh' : '100vh',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
          <div style={{ width: 38, height: 38, background: '#E3F2FD', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={20} color="#1E88E5" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#212529' }}>Shopping Cart</div>
            <div style={{ fontSize: 12, color: '#9aa5b1' }}>{count} {count === 1 ? 'item' : 'items'}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color='#333'}
            onMouseLeave={e => e.currentTarget.style.color='#bbb'}>
            <X size={22} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {items.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center' }}>
              <div style={{ width: 90, height: 90, background: '#E3F2FD', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <ShoppingCart size={40} color="#1E88E5" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#212529', marginBottom: 8 }}>Your cart is empty</div>
              <div style={{ fontSize: 13, color: '#9aa5b1', marginBottom: 24 }}>Discover amazing products and add them to your cart!</div>
              <button onClick={() => { onClose(); navigate('/'); }}
                style={{ padding: '11px 28px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Start Shopping
              </button>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f8f9fa', alignItems: 'flex-start' }}>
                <div style={{ width: 64, height: 64, borderRadius: 10, background: '#F8F9FA', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.image
                    ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Package size={26} color="#ccc" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#212529', lineHeight: 1.4, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1E88E5', marginBottom: 8 }}>৳{(item.price * item.qty).toLocaleString('en-BD')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
                      <button onClick={() => update(item.id, item.qty - 1)}
                        style={{ width: 30, height: 30, border: 'none', background: '#f8f9fa', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ width: 32, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{item.qty}</span>
                      <button onClick={() => update(item.id, item.qty + 1)}
                        style={{ width: 30, height: 30, border: 'none', background: '#f8f9fa', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <button onClick={() => remove(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 4, display: 'flex', alignItems: 'center', transition: 'color .15s' }}
                      onMouseEnter={e => e.currentTarget.style.color='#DC3545'}
                      onMouseLeave={e => e.currentTarget.style.color='#bbb'}>
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
          <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#7f8c9a' }}>Subtotal ({count} items)</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>৳{total.toLocaleString('en-BD')}</span>
            </div>
            <div style={{ fontSize: 11, color: '#9aa5b1', marginBottom: 14 }}>Delivery charges calculated at checkout</div>
            <button onClick={() => { onClose(); navigate('/checkout'); }}
              style={{ width: '100%', padding: '13px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 8, transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background='#1565C0'}
              onMouseLeave={e => e.currentTarget.style.background='#1E88E5'}>
              Checkout — ৳{total.toLocaleString('en-BD')} →
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { if (window.confirm('Clear cart?')) clear(); }}
                style={{ flex: 1, padding: '9px', background: '#fff', color: '#1E88E5', border: '1px solid #1E88E5', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Clear Cart
              </button>
              <button onClick={onClose}
                style={{ flex: 1, padding: '9px', background: '#F8F9FA', color: '#555', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
