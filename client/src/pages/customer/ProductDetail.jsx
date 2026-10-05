import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Package, Zap, Link as LinkIcon, Share2, MessageCircle, Star, Minus, Plus, Check } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductRail from '../../components/ProductRail';
import { addToCart, useWishlistStore } from '../../store/cartStore';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { supabase } from '../../lib/supabase';
import { PROMISES } from '../../content/policies';
import toast from 'react-hot-toast';
import { useSeo, productJsonLd } from '../../lib/seo';

const BLUE = '#1E88E5';
const taka = (n) => `৳${Number(n).toLocaleString('en-BD')}`;
const muted = 'var(--tx-64748b, #64748B)';

/* The description is often pasted as lines: "Colour: Blue" lines become
   specification rows, the other lines become feature bullets. */
function splitDescription(text) {
  const features = [], specs = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/^[\s•\-*–]+/, '').trim();
    if (!line) continue;
    const m = line.match(/^([^:]{2,32}):\s*(.+)$/);
    if (m && !/https?$/i.test(m[1])) specs.push({ key: m[1].trim(), value: m[2].trim() });
    else features.push(line);
  }
  return { features, specs };
}

/* ── Stars ── */
function Stars({ value, size = 14, interactive = false, onHover, onClick }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size}
          fill={i <= value ? '#F59E0B' : 'none'}
          color={i <= value ? '#F59E0B' : '#CBD5E1'}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
          onMouseEnter={() => interactive && onHover?.(i)}
          onMouseLeave={() => interactive && onHover?.(0)}
          onClick={() => interactive && onClick?.(i)}
        />
      ))}
    </div>
  );
}

const sectionTitle = (isMobile) => ({ margin: '0 0 14px', fontSize: isMobile ? 19 : 22, fontWeight: 700, color: 'var(--ink)' });

/* ── Reviews ── */
function ReviewSection({ productId, onStats }) {
  const { user } = useCustomerAuth();
  const { isMobile } = useBreakpoint();
  const [reviews,     setReviews]     = useState([]);
  const [loadingRevs, setLoadingRevs] = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [writing,     setWriting]     = useState(false);
  const [rating,      setRating]      = useState(0);
  const [hover,       setHover]       = useState(0);
  const [title,       setTitle]       = useState('');
  const [comment,     setComment]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const loadReviews = async () => {
    setLoadingRevs(true);
    const { data } = await supabase.from('reviews').select('*')
      .eq('product_id', productId).eq('is_approved', true).order('created_at', { ascending: false });
    setReviews(data || []);
    setLoadingRevs(false);
  };
  useEffect(() => { loadReviews(); }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = reviews.length;
  const avg   = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  useEffect(() => { onStats?.({ total, avg }); }, [total, avg]); // eslint-disable-line react-hooks/exhaustive-deps

  const starCounts = [5, 4, 3, 2, 1].map(s => {
    const count = reviews.filter(r => r.rating === s).length;
    return { star: s, count, pct: total ? Math.round(count / total * 100) : 0 };
  });
  const filtered = reviews.filter(r => (filter === 'all' ? true : filter === 'media' ? r.images?.length > 0 : r.rating === +filter));

  const submit = async () => {
    if (!rating)         { toast.error('Choose a star rating'); return; }
    if (!comment.trim()) { toast.error('Write a few words about the product'); return; }
    setSubmitting(true);
    const displayName = user.user_metadata?.full_name || user.user_metadata?.first_name || user.email.split('@')[0];
    const { error } = await supabase.from('reviews').insert({
      product_id: productId, user_id: user.id, user_email: user.email, user_name: displayName,
      rating, title: title.trim() || null, comment: comment.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error('Could not send your review: ' + error.message); return; }
    toast.success('Thanks. Your review will appear after we check it.');
    setRating(0); setTitle(''); setComment(''); setWriting(false);
    loadReviews();
  };

  const inp = { width: '100%', padding: '10px 12px', border: '1px solid rgba(15,23,42,.18)', borderRadius: 'var(--r-sm)', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--bg-fff, #fff)', color: 'var(--ink)' };

  return (
    <section id="reviews" style={{ scrollMarginTop: 90 }}>
      <h2 style={sectionTitle(isMobile)}>Customer reviews</h2>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px minmax(0, 1fr)', gap: isMobile ? 18 : 40, alignItems: 'start' }}>

        {/* Summary */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stars value={Math.round(avg)} size={18} />
            <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{total ? `${avg.toFixed(1)} out of 5` : 'No ratings yet'}</span>
          </div>
          <div style={{ fontSize: 13.5, color: muted, margin: '4px 0 14px' }}>{total} review{total !== 1 ? 's' : ''}</div>
          {total > 0 && starCounts.map(({ star, pct }) => (
            <button key={star} onClick={() => setFilter(filter === String(star) ? 'all' : String(star))}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '3px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span className="num" style={{ fontSize: 13, color: filter === String(star) ? BLUE : 'var(--ink)', width: 44, textAlign: 'left' }}>{star} star</span>
              <span style={{ flex: 1, height: 8, background: 'var(--bg-f1f5f9, #F1F5F9)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: '#F59E0B' }} />
              </span>
              <span className="num" style={{ fontSize: 12.5, color: muted, width: 34, textAlign: 'right' }}>{pct}%</span>
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--hairline)', marginTop: 16, paddingTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Used this product?</div>
            <div style={{ fontSize: 13.5, color: muted, margin: '2px 0 12px' }}>Your review helps other buyers decide.</div>
            {user
              ? <button onClick={() => setWriting(w => !w)} className="cart-btn" style={{ width: 'auto', padding: '9px 20px' }}>{writing ? 'Close' : 'Write a review'}</button>
              : <Link to="/login" className="cart-btn" style={{ display: 'inline-block', width: 'auto', padding: '9px 20px', textDecoration: 'none' }}>Sign in to review</Link>}
          </div>
        </div>

        {/* Form + list */}
        <div style={{ minWidth: 0 }}>
          {writing && user && (
            <div style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', padding: isMobile ? 16 : 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Your rating</div>
                <Stars value={hover || rating} size={28} interactive onHover={setHover} onClick={setRating} />
              </div>
              <label style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Title <span style={{ fontWeight: 400, color: muted }}>(optional)</span>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Strong battery, works well" style={{ ...inp, marginTop: 6 }} />
              </label>
              <label style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Your review
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="How is the quality? Did it match the description?" style={{ ...inp, marginTop: 6, resize: 'vertical', lineHeight: 1.6 }} />
              </label>
              <button onClick={submit} disabled={submitting}
                style={{ alignSelf: 'flex-start', padding: '11px 26px', background: BLUE, color: '#fff', border: 'none', borderRadius: 'var(--pill)', fontWeight: 600, fontSize: 14, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: submitting ? .7 : 1 }}>
                {submitting ? 'Sending…' : 'Submit review'}
              </button>
            </div>
          )}

          {total > 0 && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 6, borderBottom: '1px solid var(--hairline)' }}>
              {[['all', 'All'], ['5', '5 star'], ['4', '4 star'], ['3', '3 star'], ['media', 'With photos']].map(([k, l]) => (
                <button key={k} className="u-tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
          )}

          {loadingRevs ? (
            [0, 1].map(i => <div key={i} style={{ padding: '16px 0', borderBottom: '1px solid var(--hairline)' }}><div className="skel" style={{ height: 14, width: 140, marginBottom: 10 }} /><div className="skel" style={{ height: 12, width: '80%' }} /></div>)
          ) : total === 0 ? (
            <div style={{ padding: isMobile ? '4px 0' : '6px 0', color: muted, fontSize: 14.5, lineHeight: 1.6, maxWidth: 520 }}>
              Nobody has reviewed this item yet. If you bought it from us, tell others how it works for you.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '18px 0', color: muted, fontSize: 14 }}>No reviews match this filter.</div>
          ) : filtered.map(r => (
            <article key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Stars value={r.rating} size={14} />
                {r.title && <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{r.title}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: muted, margin: '4px 0 8px' }}>
                {r.user_name} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <p style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.65, margin: 0 }}>{r.comment}</p>
              {r.images?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {r.images.map((img, ii) => <img key={ii} src={img} alt="Customer photo" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)' }} />)}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Photo gallery with zoom that follows the mouse ── */
function Gallery({ images, name, isMobile }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(null); // {x, y} in % while hovering
  useEffect(() => { setIdx(0); }, [images.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = images[idx];
  const thumbs = images.length > 1 && (
    <div className="hide-scrollbar" style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 8, overflow: 'auto', scrollbarWidth: 'none', maxHeight: isMobile ? undefined : 480 }}>
      {images.map((img, i) => (
        <button key={i} onClick={() => setIdx(i)} onMouseEnter={() => !isMobile && setIdx(i)} aria-label={`Photo ${i + 1}`}
          style={{ width: 62, height: 62, flexShrink: 0, padding: 4, borderRadius: 'var(--r-sm)', border: `1.5px solid ${idx === i ? 'var(--ink)' : 'var(--hairline)'}`, background: 'var(--bg-fff, #fff)', cursor: 'pointer' }}>
          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </button>
      ))}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: 10, position: isMobile ? 'static' : 'sticky', top: 90 }}>
      {thumbs}
      <div
        onMouseMove={e => { if (isMobile || !current) return; const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }); }}
        onMouseLeave={() => setZoom(null)}
        style={{ flex: 1, minWidth: 0, aspectRatio: '1 / 1', background: 'var(--bg-fff, #fff)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: current && !isMobile ? 'crosshair' : 'default' }}>
        {current
          ? <img src={current} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: isMobile ? 16 : 28, transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : 'center', transform: zoom ? 'scale(1.9)' : 'none', transition: zoom ? 'none' : 'transform .25s ease' }} />
          : <Package size={80} color="#CBD5E1" />}
      </div>
    </div>
  );
}

function PageSkeleton({ isMobile }) {
  return (
    <div style={{ maxWidth: 1260, margin: '0 auto', padding: isMobile ? '14px 10px' : '20px 14px' }}>
      <div className="skel" style={{ height: 12, width: 260, marginBottom: 18 }} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '5fr 4.2fr 3fr', gap: 28 }}>
        <div className="skel" style={{ aspectRatio: '1/1', borderRadius: 'var(--r-md)' }} />
        <div>{[70, 90, 40, 30, 60, 55].map((w, i) => <div key={i} className="skel" style={{ height: i === 1 ? 28 : 14, width: `${w}%`, marginBottom: 14 }} />)}</div>
        {!isMobile && <div className="skel" style={{ height: 360, borderRadius: 'var(--r-md)' }} />}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const [product,  setProduct]  = useState(null);
  const [related,  setRelated]  = useState([]);
  const [shop,     setShop]     = useState(null);
  const [qty,      setQty]      = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [revStats, setRevStats] = useState({ total: 0, avg: 0 });
  const [selectedVariants, setSelectedVariants] = useState({});
  const { toggle, has } = useWishlistStore();

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setShop(data || {}));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setProduct(null);
      const { data: p } = await supabase.from('products').select('*, categories(id, name)').eq('id', id).maybeSingle();
      if (!p || p.is_active === false) { setProduct(null); setRelated([]); setLoading(false); return; }
      setProduct(p);
      setLoading(false);
      if (p.category_id) {
        const { data: rel } = await supabase.from('products').select('*').eq('category_id', p.category_id).neq('id', id).eq('is_active', true).limit(14);
        setRelated(rel || []);
      } else setRelated([]);
    };
    load();
    setQty(1);
    setSelectedVariants({});
    window.scrollTo(0, 0);
  }, [id]);

  const seoPrice = product ? (product.flash_sale && product.flash_price ? product.flash_price : product.price) : null;
  useSeo(product ? {
    title: `${product.name}${product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? ` — ${product.brand}` : ''}`,
    description: `${product.name} — ৳${Number(seoPrice).toLocaleString('en-BD')}${product.stock > 0 ? ', in stock' : ''}. ${product.description || 'Genuine product from Lata Electric, Dhaka.'} Cash on delivery across Bangladesh.`,
    image: product.image || undefined,
    path: `/products/${product.id}`,
    type: 'product',
    jsonLd: productJsonLd(product, product.categories?.name),
  } : { title: loading ? undefined : 'Product not found', noindex: !loading });

  if (loading) return <CustomerLayout><PageSkeleton isMobile={isMobile} /></CustomerLayout>;
  if (!product) return (
    <CustomerLayout>
      <div style={{ maxWidth: 1260, margin: '0 auto', padding: '56px 14px' }}>
        <h1 style={{ fontSize: 26, margin: '0 0 8px', color: 'var(--ink)' }}>This product isn't available</h1>
        <p style={{ color: muted, margin: '0 0 20px' }}>It may have been removed or the link is wrong.</p>
        <Link to="/products" style={{ padding: '11px 24px', background: BLUE, color: '#fff', borderRadius: 'var(--pill)', fontWeight: 600, textDecoration: 'none' }}>Browse products</Link>
      </div>
    </CustomerLayout>
  );

  const basePrice = product.flash_sale && product.flash_price ? product.flash_price : product.price;
  const original  = product.flash_sale && product.flash_price ? product.price : product.original_price;

  // A selected option with its own price overrides the base price
  const variantPrice = (() => {
    for (const v of (Array.isArray(product.variants) ? product.variants : [])) {
      if (!v.enabled) continue;
      const sel = selectedVariants[v.key];
      const opt = sel && (v.options || []).find(o => o.value === sel);
      if (opt?.price != null) return opt.price;
    }
    return null;
  })();

  const price    = variantPrice ?? basePrice;
  const discount = original && original > price ? Math.round((1 - price / original) * 100) : null;
  const wished   = has(product.id);
  const inStock  = product.stock > 0;

  const { features, specs: descSpecs } = splitDescription(product.description);
  const ownSpecs = Array.isArray(product.specifications) ? product.specifications.filter(s => s.key && s.value) : [];
  const seen = new Set(ownSpecs.map(s => s.key.toLowerCase()));
  const specs = [
    ...(product.brand ? [{ key: 'Brand', value: product.brand }] : []),
    ...ownSpecs, ...descSpecs.filter(s => !seen.has(s.key.toLowerCase()) && s.key.toLowerCase() !== 'brand'),
    ...(product.sku ? [{ key: 'Model / SKU', value: product.sku }] : []),
  ];
  const highlights = features.slice(0, 5);

  const images = [product.image, ...(Array.isArray(product.extra_images) ? product.extra_images : [])].filter(Boolean);

  const variantGroups = (Array.isArray(product.variants) ? product.variants : []).filter(v => v?.enabled && v.options?.length);
  const missingVariant = variantGroups.find(v => !selectedVariants[v.key]);
  const variantLabel = variantGroups.map(v => `${v.label || v.key}: ${selectedVariants[v.key]}`).join(', ');

  const handleAdd = (thenCheckout = false) => {
    if (missingVariant) { toast.error(`Choose ${String(missingVariant.label || missingVariant.key).toLowerCase()} first`); return; }
    addToCart(product, { price, qty, variant: variantLabel });
    if (thenCheckout) navigate('/checkout');
  };

  // Delivery facts from Admin → Shipping (with the shop's usual values as fallback)
  const inside  = shop?.shipping_inside ?? 60;
  const outside = shop?.shipping_outside ?? 120;
  const freeOver = Number(shop?.free_delivery_threshold) || 0;
  const wa = String(shop?.whatsapp || '').replace(/\D/g, '');
  const waLink = wa && `https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}?text=${encodeURIComponent(`Hi, I have a question about: ${product.name} (${window.location.href})`)}`;

  const wide = !isMobile && !isTablet;
  const share = [
    { Icon: LinkIcon,      label: 'Copy link', action: () => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copied'); } },
    { Icon: Share2,        label: 'Facebook',  action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank') },
    { Icon: MessageCircle, label: 'WhatsApp',  action: () => window.open(`https://wa.me/?text=${encodeURIComponent(product.name + ' ' + window.location.href)}`, '_blank') },
  ];

  const row = { display: 'flex', gap: 10, padding: '11px 0', borderTop: '1px solid var(--hairline)', fontSize: 13.5, lineHeight: 1.45 };

  return (
    <CustomerLayout>
      <div style={{ background: 'var(--bg-fff, #fff)' }}>
        <div style={{ maxWidth: 1260, margin: '0 auto', padding: isMobile ? '12px 10px 32px' : '18px 14px 56px' }}>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: muted, marginBottom: isMobile ? 12 : 18, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Link to="/" className="more-link" style={{ color: muted }}>Home</Link>
            {product.categories && <><span aria-hidden>/</span><Link to={`/products?cat=${product.categories.id}`} className="more-link" style={{ color: muted }}>{product.categories.name}</Link></>}
            <span aria-hidden>/</span>
            <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '60vw' : 420 }}>{product.name}</span>
          </nav>

          {/* ═══ Top: photos · details · buy box ═══ */}
          <div style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0, 5fr) minmax(0, 4.2fr) minmax(0, 3fr)' : isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: isMobile ? 18 : 32, alignItems: 'start' }}>

            <Gallery images={images} name={product.name} isMobile={isMobile} />

            {/* Details */}
            <div style={{ minWidth: 0 }}>
              {product.brand && (
                <Link to={`/products?q=${encodeURIComponent(product.brand)}`} className="more-link" style={{ fontSize: 13.5, fontWeight: 600, color: BLUE }}>
                  Visit the {product.brand} range
                </Link>
              )}
              <h1 style={{ margin: '6px 0 8px', fontSize: isMobile ? 21 : 27, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>{product.name}</h1>

              <a href="#reviews" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 13.5, color: muted }}>
                <Stars value={Math.round(revStats.avg)} size={15} />
                <span className="more-link" style={{ color: muted }}>{revStats.total ? `${revStats.avg.toFixed(1)} · ${revStats.total} review${revStats.total !== 1 ? 's' : ''}` : 'No reviews yet'}</span>
              </a>

              {/* Price */}
              <div style={{ borderTop: '1px solid var(--hairline)', marginTop: 14, paddingTop: 14 }}>
                {product.flash_sale && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFB020', color: '#3B2300', fontSize: 12.5, fontWeight: 700, padding: '3px 8px', marginBottom: 8 }}>
                    <Zap size={12} fill="currentColor" /> Flash sale price
                  </span>
                )}
                <div className="num" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  {discount && <span style={{ fontSize: isMobile ? 20 : 22, fontWeight: 600, color: '#E5383B' }}>−{discount}%</span>}
                  <span style={{ fontSize: isMobile ? 30 : 34, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{taka(price)}</span>
                </div>
                {discount && (
                  <div className="num" style={{ fontSize: 13.5, color: muted, marginTop: 2 }}>
                    MRP <span style={{ textDecoration: 'line-through' }}>{taka(original)}</span>
                    <span style={{ color: '#15803D', fontWeight: 600 }}> · You save {taka(original - price)}</span>
                  </div>
                )}
              </div>

              {/* Options */}
              {variantGroups.map(v => (
                <div key={v.key} style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{v.label || v.key}:</span> <span style={{ color: muted }}>{selectedVariants[v.key] || 'choose one'}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {v.options.map(opt => {
                      const on = selectedVariants[v.key] === opt.value;
                      return (
                        <button key={opt.value} onClick={() => setSelectedVariants(s => ({ ...s, [v.key]: on ? '' : opt.value }))} aria-pressed={on}
                          style={{ padding: '8px 14px', borderRadius: 'var(--r-sm)', border: `1.5px solid ${on ? 'var(--ink)' : 'rgba(15,23,42,.18)'}`, background: on ? 'var(--bg-f8fafc, #F8FAFC)' : 'var(--bg-fff, #fff)', color: 'var(--ink)', fontSize: 13.5, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {opt.value}{opt.price != null ? <span className="num" style={{ color: muted }}> · {taka(opt.price)}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Highlights from the description */}
              {highlights.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>About this item</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {highlights.map((f, i) => <li key={i} style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.5 }}>{f}</li>)}
                  </ul>
                  {(features.length > highlights.length || specs.length > 0) && (
                    <a href="#details" className="more-link" style={{ display: 'inline-block', marginTop: 10, fontSize: 13.5, fontWeight: 600, color: BLUE }}>See full details</a>
                  )}
                </div>
              )}
            </div>

            {/* Buy box */}
            <aside style={{ gridColumn: !wide && !isMobile ? '1 / -1' : 'auto', border: '1px solid rgba(15,23,42,.14)', borderRadius: 'var(--r-md)', padding: isMobile ? 16 : 18, position: wide ? 'sticky' : 'static', top: 90 }}>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{taka(price)}</div>
              <div style={{ fontSize: 14, fontWeight: 600, margin: '6px 0 14px', color: inStock ? '#15803D' : '#B42318' }}>
                {!inStock ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left — order soon` : 'In stock'}
              </div>

              {inStock && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 13.5, color: muted }}>Quantity</span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(15,23,42,.18)', borderRadius: 'var(--pill)' }}>
                    <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Less" disabled={qty <= 1}
                      style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: qty <= 1 ? 'default' : 'pointer', color: qty <= 1 ? '#CBD5E1' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={15} /></button>
                    <span className="num" style={{ minWidth: 26, textAlign: 'center', fontWeight: 600, fontSize: 15 }}>{qty}</span>
                    <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} aria-label="More" disabled={qty >= product.stock}
                      style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: qty >= product.stock ? 'default' : 'pointer', color: qty >= product.stock ? '#CBD5E1' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={15} /></button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => handleAdd(false)} disabled={!inStock}
                  style={{ padding: '12px', background: inStock ? BLUE : 'var(--bg-f1f5f9, #F1F5F9)', color: inStock ? '#fff' : '#94A3B8', border: 'none', borderRadius: 'var(--pill)', cursor: inStock ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 600, fontFamily: 'inherit' }}>
                  Add to cart
                </button>
                {inStock && (
                  <button onClick={() => handleAdd(true)}
                    style={{ padding: '12px', background: 'var(--ink)', color: 'var(--bg-fff, #fff)', border: 'none', borderRadius: 'var(--pill)', cursor: 'pointer', fontSize: 15, fontWeight: 600, fontFamily: 'inherit' }}>
                    Buy now
                  </button>
                )}
                <button onClick={() => toggle(product.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: 'inherit' }}>
                  <Heart size={16} color={wished ? '#E5383B' : 'currentColor'} fill={wished ? '#E5383B' : 'none'} /> {wished ? 'Saved to wishlist' : 'Save to wishlist'}
                </button>
              </div>

              {/* Delivery & trust facts */}
              <div style={{ marginTop: 10 }}>
                <div style={row}>
                  <span style={{ flex: 1, color: muted }}>Inside Dhaka</span>
                  <span className="num" style={{ textAlign: 'right', color: 'var(--ink)' }}><b>{taka(inside)}</b><br /><span style={{ color: muted, fontSize: 12.5 }}>{shop?.delivery_time_inside || PROMISES.deliveryDhakaDays}</span></span>
                </div>
                <div style={row}>
                  <span style={{ flex: 1, color: muted }}>Outside Dhaka</span>
                  <span className="num" style={{ textAlign: 'right', color: 'var(--ink)' }}><b>{taka(outside)}</b><br /><span style={{ color: muted, fontSize: 12.5 }}>{shop?.delivery_time_outside || PROMISES.deliveryOutsideDays}</span></span>
                </div>
                {freeOver > 0 && (
                  <div style={{ ...row, color: 'var(--ink)' }}>
                    {price * qty >= freeOver
                      ? <><Check size={16} color="#15803D" style={{ flexShrink: 0, marginTop: 1 }} /> This order gets free delivery</>
                      : <>Free delivery on orders over <b className="num">{taka(freeOver)}</b></>}
                  </div>
                )}
                <div style={{ ...row, color: 'var(--ink)' }}><Check size={16} color="#15803D" style={{ flexShrink: 0, marginTop: 1 }} /> Cash on delivery — pay when it arrives</div>
                <div style={{ ...row, color: 'var(--ink)' }}>
                  <Check size={16} color="#15803D" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{PROMISES.returnWindowDays}-day returns. <Link to="/policies/returns" className="more-link" style={{ color: BLUE }}>How returns work</Link></span>
                </div>
                <div style={{ ...row, flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: muted }}>Sold and delivered by</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Lata Electric, Dhaka</span>
                  {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className="more-link" style={{ color: BLUE, fontWeight: 600, marginTop: 4 }}>Ask a question on WhatsApp</a>}
                </div>
                <div style={{ ...row, alignItems: 'center' }}>
                  <span style={{ color: muted, flex: 1 }}>Share</span>
                  {share.map(({ Icon, label, action }) => (
                    <button key={label} onClick={action} title={label} aria-label={label}
                      style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          {/* ═══ Details: description + specifications side by side ═══ */}
          {(features.length > 0 || specs.length > 0) && (
            <section id="details" style={{ marginTop: isMobile ? 32 : 52, paddingTop: isMobile ? 24 : 36, borderTop: '1px solid var(--hairline)', scrollMarginTop: 90 }}>
              <div style={{ display: 'grid', gridTemplateColumns: wide && features.length && specs.length ? 'minmax(0, 1.1fr) minmax(0, 1fr)' : '1fr', gap: isMobile ? 28 : 56, alignItems: 'start' }}>
                {features.length > 0 && (
                  <div>
                    <h2 style={sectionTitle(isMobile)}>Product description</h2>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
                      {features.map((f, i) => <li key={i} style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6 }}>{f}</li>)}
                    </ul>
                  </div>
                )}
                {specs.length > 0 && (
                  <div>
                    <h2 style={sectionTitle(isMobile)}>Specifications</h2>
                    <dl style={{ margin: 0, borderTop: '1px solid var(--hairline)' }}>
                      {specs.map((s, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '42% 1fr' : '38% 1fr', gap: 16, padding: '11px 0', borderBottom: '1px solid var(--hairline)', fontSize: 14.5 }}>
                          <dt style={{ color: muted }}>{s.key}</dt>
                          <dd style={{ margin: 0, color: 'var(--ink)', lineHeight: 1.5 }}>{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ═══ Reviews ═══ */}
          <div style={{ marginTop: isMobile ? 32 : 52, paddingTop: isMobile ? 24 : 36, borderTop: '1px solid var(--hairline)' }}>
            <ReviewSection productId={product.id} onStats={setRevStats} />
          </div>

          {/* ═══ Related ═══ */}
          {related.length > 0 && (
            <section style={{ marginTop: isMobile ? 32 : 52, paddingTop: isMobile ? 24 : 36, borderTop: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={sectionTitle(isMobile)}>More in {product.categories?.name || 'this category'}</h2>
                {product.categories && <Link to={`/products?cat=${product.categories.id}`} className="more-link" style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, whiteSpace: 'nowrap' }}>See all</Link>}
              </div>
              <div style={{ margin: isMobile ? '0 -10px' : '0 -18px' }}>
                <ProductRail products={related} cardWidth={isMobile ? 160 : 200} compact={isMobile} autoPlay={false} />
              </div>
            </section>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
