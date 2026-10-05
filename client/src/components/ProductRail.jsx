import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, ShoppingCart, Zap } from 'lucide-react';
import { addToCart } from '../store/cartStore';

const BLUE = '#1E88E5';
const GAP = 12;
const AUTO_MS = 3800;        // time between automatic slides
const RESUME_AFTER_MS = 6000; // after a swipe/click, wait this long before sliding again

/* ── One product card ── */
export function RailCard({ product: p, width }) {
  const [imgOk, setImgOk] = useState(!!p.image);
  const [hover, setHover] = useState(false);
  const price   = p.flash_sale && p.flash_price ? +p.flash_price : +p.price;
  const orig    = p.flash_sale && p.flash_price ? +p.price : +p.original_price;
  const disc    = orig && orig > price ? Math.round((1 - price / orig) * 100) : null;
  const inStock = p.stock > 0;

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        ...(width ? { width, flex: `0 0 ${width}px` } : { width: '100%', minWidth: 0 }), scrollSnapAlign: 'start', background: '#fff', borderRadius: 12,
        border: `1px solid ${hover ? '#D6E4F5' : '#EDF0F3'}`, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: hover ? '0 10px 24px -8px rgba(15,23,42,.18)' : '0 1px 2px rgba(15,23,42,.04)',
        transform: hover ? 'translateY(-3px)' : 'none', transition: 'box-shadow .2s, transform .2s, border-color .2s',
      }}>
      <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', flex: 1 }} draggable={false}>
        {/* Image */}
        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, overflow: 'hidden' }}>
          {imgOk
            ? <img src={p.image} alt={p.name} loading="lazy" draggable={false} onError={() => setImgOk(false)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', transform: hover ? 'scale(1.05)' : 'none', transition: 'transform .35s ease' }} />
            : <div style={{ width: '100%', height: '100%', borderRadius: 8, background: '#F4F6F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={34} color="#C5CDD8" /></div>}
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {disc >= 1 && <span style={{ background: '#E5383B', color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '3px 7px', borderRadius: 6, letterSpacing: .2 }}>-{disc}%</span>}
            {p.flash_sale && <span style={{ background: '#FFF4E5', color: '#C2410C', fontSize: 10, fontWeight: 800, padding: '3px 6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Zap size={10} fill="currentColor" /> Flash</span>}
          </div>
          {!inStock && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ background: '#334155', color: '#fff', fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>Out of stock</span>
            </div>
          )}
        </div>

        {/* Text */}
        <div style={{ padding: '10px 12px 0', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {p.brand && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brand}</div>}
          <div title={p.name} style={{ fontSize: 13, color: '#1F2937', fontWeight: 500, lineHeight: 1.35, minHeight: '2.7em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 'auto', paddingTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16.5, fontWeight: 800, color: p.flash_sale ? '#E5383B' : '#0F172A' }}>৳{price.toLocaleString('en-BD')}</span>
            {disc >= 1 && <span style={{ fontSize: 11.5, color: '#94A3B8', textDecoration: 'line-through' }}>৳{orig.toLocaleString('en-BD')}</span>}
          </div>
        </div>
      </Link>

      <div style={{ padding: '8px 12px 12px' }}>
        <button
          onClick={() => addToCart(p, { price })}
          disabled={!inStock}
          aria-label={inStock ? `Add ${p.name} to cart` : `${p.name} is out of stock`}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: inStock ? 'pointer' : 'not-allowed',
            background: !inStock ? '#F1F5F9' : hover ? BLUE : '#fff', color: !inStock ? '#94A3B8' : hover ? '#fff' : BLUE,
            border: `1.5px solid ${inStock ? BLUE : '#E2E8F0'}`, transition: 'background .15s, color .15s',
          }}>
          {inStock ? <><ShoppingCart size={14} /> Add to cart</> : 'Out of stock'}
        </button>
      </div>
    </div>
  );
}

/* ── Arrow button ── */
function Arrow({ dir, onClick, show, size = 38 }) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button onClick={onClick} aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'} tabIndex={show ? 0 : -1}
      style={{
        position: 'absolute', top: '42%', [dir]: 6, transform: 'translateY(-50%)', zIndex: 2,
        width: size, height: size, borderRadius: '50%', border: '1px solid #E2E8F0', background: 'rgba(255,255,255,.96)',
        boxShadow: '0 4px 14px rgba(15,23,42,.16)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#0F172A', opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none', transition: 'opacity .2s, background .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = BLUE; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.96)'; e.currentTarget.style.color = '#0F172A'; }}>
      <Icon size={size > 34 ? 20 : 17} />
    </button>
  );
}

/**
 * Horizontal product rail: slides by itself (right to left), with arrow buttons.
 * Auto-slide pauses while hovered/touched/focused, when off-screen or the tab is
 * hidden, and is off for visitors who prefer reduced motion.
 */
export default function ProductRail({ products, cardWidth = 176, autoPlay = true, compact = false, renderCard }) {
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
    <div ref={wrapRef} style={{ position: 'relative' }}
      onMouseEnter={() => { hovering.current = true; }} onMouseLeave={() => { hovering.current = false; }}
      onTouchStart={() => { pausedUntil.current = Date.now() + RESUME_AFTER_MS; }}>
      {/* soft edges where more products are hidden */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 28, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(90deg,#fff,rgba(255,255,255,0))', opacity: edges.left ? 1 : 0, transition: 'opacity .2s' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 28, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(270deg,#fff,rgba(255,255,255,0))', opacity: edges.right ? 1 : 0, transition: 'opacity .2s' }} />
      <Arrow dir="left"  show={edges.left}  onClick={() => scrollByCards(-1)} size={compact ? 32 : 38} />
      <Arrow dir="right" show={edges.right} onClick={() => scrollByCards(1)}  size={compact ? 32 : 38} />

      <div ref={ref} className="hide-scrollbar"
        style={{ display: 'flex', gap: GAP, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', scrollPaddingLeft: pad, padding: `14px ${pad}px 18px` }}>
        {products.map(p => renderCard ? renderCard(p, cardWidth) : <RailCard key={p.id} product={p} width={cardWidth} />)}
      </div>
    </div>
  );
}
