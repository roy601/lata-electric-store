import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Package } from 'lucide-react';
import ProductRail, { RailCard } from '../ProductRail';
import { cardStyle, cornerTag, discountTag } from '../ProductCard';
import { addToCart } from '../../store/cartStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const BLUE = '#1E88E5';

/* Pictures made for the shop's categories (client/public/categories/<id>.webp).
   A category without one shows its first product photo, or an icon. */
const CATEGORY_IMAGES = new Set([13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
export const categoryImage = (id) => (CATEGORY_IMAGES.has(Number(id)) ? `/categories/${id}.webp` : null);

/* ── Section title: heading left, "See all" right ── */
export function SectionTitle({ title, sub, to, onMore, moreLabel = 'See all', right }) {
  const { isMobile } = useBreakpoint();
  const more = (to || onMore) && (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {moreLabel} <ArrowRight size={15} />
    </span>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: isMobile ? 10 : 16 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 23, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{title}</h2>
        {sub && <div style={{ fontSize: 13.5, color: 'var(--tx-64748b, #64748B)', marginTop: 4 }}>{sub}</div>}
      </div>
      {right}
      {more && (to
        ? <Link to={to} className="more-link">{more}</Link>
        : <button onClick={onMore} className="more-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{more}</button>)}
    </div>
  );
}

/* Small arrow for horizontal rows */
function RowArrow({ dir, onClick, disabled }) {
  const Icon = dir < 0 ? ChevronLeft : ChevronRight;
  return (
    <button onClick={onClick} disabled={disabled} aria-label={dir < 0 ? 'Scroll left' : 'Scroll right'}
      style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'transparent', color: disabled ? 'var(--tx-cbd5e1, #CBD5E1)' : 'var(--ink)',
        cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      <SectionTitle title="Shop by category" right={!isMobile && (edges.left || edges.right) && (
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <RowArrow dir={-1} onClick={() => scroll(-1)} disabled={!edges.left} />
          <RowArrow dir={1} onClick={() => scroll(1)} disabled={!edges.right} />
        </div>
      )} />
      <div ref={ref} className="hide-scrollbar" style={{ display: 'flex', gap: isMobile ? 12 : 22, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x proximity', paddingBottom: 4 }}>
        {categories.map(c => {
          const pic = categoryImage(c.id);
          const fallback = previewImages[c.id];
          return (
            <Link key={c.id} to={`/products?cat=${c.id}`}
              style={{ flex: `0 0 ${size + 12}px`, textDecoration: 'none', textAlign: 'center', scrollSnapAlign: 'start' }}
              onMouseEnter={e => { const im = e.currentTarget.querySelector('[data-pic]'); if (im) im.style.transform = 'scale(1.05)'; }}
              onMouseLeave={e => { const im = e.currentTarget.querySelector('[data-pic]'); if (im) im.style.transform = 'none'; }}>
              <div data-pic style={{ width: size, height: size, margin: '0 auto', transition: 'transform .3s ease', position: 'relative' }}>
                {pic
                  ? <img src={pic} alt={c.name} width={size} height={size} loading="lazy" style={{ width: size, height: size, display: 'block' }} />
                  : (
                    <div style={{ width: size * .87, height: size * .87, margin: `${size * .13}px auto 0`, borderRadius: '50%', background: 'radial-gradient(circle at 50% 35%,var(--bg-f2fbff, #F2FBFF) 0%,#D4F0FC 45%,#A9DEF7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {fallback
                        ? <img src={fallback} alt="" loading="lazy" style={{ width: '72%', height: '72%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
                        : <Package size={size * .38} color={BLUE} />}
                    </div>
                  )}
              </div>
              <div style={{ marginTop: 8, fontSize: isMobile ? 12 : 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(c.name).trim()}</div>
              {counts[c.id] > 0 && !isMobile && <div style={{ fontSize: 12.5, color: 'var(--tx-64748b, #64748B)', marginTop: 2 }}>{counts[c.id]} products</div>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ═════════ Trust strip under the banner — plain text, no icon badges ═════════ */
export function TrustStrip({ settings }) {
  const { isMobile } = useBreakpoint();
  const free = Number(settings?.free_delivery_threshold) || 0;
  const wa = String(settings?.whatsapp || '').replace(/\D/g, '');
  const items = [
    { title: 'Cash on delivery',  sub: 'Pay when the parcel arrives',  to: '/policies/delivery' },
    { title: free ? `Free delivery over ৳${free.toLocaleString('en-BD')}` : 'Delivery all over Bangladesh', sub: 'Inside and outside Dhaka', to: '/policies/delivery' },
    { title: 'Easy returns',      sub: 'Wrong or faulty item? We replace it', to: '/policies/returns' },
    { title: 'Ask before you buy', sub: wa ? 'Message us on WhatsApp' : 'Call or message our team',
      href: wa ? `https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}` : null, to: '/contact' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
      {items.map(({ title, sub, to, href }, i) => {
        const inner = (
          <div style={{ padding: isMobile ? '12px 10px' : '16px 20px', height: '100%', boxSizing: 'border-box',
            borderLeft: (isMobile ? i % 2 : i) ? '1px solid var(--hairline)' : 'none', borderTop: isMobile && i > 1 ? '1px solid var(--hairline)' : 'none' }}>
            <span style={{ display: 'block', fontSize: isMobile ? 13 : 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>{title}</span>
            <span style={{ display: 'block', fontSize: isMobile ? 12 : 13, color: 'var(--tx-64748b, #64748B)', marginTop: 3 }}>{sub}</span>
          </div>
        );
        return href
          ? <a key={title} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>
          : <Link key={title} to={to} style={{ textDecoration: 'none' }}>{inner}</Link>;
      })}
    </div>
  );
}

/* ═════════ Hot Deals — one big deal beside smaller ones ═════════ */
const dealPrices = (p) => {
  const price = p.flash_sale && p.flash_price ? +p.flash_price : +p.price;
  const orig  = p.flash_sale && p.flash_price ? +p.price : +p.original_price;
  return { price, orig, disc: orig > price ? Math.round((1 - price / orig) * 100) : 0 };
};

function DealCard({ product: p, width, big = false }) {
  const [ok, setOk] = useState(!!p.image);
  const [hover, setHover] = useState(false);
  const { price, orig, disc } = dealPrices(p);
  const inStock = p.stock > 0;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...cardStyle(hover), ...(width ? { flex: `0 0 ${width}px`, width, scrollSnapAlign: 'start' } : { minWidth: 0 }),
        flexDirection: big ? 'column' : 'row', gap: big ? 0 : 14, padding: big ? 0 : 12, height: '100%', boxSizing: 'border-box' }}>
      <Link to={`/products/${p.id}`} style={{ flex: big ? '1 1 auto' : '0 0 40%', aspectRatio: big ? undefined : '1/1', minHeight: big ? 260 : undefined, background: 'var(--bg-fff, #fff)', position: big ? 'relative' : 'static', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: big ? 28 : 6, overflow: 'hidden' }}>
        {ok ? <img src={p.image} alt={p.name} loading="lazy" onError={() => setOk(false)} style={{ width: '100%', height: '100%', maxHeight: big ? 340 : undefined, objectFit: 'contain', transform: hover ? 'scale(1.05)' : 'none', transition: 'transform .4s ease' }} />
            : <Package size={36} color="#CBD5E1" />}
      </Link>
      {disc > 0 && <div style={cornerTag}><span style={{ ...discountTag, fontSize: big ? 15 : 12, padding: big ? '7px 12px' : discountTag.padding }}>−{disc}%</span></div>}
      <div style={{ flex: big ? '0 0 auto' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: big ? '0 20px 20px' : '2px 0 0' }}>
        {p.brand && <div style={{ fontSize: 12.5, color: 'var(--tx-64748b, #64748B)' }}>{p.brand}</div>}
        <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'var(--ink)', fontSize: big ? 19 : 14.5, fontWeight: big ? 700 : 600, lineHeight: 1.3, marginTop: 2, display: '-webkit-box', WebkitLineClamp: big ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</Link>
        <div style={{ marginTop: 'auto', paddingTop: 10, display: big ? 'flex' : 'block', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="num" style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: big ? 28 : 19, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>৳{price.toLocaleString('en-BD')}</span>
              {disc > 0 && <span style={{ fontSize: big ? 15 : 12.5, color: 'var(--tx-94a3b8, #94A3B8)', textDecoration: 'line-through' }}>৳{orig.toLocaleString('en-BD')}</span>}
            </div>
            {disc > 0 && <div className="num" style={{ fontSize: 13, fontWeight: 600, color: '#15803D', marginTop: 2 }}>You save ৳{(orig - price).toLocaleString('en-BD')}</div>}
          </div>
          <button className="cart-btn" onClick={() => addToCart(p, { price })} disabled={!inStock}
            style={big ? { width: 'auto', padding: '11px 26px', fontSize: 14, background: inStock ? '#1E88E5' : undefined, color: inStock ? '#fff' : undefined, borderColor: inStock ? '#1E88E5' : undefined } : { marginTop: 10 }}>
            {inStock ? 'Add to cart' : 'Out of stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function HotDeals({ products }) {
  const { isMobile, isTablet } = useBreakpoint();
  if (!products?.length) return null;
  const title = <SectionTitle title="Hot deals" sub="The biggest price cuts in the shop right now" to="/products" />;

  // Phones and tablets: a swipeable row
  if (isMobile || isTablet || products.length < 3) {
    return (
      <section>
        {title}
        <div style={{ margin: isMobile ? '0 -8px' : '0 -18px' }}>
          <ProductRail products={products} cardWidth={isMobile ? 300 : 400} compact={isMobile}
            renderCard={(p, w) => <DealCard key={p.id} product={p} width={w} />} />
        </div>
      </section>
    );
  }

  // Desktop: the best deal large on the left, the next four in a grid
  const [first, ...rest] = products;
  return (
    <section>
      {title}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.4fr)', gap: 14 }}>
        <DealCard product={first} big />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          {rest.slice(0, 4).map(p => <DealCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}

/* ═════════ Recommended — underline tabs ═════════ */
export function RecommendedTabs({ tabs }) {
  const { isMobile, isTablet } = useBreakpoint();
  const available = tabs.filter(t => t.products?.length);
  const [active, setActive] = useState(null);
  const current = available.find(t => t.key === active) || available[0];
  if (!current) return null;
  const cols = isMobile ? 2 : isTablet ? 3 : 5;
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 6 : 28, flexWrap: 'wrap', marginBottom: isMobile ? 12 : 16, borderBottom: '1px solid var(--hairline)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: isMobile ? 19 : 23, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, width: isMobile ? '100%' : 'auto' }}>Picked for you</h2>
        <div role="tablist" className="hide-scrollbar" style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: -1 }}>
          {available.map(t => (
            <button key={t.key} role="tab" aria-selected={t.key === current.key} className="u-tab" onClick={() => setActive(t.key)}>{t.label}</button>
          ))}
        </div>
        {current.to && !isMobile && (
          <Link to={current.to} className="more-link" style={{ marginLeft: 'auto', marginBottom: 10, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            See all <ArrowRight size={15} />
          </Link>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: isMobile ? 8 : 14 }}>
        {current.products.slice(0, cols * 2).map(p => <RailCard key={p.id} product={p} />)}
      </div>
      {current.to && isMobile && (
        <Link to={current.to} className="more-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 14, fontSize: 14, fontWeight: 600 }}>
          See all <ArrowRight size={15} />
        </Link>
      )}
    </section>
  );
}

/* ═════════ Top Brands — wordmarks, no letter badges ═════════ */
export function TopBrands({ brands }) {
  const { isMobile } = useBreakpoint();
  if (!brands?.length) return null;
  return (
    <section>
      <SectionTitle title="Brands we stock" sub="Genuine products, bought from the makers and their dealers" />
      <div style={{ margin: isMobile ? '0 -8px' : '0 -18px' }}>
        <ProductRail products={brands.map(b => ({ ...b, id: b.name }))} cardWidth={isMobile ? 250 : 290} compact={isMobile} autoPlay={false}
          renderCard={(b, w) => (
            <Link key={b.name} to={`/products?q=${encodeURIComponent(b.name)}`}
              style={{ ...cardStyle(false), flex: `0 0 ${w}px`, width: w, scrollSnapAlign: 'start', textDecoration: 'none', padding: '16px 16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{b.name}</span>
                <span className="num" style={{ fontSize: 12.5, color: 'var(--tx-64748b, #64748B)', whiteSpace: 'nowrap' }}>{b.count} item{b.count !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ aspectRatio: '1/1', borderRadius: 'var(--r-sm)', background: 'var(--bg-fff, #fff)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                    {b.images[i] ? <img src={b.images[i]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                  </div>
                ))}
              </div>
            </Link>
          )} />
      </div>
    </section>
  );
}
