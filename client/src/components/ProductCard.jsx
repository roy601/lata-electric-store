import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Package, Zap } from 'lucide-react';
import { addToCart, useWishlistStore } from '../store/cartStore';

export default function ProductCard({ product: p }) {
  const { toggle, has } = useWishlistStore();
  const wished = has(p.id);
  const [imgOk, setImgOk] = useState(!!p.image);  // broken picture → tidy placeholder, not alt text

  const price    = p.flash_sale && p.flash_price ? p.flash_price : p.price;
  const original = p.flash_sale && p.flash_price ? p.price : p.original_price;
  const discount = original && original > price ? Math.round((1 - price / original) * 100) : null;

  const handleAddToCart = (e) => {
    e.preventDefault();
    addToCart(p, { price });
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s, transform 0.2s', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Badges */}
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 1 }}>
        {p.flash_sale && (
          <span style={{ background: '#DC3545', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Zap size={9} fill="currentColor" /> Flash
          </span>
        )}
        {discount && !p.flash_sale && <span style={{ background: '#28A745', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{discount}% OFF</span>}
        {!(p.stock > 0) && <span style={{ background: '#555', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>Out of Stock</span>}
      </div>

      {/* Wishlist */}
      <button onClick={e => { e.preventDefault(); toggle(p.id); }}
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, background: '#fff', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>
        <Heart size={15} color={wished ? '#DC3545' : '#bbb'} fill={wished ? '#DC3545' : 'none'} />
      </button>

      {/* Image */}
      <Link to={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
        <div style={{ aspectRatio: '1/1', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, boxSizing: 'border-box' }}>
          {imgOk
            ? <img src={p.image} alt={p.name} loading="lazy" onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.3s' }} />
            : <Package size={48} color="#ccc" />
          }
        </div>
      </Link>

      {/* Info */}
      <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#212529', lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
        </Link>
        {p.brand && <div style={{ fontSize: 11, color: '#9aa5b1', marginBottom: 6 }}>{p.brand}</div>}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: p.flash_sale ? '#DC3545' : '#212529' }}>৳{price}</span>
            {discount && <span style={{ fontSize: 12, color: '#9aa5b1', textDecoration: 'line-through' }}>৳{original}</span>}
          </div>
          <button onClick={handleAddToCart} disabled={!(p.stock > 0)}
            style={{ width: '100%', padding: '8px', background: !(p.stock > 0) ? '#e0e0e0' : '#1E88E5', color: !(p.stock > 0) ? '#999' : '#fff', border: 'none', borderRadius: 8, cursor: !(p.stock > 0) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {!(p.stock > 0) ? 'Out of Stock' : <><ShoppingCart size={14} /> Add to Cart</>}
          </button>
        </div>
      </div>
    </div>
  );
}
