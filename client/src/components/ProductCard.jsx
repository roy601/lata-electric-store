import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Package, Zap } from 'lucide-react';
import { useWishlistStore } from '../store/cartStore';
import { addWithFlair, photoIn, pop, haptic } from '../lib/cartFx';

/* Shared look of a product card (also used by RailCard):
   flat with a hairline edge, square discount tag in the corner,
   hover zooms the photo instead of lifting the card. */
export const cardStyle = (hover) => ({
  background: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-md)', overflow: 'hidden', position: 'relative',
  border: `1px solid ${hover ? 'rgba(15,23,42,.22)' : 'var(--hairline)'}`, transition: 'border-color .2s',
  display: 'flex', flexDirection: 'column',
});
export const cornerTag = { position: 'absolute', top: 0, left: 0, zIndex: 1, display: 'flex' };
export const discountTag = { background: '#E5383B', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 8px', lineHeight: 1.2 };
export const flashTag = { background: '#FFB020', color: '#3B2300', fontSize: 11.5, fontWeight: 700, padding: '4px 7px', lineHeight: 1.2, display: 'inline-flex', alignItems: 'center', gap: 3 };

export default function ProductCard({ product: p }) {
  const { toggle, has } = useWishlistStore();
  const wished = has(p.id);
  const [imgOk, setImgOk] = useState(!!p.image);  // broken picture → tidy placeholder, not alt text
  const [hover, setHover] = useState(false);
  const [added, setAdded] = useState(false);

  const price    = p.flash_sale && p.flash_price ? p.flash_price : p.price;
  const original = p.flash_sale && p.flash_price ? p.price : p.original_price;
  const discount = original && original > price ? Math.round((1 - price / original) * 100) : null;
  const inStock  = p.stock > 0;

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (addWithFlair(p, { price }, photoIn(e.currentTarget)) > 0) { setAdded(true); setTimeout(() => setAdded(false), 1600); }
  };

  return (
    <div data-card style={cardStyle(hover)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* Corner tags */}
      <div style={cornerTag}>
        {discount && <span style={discountTag}>−{discount}%</span>}
        {p.flash_sale && <span style={flashTag}><Zap size={11} fill="currentColor" /> Flash</span>}
      </div>

      {/* Wishlist */}
      <button onClick={e => { e.preventDefault(); toggle(p.id); pop(e.currentTarget, 1.3); haptic(8); }} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        style={{ position: 'absolute', top: 6, right: 6, zIndex: 1, background: 'transparent', border: 'none', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Heart size={18} color={wished ? '#E5383B' : '#94A3B8'} fill={wished ? '#E5383B' : 'none'} />
      </button>

      {/* Image */}
      <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', position: 'relative' }}>
        <div style={{ aspectRatio: '1/1', background: 'var(--bg-fff, #fff)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, boxSizing: 'border-box' }}>
          {imgOk
            ? <img src={p.image} alt={p.name} loading="lazy" onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: hover ? 'scale(1.06)' : 'none', transition: 'transform .4s ease' }} />
            : <Package size={40} color="#CBD5E1" />
          }
        </div>
        {!inStock && <span style={{ position: 'absolute', left: 0, bottom: 0, background: 'var(--ink)', color: 'var(--bg-fff, #fff)', fontSize: 11.5, fontWeight: 600, padding: '4px 8px' }}>Out of stock</span>}
      </Link>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {p.brand && <div style={{ fontSize: 12, color: 'var(--tx-64748b, #64748B)', marginBottom: 2 }}>{p.brand}</div>}
        <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div title={p.name} style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
        </Link>
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <div className="num" style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: p.flash_sale ? '#E5383B' : 'var(--ink)' }}>৳{Number(price).toLocaleString('en-BD')}</span>
            {discount && <span style={{ fontSize: 12.5, color: 'var(--tx-94a3b8, #94A3B8)', textDecoration: 'line-through' }}>৳{Number(original).toLocaleString('en-BD')}</span>}
          </div>
          <button onClick={handleAddToCart} disabled={!inStock} className="cart-btn">
            {!inStock ? 'Out of stock' : added ? '✓ Added' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
