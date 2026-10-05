import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, Zap } from 'lucide-react';
import { addWithFlair, photoIn } from '../lib/cartFx';
import { cardStyle, cornerTag, discountTag, flashTag } from './ProductCard';
const GAP = 12;
const AUTO_MS = 3800;        // time between automatic slides
const RESUME_AFTER_MS = 6000; // after a swipe/click, wait this long before sliding again

/* ── One product card (same look as ProductCard) ── */
export function RailCard({ product: p, width }) {
  const [imgOk, setImgOk] = useState(!!p.image);
  const [hover, setHover] = useState(false);
  const [added, setAdded] = useState(false);
  const price   = p.flash_sale && p.flash_price ? +p.flash_price : +p.price;
  const orig    = p.flash_sale && p.flash_price ? +p.price : +p.original_price;
  const disc    = orig && orig > price ? Math.round((1 - price / orig) * 100) : null;
  const inStock = p.stock > 0;

  return (
    <div data-card onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...cardStyle(hover), ...(width ? { width, flex: `0 0 ${width}px` } : { width: '100%', minWidth: 0 }), scrollSnapAlign: 'start' }}>
      <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', flex: 1 }} draggable={false}>
        {/* Image */}
        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--bg-fff, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, overflow: 'hidden' }}>
          {imgOk
            ? <img src={p.image} alt={p.name} loading="lazy" draggable={false} onError={() => setImgOk(false)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', transform: hover ? 'scale(1.06)' : 'none', transition: 'transform .4s ease' }} />
            : <Package size={34} color="#CBD5E1" />}
          <div style={cornerTag}>
            {disc >= 1 && <span style={discountTag}>−{disc}%</span>}
            {p.flash_sale && <span style={flashTag}><Zap size={11} fill="currentColor" /> Flash</span>}
          </div>
          {!inStock && <span style={{ position: 'absolute', left: 0, bottom: 0, background: 'var(--ink)', color: 'var(--bg-fff, #fff)', fontSize: 11.5, fontWeight: 600, padding: '4px 8px' }}>Out of stock</span>}
        </div>

        {/* Text */}
        <div style={{ padding: '10px 12px 0', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {p.brand && <div style={{ fontSize: 12, color: 'var(--tx-64748b, #64748B)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brand}</div>}
          <div title={p.name} style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.35, minHeight: '2.7em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
          <div className="num" style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 'auto', paddingTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: p.flash_sale ? '#E5383B' : 'var(--ink)' }}>৳{price.toLocaleString('en-BD')}</span>
            {disc >= 1 && <span style={{ fontSize: 12, color: 'var(--tx-94a3b8, #94A3B8)', textDecoration: 'line-through' }}>৳{orig.toLocaleString('en-BD')}</span>}
          </div>
        </div>
      </Link>

      <div style={{ padding: '10px 12px 12px' }}>
        <button className="cart-btn" onClick={e => { if (addWithFlair(p, { price }, photoIn(e.currentTarget)) > 0) { setAdded(true); setTimeout(() => setAdded(false), 1600); } }} disabled={!inStock}
          aria-label={inStock ? `Add ${p.name} to cart` : `${p.name} is out of stock`}>
          {!inStock ? 'Out of stock' : added ? '✓ Added' : 'Add to cart'}
        </button>
      </div>
    </div>
  );
}

/* ── Arrow button (shown on hover with a mouse; hidden on touch screens) ── */
function Arrow({ dir, onClick, show, size = 38 }) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button onClick={onClick} aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'} tabIndex={show ? 0 : -1} className="rail-arrow"
      style={{
        position: 'absolute', top: '40%', [dir]: 4, transform: 'translateY(-50%)', zIndex: 2,
        width: size - 4, height: size + 10, borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--ink)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--bg-fff, #fff)', ...(show ? {} : { opacity: 0, pointerEvents: 'none' }), transition: 'opacity .2s',
      }}>
      <Icon size={20} />
    </button>
  );
}

/**
 * Horizontal product rail: slides by itself (right to left), with arrow buttons.
 * Auto-slide pauses while hovered/touched/focused, when off-screen or the tab is
 * hidden, and is off for visitors who prefer reduced motion.
 */
export default function ProductRail({ products, cardWidth = 176, autoPlay = true, compact = false, renderCard, fade = 'var(--page)' }) {
  const ref = useRef(null);
  const wrapRef = useRef(null);
  const pausedUntil = useRef(0);
  const hovering = useRef(false);
  const visible = useRef(true);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.3 });
    io.observe(el);
    return () => { el.removeEventListener('scroll', updateEdges); ro.disconnect(); io.disconnect(); };
  }, [updateEdges, products.length]);

  const step = () => cardWidth + GAP;
  const scrollByCards = (dir) => {
    const el = ref.current;
    if (!el) return;
    pausedUntil.current = Date.now() + RESUME_AFTER_MS;
    const amount = Math.max(step(), Math.floor(el.clientWidth / step()) * step());
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  // Auto-slide
  useEffect(() => {
    if (!autoPlay) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || hovering.current || !visible.current || document.hidden || Date.now() < pausedUntil.current) return;
      if (el.scrollWidth <= el.clientWidth + 4) return;                 // everything already fits
      if (wrapRef.current?.contains(document.activeElement)) return;     // keyboard user is inside
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step(), behavior: 'smooth' });
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [autoPlay, cardWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!products?.length) return null;
  const pad = compact ? 12 : 18;

  return (
    <div ref={wrapRef} className="rail" style={{ position: 'relative' }}
      onMouseEnter={() => { hovering.current = true; }} onMouseLeave={() => { hovering.current = false; }}
      onTouchStart={() => { pausedUntil.current = Date.now() + RESUME_AFTER_MS; }}>
      {/* soft edges where more products are hidden */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 28, zIndex: 1, pointerEvents: 'none', background: `linear-gradient(90deg, ${fade}, transparent)`, opacity: edges.left ? 1 : 0, transition: 'opacity .2s' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 28, zIndex: 1, pointerEvents: 'none', background: `linear-gradient(270deg, ${fade}, transparent)`, opacity: edges.right ? 1 : 0, transition: 'opacity .2s' }} />
      <Arrow dir="left"  show={edges.left}  onClick={() => scrollByCards(-1)} size={compact ? 32 : 38} />
      <Arrow dir="right" show={edges.right} onClick={() => scrollByCards(1)}  size={compact ? 32 : 38} />

      <div ref={ref} className="hide-scrollbar"
        style={{ display: 'flex', gap: GAP, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', scrollPaddingLeft: pad, padding: `14px ${pad}px 18px` }}>
        {products.map(p => renderCard ? renderCard(p, cardWidth) : <RailCard key={p.id} product={p} width={cardWidth} />)}
      </div>
    </div>
  );
}
