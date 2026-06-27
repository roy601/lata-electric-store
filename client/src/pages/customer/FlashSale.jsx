import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Package, ShoppingCart, Clock } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/cartStore';

export default function FlashSalePage() {
  const [products,  setProducts]  = useState([]);
  const [config,    setConfig]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [time,      setTime]      = useState({ h: '00', m: '00', s: '00', ended: false });
  const { add } = useCartStore();

  useEffect(() => {
    const load = async () => {
      const [pRes, sRes] = await Promise.all([
        supabase.from('products').select('*').eq('flash_sale', true).eq('is_active', true).order('name'),
        supabase.from('settings').select('flash_sale_active, flash_sale_ends').eq('id', 1).maybeSingle(),
      ]);
      setProducts(pRes.data || []);
      setConfig(sRes.data);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!config?.flash_sale_ends) return;
    const tick = () => {
      const diff = new Date(config.flash_sale_ends) - Date.now();
      if (diff <= 0) { setTime({ h: '00', m: '00', s: '00', ended: true }); return; }
      setTime({
        h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
        m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
        s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
        ended: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config]);

  const isActive = config?.flash_sale_active && !time.ended && products.length > 0;

  return (
    <CustomerLayout>

      {/* ── Hero Banner ── */}
      <div style={{ background: 'linear-gradient(135deg, #7b0000 0%, #DC3545 50%, #E53935 100%)', color: '#fff', padding: '36px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background pattern */}
        <div style={{ position: 'absolute', inset: 0, opacity: .06, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 48, marginBottom: 6, display: 'flex', justifyContent: 'center' }}><Zap size={48} fill="currentColor" /></div>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, letterSpacing: 1 }}>Flash Sale</h1>
          <p style={{ margin: '0 0 20px', opacity: .85, fontSize: 15 }}>Limited time — limited stock — unbeatable prices!</p>

          {/* Countdown */}
          {config?.flash_sale_ends && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.3)', borderRadius: 12, padding: '12px 24px' }}>
              <span style={{ fontSize: 12, opacity: .8, marginRight: 6, display: 'flex', alignItems: 'center', gap: 4 }}>{time.ended ? 'Sale ended' : <><Clock size={12} /> Time remaining</>}</span>
              {[{ val: time.h, label: 'HRS' }, { val: time.m, label: 'MIN' }, { val: time.s, label: 'SEC' }].map(({ val, label }, i) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ background: '#212529', fontFamily: 'monospace', fontWeight: 800, fontSize: 26, padding: '4px 12px', borderRadius: 8, minWidth: 48, textAlign: 'center', lineHeight: 1.2 }}>{val}</span>
                    <span style={{ fontSize: 10, opacity: .7, marginTop: 3, letterSpacing: 1 }}>{label}</span>
                  </span>
                  {i < 2 && <span style={{ fontWeight: 800, fontSize: 22, opacity: .7, marginBottom: 12 }}>:</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1260, margin: '0 auto', padding: '24px 16px' }}>

        {loading ? (
          <div style={{ padding: 80, textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '4px solid #f0f0f0', borderTop: '4px solid #DC3545', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
          </div>

        ) : !isActive ? (
          <div style={{ padding: '80px 0', textAlign: 'center', color: '#9aa5b1' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><Zap size={64} color="#ccc" /></div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#333' }}>No Active Flash Sale</div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>
              {time.ended ? 'The flash sale has ended.' : 'No flash sale is running right now. Check back soon!'}
            </div>
            <Link to="/" style={{ padding: '11px 28px', background: '#DC3545', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
              Browse All Products
            </Link>
          </div>

        ) : (
          <>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: '#DC3545', color: '#fff', padding: '4px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Zap size={12} fill="currentColor" /> {products.length} Deals</span>
                <span style={{ fontSize: 13, color: '#9aa5b1' }}>Hurry — limited stock!</span>
              </div>
            </div>

            {/* Product grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 14 }}>
              {products.map(p => {
                const price   = p.flash_price || p.price;
                const orig    = p.price;
                const disc    = orig > price ? Math.round((1 - price / orig) * 100) : null;
                const inStock = p.stock > 0;

                return (
                  <div key={p.id}
                    style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0d0d0', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow .2s, transform .15s', position: 'relative' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 20px rgba(192,57,43,.15)'; e.currentTarget.style.transform='translateY(-3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}>

                    {/* Discount badge */}
                    {disc && (
                      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1, background: '#DC3545', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 9px', borderRadius: 5 }}>-{disc}%</div>
                    )}

                    {/* Image */}
                    <Link to={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ height: 180, background: '#fff8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, position: 'relative' }}>
                        {p.image
                          ? <img src={p.image} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          : <Package size={52} color="#ccc" />}
                        {!inStock && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ background: '#555', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>Out of Stock</span>
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Info */}
                    <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Link to={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#212529', lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 36 }}>{p.name}</div>
                      </Link>

                      {/* Price row */}
                      <div style={{ marginTop: 'auto' }}>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#DC3545', lineHeight: 1 }}>৳{price.toLocaleString('en-BD')}</div>
                          {disc && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                              <span style={{ fontSize: 13, color: '#bbb', textDecoration: 'line-through' }}>৳{orig.toLocaleString('en-BD')}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#28A745' }}>Save ৳{orig - price}</span>
                            </div>
                          )}
                        </div>

                        {/* Stock bar */}
                        {inStock && p.stock <= 20 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 3 }}>
                              <span>Stock</span>
                              <span style={{ fontWeight: 600, color: p.stock <= 5 ? '#DC3545' : '#28A745' }}>{p.stock} left</span>
                            </div>
                            <div style={{ height: 4, background: '#eee', borderRadius: 2 }}>
                              <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (p.stock / 20) * 100)}%`, background: p.stock <= 5 ? '#DC3545' : '#28A745' }} />
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 7 }}>
                          <button
                            onClick={() => { if (inStock) { add({ id: p.id, name: p.name, price, image: p.image }); window.dispatchEvent(new CustomEvent('lata:open-cart')); } }}
                            disabled={!inStock}
                            style={{ flex: 1, padding: '8px 0', background: inStock ? '#fff' : '#eee', color: inStock ? '#1E88E5' : '#bbb', border: `1.5px solid ${inStock ? '#1E88E5' : '#eee'}`, borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: inStock ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <ShoppingCart size={13} /> Cart
                          </button>
                          <Link to={`/products/${p.id}`}
                            style={{ flex: 1, padding: '8px 0', background: inStock ? '#1E88E5' : '#ddd', color: '#fff', borderRadius: 7, fontWeight: 700, fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: inStock ? 'auto' : 'none' }}>
                            Buy Now
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
