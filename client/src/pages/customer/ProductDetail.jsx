import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Heart, Package, Zap, Link as LinkIcon, Share2, MessageCircle, Star, Pencil, Filter } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductCard from '../../components/ProductCard';
import { useCartStore, useWishlistStore } from '../../store/cartStore';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const BLUE = '#1E88E5';

/* ── Star renderer ── */
function Stars({ value, size = 14, interactive = false, onHover, onClick }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size}
          fill={i <= value ? '#F59E0B' : 'none'}
          color={i <= value ? '#F59E0B' : '#D1D5DB'}
          style={{ cursor: interactive ? 'pointer' : 'default', transition: 'transform .1s' }}
          onMouseEnter={() => interactive && onHover?.(i)}
          onMouseLeave={() => interactive && onHover?.(0)}
          onClick={() => interactive && onClick?.(i)}
        />
      ))}
    </div>
  );
}

/* ── Reviews section ── */
function ReviewSection({ productId }) {
  const { user } = useCustomerAuth();
  const [activeTab,   setActiveTab]   = useState('reviews');
  const [reviews,     setReviews]     = useState([]);
  const [loadingRevs, setLoadingRevs] = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [rating,      setRating]      = useState(0);
  const [hover,       setHover]       = useState(0);
  const [title,       setTitle]       = useState('');
  const [comment,     setComment]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const loadReviews = async () => {
    setLoadingRevs(true);
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    setReviews(data || []);
    setLoadingRevs(false);
  };

  useEffect(() => { loadReviews(); }, [productId]);

  const total   = reviews.length;
  const avg     = total ? (reviews.reduce((s, r) => s + r.rating, 0) / total) : 0;
  const avgDisp = avg.toFixed(1);

  const starCounts = [5,4,3,2,1].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length,
    pct: total ? Math.round(reviews.filter(r => r.rating === s).length / total * 100) : 0,
  }));

  const filtered = reviews.filter(r => {
    if (filter === '5') return r.rating === 5;
    if (filter === '4') return r.rating === 4;
    if (filter === '3') return r.rating === 3;
    if (filter === 'media') return r.images?.length > 0;
    return true;
  });

  const submit = async () => {
    if (!rating)          { toast.error('Please select a star rating'); return; }
    if (!comment.trim())  { toast.error('Please write a comment'); return; }
    setSubmitting(true);
    const displayName = user.user_metadata?.full_name || user.user_metadata?.first_name || user.email.split('@')[0];
    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      user_id:    user.id,
      user_email: user.email,
      user_name:  displayName,
      rating,
      title:   title.trim() || null,
      comment: comment.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error('Failed to submit: ' + error.message); return; }
    toast.success('Review submitted! It will appear after approval.');
    setRating(0); setTitle(''); setComment('');
    setActiveTab('reviews');
    loadReviews();
  };

  const inp = { width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: '#FAFBFC' };

  return (
    <div style={{ background: '#F8F9FA', borderRadius: 14, border: '1px solid #ebebeb', marginBottom: 24, overflow: 'hidden' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0' }}>
        {[
          { key: 'reviews', label: 'Reviews',        Icon: MessageCircle },
          { key: 'write',   label: 'Write a Review', Icon: Pencil },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', border: `1.5px solid ${activeTab === key ? BLUE : '#e0e0e0'}`, borderRadius: 8, background: activeTab === key ? BLUE : '#fff', color: activeTab === key ? '#fff' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px' }}>

        {/* ── REVIEWS TAB ── */}
        {activeTab === 'reviews' && (
          <>
            {/* Rating summary */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px', marginBottom: 16, border: '1px solid #ebebeb', display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 52, fontWeight: 900, color: '#111827', lineHeight: 1 }}>{avgDisp}</div>
                <Stars value={Math.round(avg)} size={16} />
                <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 6 }}>{total} Review{total !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                {starCounts.map(({ star, count, pct }) => (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#555', width: 10 }}>{star}</span>
                    <Star size={12} fill="#F59E0B" color="#F59E0B" />
                    <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#F59E0B', borderRadius: 4, transition: 'width .4s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#9aa5b1', width: 32, textAlign: 'right' }}>{pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9aa5b1', fontWeight: 600 }}><Filter size={13} /> FILTER BY</span>
              {[
                { key: 'all',   label: 'All' },
                { key: '5',     label: '5 Star' },
                { key: '4',     label: '4 Star' },
                { key: '3',     label: '3 Star' },
                { key: 'media', label: 'With Media' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setFilter(key)}
                  style={{ padding: '5px 14px', border: `1.5px solid ${filter === key ? BLUE : '#e0e0e0'}`, borderRadius: 20, background: filter === key ? BLUE : '#fff', color: filter === key ? '#fff' : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Review list */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', overflow: 'hidden' }}>
              {loadingRevs ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9aa5b1' }}>Loading reviews…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>
                  {total === 0 ? 'No reviews yet. Be the first to review this product.' : 'No reviews match this filter.'}
                </div>
              ) : (
                filtered.map((r, i) => (
                  <div key={r.id} style={{ padding: '16px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{r.user_name}</div>
                        <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 2 }}>
                          {new Date(r.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                      <Stars value={r.rating} size={14} />
                    </div>
                    {r.title && <div style={{ fontWeight: 700, fontSize: 14, color: '#212529', marginBottom: 4 }}>{r.title}</div>}
                    <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}>{r.comment}</div>
                    {r.images?.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {r.images.map((img, ii) => (
                          <img key={ii} src={img} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e0e0e0' }} />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── WRITE A REVIEW TAB ── */}
        {activeTab === 'write' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', padding: '24px' }}>
            {!user ? (
              <div style={{ fontSize: 14, color: '#555' }}>
                Please <Link to="/login" style={{ color: BLUE, fontWeight: 700, textDecoration: 'none' }}>log in</Link> to write a review.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Your Rating <span style={{ color: BLUE }}>*</span></div>
                  <Stars value={hover || rating} size={32} interactive onHover={setHover} onClick={setRating} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Review Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Summarise your experience" style={inp}
                    onFocus={e => e.target.style.borderColor = BLUE} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Your Review <span style={{ color: BLUE }}>*</span></label>
                  <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="Tell others about your experience with this product…"
                    style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={e => e.target.style.borderColor = BLUE} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                </div>
                <button onClick={submit} disabled={submitting}
                  style={{ padding: '12px 32px', background: submitting ? '#ccc' : BLUE, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start', transition: 'background .15s' }}
                  onMouseEnter={e => !submitting && (e.currentTarget.style.background = '#1565C0')}
                  onMouseLeave={e => !submitting && (e.currentTarget.style.background = BLUE)}>
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const { isMobile } = useBreakpoint();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [qty,     setQty]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('specs');
  const [imgIdx,  setImgIdx]  = useState(0);
  const addToCart = useCartStore(s => s.add);
  const { toggle, has } = useWishlistStore();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: p } = await supabase.from('products').select('*, categories(id, name)').eq('id', id).single();
      setProduct(p);
      setTab(p?.specifications?.length ? 'specs' : 'description');
      if (p?.category_id) {
        const { data: rel } = await supabase.from('products').select('*').eq('category_id', p.category_id).neq('id', id).eq('is_active', true).limit(6);
        setRelated(rel || []);
      }
      setLoading(false);
    };
    load();
    setQty(1);
    setImgIdx(0);
  }, [id]);

  if (loading) return <CustomerLayout><div style={{ padding: 80, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div></CustomerLayout>;
  if (!product) return <CustomerLayout><div style={{ padding: 80, textAlign: 'center', color: '#9aa5b1' }}>Product not found.</div></CustomerLayout>;

  const price    = product.flash_sale && product.flash_price ? product.flash_price : product.price;
  const original = product.flash_sale && product.flash_price ? product.price : product.original_price;
  const discount = original ? Math.round((1 - price / original) * 100) : null;
  const wished   = has(product.id);

  // Parse specs — stored as [{key,value}] JSONB
  const specs = Array.isArray(product.specifications) ? product.specifications.filter(s => s.key && s.value) : [];

  // Images: main image + extra_images array
  const images = [product.image, ...(Array.isArray(product.extra_images) ? product.extra_images : [])].filter(Boolean);
  const currentImg = images[imgIdx] || null;

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addToCart({ id: product.id, name: product.name, price, image: product.image, stock: product.stock });
    toast.success('Added to cart', { duration: 1500 });
  };

  const hasTabs = specs.length > 0 || product.description;

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '14px 10px' : '24px 16px' }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: '#9aa5b1', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <Link to="/" style={{ color: '#9aa5b1' }}>Home</Link>
          {product.categories && <>
            <span>›</span>
            <Link to={`/category/${product.categories.id}`} style={{ color: '#9aa5b1' }}>{product.categories.name}</Link>
          </>}
          <span>›</span>
          <span style={{ color: '#212529', fontWeight: 500 }}>{product.name}</span>
        </div>

        {/* Main layout */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ebebeb', padding: isMobile ? '14px' : '28px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '420px 1fr', gap: isMobile ? 18 : 40, alignItems: 'start' }}>

            {/* ── Image column ── */}
            <div>
              {/* Main image */}
              <div style={{ background: '#F8F9FA', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1/1', marginBottom: 10, border: '1px solid #ebebeb' }}>
                {currentImg
                  ? <img src={currentImg} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }} />
                  : <Package size={80} color="#ccc" />}
              </div>
              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {images.map((img, i) => (
                    <div key={i} onClick={() => setImgIdx(i)}
                      style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 8, border: `2px solid ${imgIdx === i ? '#1E88E5' : '#e0e0e0'}`, overflow: 'hidden', background: '#F8F9FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info column ── */}
            <div>
              {/* Brand + category badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {product.brand && (
                  <span style={{ background: '#E3F2FD', color: '#1565C0', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: .5 }}>
                    {product.brand}
                  </span>
                )}
                {product.categories && (
                  <span style={{ background: '#F8F9FA', color: '#555', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #e0e0e0' }}>
                    {product.categories.name}
                  </span>
                )}
              </div>

              <h1 style={{ margin: '0 0 10px', fontSize: isMobile ? 20 : 26, fontWeight: 800, color: '#212529', lineHeight: 1.3 }}>{product.name}</h1>

              {product.sku && <div style={{ fontSize: 12, color: '#9aa5b1', marginBottom: 14 }}>SKU: {product.sku}</div>}

              {/* Flash deal banner */}
              {product.flash_sale && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(90deg,#1565C0,#1E88E5)', padding: '8px 14px', borderRadius: 8, marginBottom: 14 }}>
                  <span style={{ background: '#DC3545', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Zap size={10} fill="currentColor" /> FLASH DEAL</span>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Limited time offer!</span>
                </div>
              )}

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: isMobile ? 28 : 34, fontWeight: 800, color: product.flash_sale ? '#DC3545' : '#212529' }}>৳{price?.toLocaleString('en-BD')}</span>
                {original && <span style={{ fontSize: 18, color: '#bbb', textDecoration: 'line-through' }}>৳{original?.toLocaleString('en-BD')}</span>}
                {discount && <span style={{ background: '#d1e7dd', color: '#0f5132', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{discount}% OFF</span>}
              </div>

              {/* Stock */}
              <div style={{ marginBottom: 20 }}>
                {product.stock > 0
                  ? <span style={{ background: '#d1e7dd', color: '#0f5132', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>In Stock ({product.stock} available)</span>
                  : <span style={{ background: '#f8d7da', color: '#842029', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>Out of Stock</span>}
              </div>

              {/* Qty + Actions */}
              {product.stock > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Qty:</span>
                  <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
                    <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 38, border: 'none', background: '#F8F9FA', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>−</button>
                    <div style={{ width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>{qty}</div>
                    <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} style={{ width: 36, height: 38, border: 'none', background: '#F8F9FA', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>+</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button onClick={handleAdd} disabled={product.stock === 0}
                  style={{ flex: 1, padding: '13px', background: product.stock === 0 ? '#e0e0e0' : '#1E88E5', color: product.stock === 0 ? '#999' : '#fff', border: 'none', borderRadius: 10, cursor: product.stock === 0 ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <ShoppingCart size={16} /> Add to Cart
                </button>
                <button onClick={() => toggle(product.id)}
                  style={{ padding: '13px 18px', border: `2px solid ${wished ? '#DC3545' : '#e0e0e0'}`, background: wished ? '#fce4e4' : '#fff', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                  <Heart size={20} color={wished ? '#DC3545' : '#bbb'} fill={wished ? '#DC3545' : 'none'} />
                </button>
              </div>

              {/* Share */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
                <span style={{ fontSize: 12, color: '#9aa5b1', fontWeight: 600 }}>Share:</span>
                {[
                  { Icon: LinkIcon,       label: 'Copy',      action: () => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copied!'); } },
                  { Icon: Share2,         label: 'Facebook',  action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank') },
                  { Icon: MessageCircle,  label: 'WhatsApp',  action: () => window.open(`https://wa.me/?text=${encodeURIComponent(product.name + ' ' + window.location.href)}`, '_blank') },
                ].map(({ Icon, label, action }) => (
                  <button key={label} onClick={action} title={label}
                    style={{ width: 32, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, background: '#F8F9FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color="#555" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Specs / Description Tabs ── */}
        {hasTabs && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ebebeb', marginBottom: 24, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0' }}>
              {specs.length > 0 && (
                <button onClick={() => setTab('specs')}
                  style={{ padding: '13px 24px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: tab === 'specs' ? '#1E88E5' : '#555', borderBottom: tab === 'specs' ? '2px solid #1E88E5' : '2px solid transparent', marginBottom: -2, transition: 'color .15s' }}>
                  Specifications
                </button>
              )}
              {product.description && (
                <button onClick={() => setTab('description')}
                  style={{ padding: '13px 24px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: tab === 'description' ? '#1E88E5' : '#555', borderBottom: tab === 'description' ? '2px solid #1E88E5' : '2px solid transparent', marginBottom: -2, transition: 'color .15s' }}>
                  Description
                </button>
              )}
            </div>

            {/* Specs table */}
            {tab === 'specs' && specs.length > 0 && (
              <div style={{ padding: isMobile ? '10px 0' : '16px 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 13 : 14 }}>
                  <tbody>
                    {specs.map((s, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#F8F9FA' : '#fff' }}>
                        <td style={{ padding: isMobile ? '10px 16px' : '12px 24px', fontWeight: 600, color: '#212529', width: isMobile ? '42%' : '34%', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}>{s.key}</td>
                        <td style={{ padding: isMobile ? '10px 16px' : '12px 24px', color: '#444', borderBottom: '1px solid #f0f0f0', lineHeight: 1.6 }}>{s.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Description */}
            {tab === 'description' && product.description && (
              <div style={{ padding: isMobile ? '16px' : '24px 28px' }}>
                <div style={{ fontSize: 14, color: '#444', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{product.description}</div>
              </div>
            )}
          </div>
        )}

        {/* ── Reviews ── */}
        <ReviewSection productId={product.id} />

        {/* ── Related Products ── */}
        {related.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 10 }}>
              <div style={{ width: 3, height: 20, background: '#1E88E5', borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#212529' }}>Related Products</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: isMobile ? 8 : 16 }}>
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
