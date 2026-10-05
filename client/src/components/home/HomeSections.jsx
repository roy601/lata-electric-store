import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Truck, Wallet, RotateCcw, Headphones, Package, ShoppingCart } from 'lucide-react';
import ProductRail, { RailCard } from '../ProductRail';
import { addToCart } from '../../store/cartStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const BLUE = '#1E88E5';

/* Pictures made for the shop's categories (client/public/categories/<id>.webp).
   A category without one shows its first product photo, or an icon. */
const CATEGORY_IMAGES = new Set([13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
export const categoryImage = (id) => (CATEGORY_IMAGES.has(Number(id)) ? `/categories/${id}.webp` : null);

/* ── Section title: big heading left, "More products →" right (no box) ── */
export function SectionTitle({ title, sub, to, onMore, moreLabel = 'More products', right }) {
  const { isMobile } = useBreakpoint();
  const more = (to || onMore) && (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
      {moreLabel} <ArrowRight size={16} />
    </span>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: isMobile ? 10 : 14 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 24, fontWeight: 800, color: '#0F172A', letterSpacing: -.3 }}>{title}</h2>
        {sub && <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>{sub}</div>}
      </div>
      {right}
      {more && (to
        ? <Link to={to} style={{ textDecoration: 'none' }}>{more}</Link>
        : <button onClick={onMore} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{more}</button>)}
    </div>
  );
}

/* Small round arrow for horizontal rows */
function RoundArrow({ dir, onClick, disabled }) {
  const Icon = dir < 0 ? ChevronLeft : ChevronRight;
  return (
    <button onClick={onClick} disabled={disabled} aria-label={dir < 0 ? 'Scroll left' : 'Scroll right'}
      style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #E2E8F0', background: '#fff', color: disabled ? '#CBD5E1' : '#0F172A',
        cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: disabled ? 'none' : '0 2px 8px rgba(15,23,42,.08)' }}>
      <Icon size={18} />
    </button>
  );
}

/* ═════════ Shop by Category — round pictures ═════════ */
export function CategoryCircles({ categories, counts = {}, previewImages = {} }) {
  const { isMobile } = useBreakpoint();
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = () => {
    const el = ref.current; if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    const el = ref.current; if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [categories.length]);
  const scroll = (d) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  if (!categories.length) return null;
  const size = isMobile ? 84 : 128;

  return (
    <section>
      <SectionTitle title="Shop by Category" right={!isMobile && (edges.left || edges.right) && (
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <RoundArrow dir={-1} onClick={() => scroll(-1)} disabled={!edges.left} />
          <RoundArrow dir={1} onClick={() => scroll(1)} disabled={!edges.right} />
        </div>
      )} />
      <div ref={ref} className="hide-scrollbar" style={{ display: 'flex', gap: isMobile ? 12 : 22, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x proximity', paddingBottom: 4 }}>
        {categories.map(c => {
          const pic = categoryImage(c.id);
          const fallback = previewImages[c.id];
          return (
            <Link key={c.id} to={`/products?cat=${c.id}`}
              style={{ flex: `0 0 ${size + 12}px`, textDecoration: 'none', textAlign: 'center', scrollSnapAlign: 'start' }}
              onMouseEnter={e => { const im = e.currentTarget.querySelector('[data-pic]'); if (im) im.style.transform = 'translateY(-4px) scale(1.04)'; }}
              onMouseLeave={e => { const im = e.currentTarget.querySelector('[data-pic]'); if (im) im.style.transform = 'none'; }}>
              <div data-pic style={{ width: size, height: size, margin: '0 auto', transition: 'transform .25s ease', position: 'relative' }}>
                {pic
                  ? <img src={pic} alt={c.name} width={size} height={size} loading="lazy" style={{ width: size, height: size, display: 'block' }} />
                  : (
                    <div style={{ width: size * .87, height: size * .87, margin: `${size * .13}px auto 0`, borderRadius: '50%', background: 'radial-gradient(circle at 50% 35%,#F2FBFF 0%,#D4F0FC 45%,#A9DEF7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {fallback
                        ? <img src={fallback} alt="" loading="lazy" style={{ width: '72%', height: '72%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
                        : <Package size={size * .38} color={BLUE} />}
                    </div>
                  )}
              </div>
              <div style={{ marginTop: 8, fontSize: isMobile ? 11.5 : 13, fontWeight: 600, color: '#1F2937', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(c.name).trim()}</div>
              {counts[c.id] > 0 && !isMobile && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{counts[c.id]} products</div>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ═════════ Trust strip under the banner ═════════ */
export function TrustStrip({ settings }) {
  const { isMobile } = useBreakpoint();
  const free = Number(settings?.free_delivery_threshold) || 0;
  const wa = String(settings?.whatsapp || '').replace(/\D/g, '');
  const items = [
    { Icon: Wallet,     title: 'Cash on Delivery',  sub: 'Pay when you receive',                 to: '/policies/delivery' },
    { Icon: Truck,      title: free ? `Free delivery over ৳${free.toLocaleString('en-BD')}` : 'Delivery all over Bangladesh', sub: 'Inside & outside Dhaka', to: '/policies/delivery' },
    { Icon: RotateCcw,  title: 'Easy returns',      sub: 'Wrong or faulty? We fix it',            to: '/policies/returns' },
    { Icon: Headphones, title: 'Need help?',        sub: wa ? 'Chat with us on WhatsApp' : 'Contact our team',
      href: wa ? `https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}` : null, to: '/contact' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', border: '1px solid #E8EDF2', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
      {items.map(({ Icon, title, sub, to, href }, i) => {
        const inner = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '12px 12px' : '16px 20px', height: '100%',
            borderLeft: !isMobile && i ? '1px solid #EEF2F6' : 'none', borderTop: isMobile && i > 1 ? '1px solid #EEF2F6' : 'none', boxSizing: 'border-box',
            ...(isMobile && i % 2 ? { borderLeft: '1px solid #EEF2F6' } : {}) }}>
            <span style={{ width: isMobile ? 34 : 42, height: isMobile ? 34 : 42, borderRadius: 12, background: '#EEF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={isMobile ? 17 : 20} color={BLUE} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: isMobile ? 12.5 : 14.5, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>{title}</span>
              <span style={{ display: 'block', fontSize: isMobile ? 11 : 12.5, color: '#64748B', marginTop: 2 }}>{sub}</span>
            </span>
          </div>
        );
        return href
          ? <a key={title} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>
          : <Link key={title} to={to} style={{ textDecoration: 'none' }}>{inner}</Link>;
      })}
    </div>
  );
}

/* ═════════ Hot Deals — wide cards for the biggest discounts ═════════ */
function DealCard({ product: p, width }) {
  const [ok, setOk] = useState(!!p.image);
  const [hover, setHover] = useState(false);
  const price = p.flash_sale && p.flash_price ? +p.flash_price : +p.price;
  const orig  = p.flash_sale && p.flash_price ? +p.price : +p.original_price;
  const disc  = orig > price ? Math.round((1 - price / orig) * 100) : 0;
  const inStock = p.stock > 0;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ flex: `0 0 ${width}px`, width, scrollSnapAlign: 'start', display: 'flex', gap: 16, background: '#fff', borderRadius: 16, padding: 14,
        border: `1px solid ${hover ? '#BFDBFE' : '#E8EDF2'}`, boxShadow: hover ? '0 12px 28px -12px rgba(15,23,42,.25)' : 'none', transition: 'all .2s' }}>
      <Link to={`/products/${p.id}`} style={{ flex: '0 0 42%', aspectRatio: '1/1', borderRadius: 12, background: '#F8FAFC', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, overflow: 'hidden' }}>
        {ok ? <img src={p.image} alt={p.name} loading="lazy" onError={() => setOk(false)} style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply', transform: hover ? 'scale(1.05)' : 'none', transition: 'transform .3s' }} />
            : <Package size={36} color="#CBD5E1" />}
        {disc > 0 && <span style={{ position: 'absolute', top: 8, left: 8, background: '#E5383B', color: '#fff', fontWeight: 800, fontSize: 12, padding: '4px 8px', borderRadius: 8 }}>-{disc}%</span>}
      </Link>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
        {p.brand && <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5 }}>{p.brand}</div>}
        <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: '#0F172A', fontSize: 15, fontWeight: 700, lineHeight: 1.35, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</Link>
        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 21, fontWeight: 800, color: '#0F172A' }}>৳{price.toLocaleString('en-BD')}</span>
            {disc > 0 && <span style={{ fontSize: 13, color: '#94A3B8', textDecoration: 'line-through' }}>৳{orig.toLocaleString('en-BD')}</span>}
          </div>
          {disc > 0 && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16A34A', marginTop: 2 }}>You save ৳{(orig - price).toLocaleString('en-BD')}</div>}
          <button onClick={() => addToCart(p, { price })} disabled={!inStock}
            style={{ marginTop: 10, width: '100%', padding: '10px 0', borderRadius: 10, border: `1.5px solid ${inStock ? '#0F172A' : '#E2E8F0'}`, background: inStock ? (hover ? '#0F172A' : '#fff') : '#F1F5F9',
              color: inStock ? (hover ? '#fff' : '#0F172A') : '#94A3B8', fontWeight: 800, fontSize: 13, letterSpacing: .3, cursor: inStock ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .15s' }}>
            {inStock ? <><ShoppingCart size={15} /> BUY NOW</> : 'OUT OF STOCK'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function HotDeals({ products }) {
  const { isMobile } = useBreakpoint();
  if (!products?.length) return null;
  return (
    <section>
      <SectionTitle title="Hot Deals" sub="Biggest savings right now" to="/products" />
      <div style={{ margin: isMobile ? '0 -8px' : '0 -18px' }}>
        <ProductRail products={products} cardWidth={isMobile ? 300 : 430} compact={isMobile}
          renderCard={(p, w) => <DealCard key={p.id} product={p} width={w} />} />
      </div>
    </section>
  );
}

/* ═════════ Recommended For You — tabs ═════════ */
export function RecommendedTabs({ tabs }) {
  const { isMobile, isTablet } = useBreakpoint();
  const available = tabs.filter(t => t.products?.length);
  const [active, setActive] = useState(null);
  const current = available.find(t => t.key === active) || available[0];
  if (!current) return null;
  const cols = isMobile ? 2 : isTablet ? 3 : 5;
  return (
    <section>
      <div style={{ textAlign: 'center', marginBottom: isMobile ? 12 : 18 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 24, fontWeight: 800, color: '#0F172A', letterSpacing: -.3 }}>Recommended For You</h2>
        <div role="tablist" style={{ display: 'inline-flex', gap: isMobile ? 4 : 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {available.map(t => {
            const on = t.key === current.key;
            return (
              <button key={t.key} role="tab" aria-selected={on} onClick={() => setActive(t.key)}
                style={{ padding: isMobile ? '7px 12px' : '8px 18px', borderRadius: 30, border: `1.5px solid ${on ? BLUE : '#E2E8F0'}`, background: on ? BLUE : '#fff',
                  color: on ? '#fff' : '#334155', fontWeight: 700, fontSize: isMobile ? 12.5 : 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: isMobile ? 8 : 14 }}>
        {current.products.slice(0, cols * 2).map(p => <RailCard key={p.id} product={p} />)}
      </div>
      {current.to && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link to={current.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 26px', borderRadius: 30, border: '1.5px solid #0F172A', color: '#0F172A', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            See all <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </section>
  );
}

/* ═════════ Top Brands ═════════ */
export function TopBrands({ brands }) {
  const { isMobile } = useBreakpoint();
  if (!brands?.length) return null;
  return (
    <section>
      <SectionTitle title="Top Brands" sub="Genuine products from trusted makers" />
      <div style={{ margin: isMobile ? '0 -8px' : '0 -18px' }}>
        <ProductRail products={brands.map(b => ({ ...b, id: b.name }))} cardWidth={isMobile ? 250 : 300} compact={isMobile} autoPlay={false}
          renderCard={(b, w) => (
            <Link key={b.name} to={`/products?q=${encodeURIComponent(b.name)}`}
              style={{ flex: `0 0 ${w}px`, width: w, scrollSnapAlign: 'start', textDecoration: 'none', background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, padding: 16, display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#1E88E5,#1565C0)', color: '#fff', fontWeight: 800, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {b.name[0].toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#64748B' }}>{b.count} product{b.count !== 1 ? 's' : ''}</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ aspectRatio: '1/1', borderRadius: 10, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                    {b.images[i] ? <img src={b.images[i]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                  </div>
                ))}
              </div>
            </Link>
          )} />
      </div>
    </section>
  );
}
