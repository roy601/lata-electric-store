import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cable, Power, ShieldCheck, Lightbulb, Wind, Smartphone, Cpu,
  Home as HomeIcon, Wrench, Droplets, Camera, Sun, Battery, Car,
  Sparkles, DoorOpen, Package, Zap, ShoppingCart, Search, TrendingUp, Star, Flame,
  MapPin, Phone, Clock, User, HardHat, Map, ChevronRight,
} from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductCard from '../../components/ProductCard';
import { supabase } from '../../lib/supabase';
import { addToCart } from '../../store/cartStore';
import { fetchProductPage } from '../../lib/catalog';
import ShopLocation from '../../components/ShopLocation';
import ProductRail, { RailCard } from '../../components/ProductRail';
import { CategoryCircles, TrustStrip, HotDeals, RecommendedTabs, TopBrands, SectionTitle } from '../../components/home/HomeSections';
import { fetchCategoryCounts } from '../../lib/catalog';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useSeo, storeJsonLd } from '../../lib/seo';

const CAT_ICONS = {
  'Electrical Wire & Cable':      Cable,
  'Switch, Socket & Plug':        Power,
  'Circuit Protection & Safety':  ShieldCheck,
  'LED Lighting':                 Lightbulb,
  'Fan & Cooling Products':       Wind,
  'Electronics Accessories':      Smartphone,
  'Electronic Components':        Cpu,
  'Home Appliance':               HomeIcon,
  'Hardware Tools':               Wrench,
  'Plumbing & Plastic Items':     Droplets,
  'CCTV & Security':              Camera,
  'Solar Products':               Sun,
  'Battery & Power Backup':       Battery,
  'Automobile & Small Electrical':Car,
  'Seasonal Products':            Sparkles,
  'Door & Furniture Hardware':    DoorOpen,
};

const CatIcon = ({ name, size = 15, color = 'currentColor' }) => {
  const Icon = CAT_ICONS[name] || Package;
  return <Icon size={size} color={color} />;
};

/* ─── Shared: Section Header ─────────────────────────────────── */
function SectionHeader({ title, Icon, onViewAll, viewAllLabel = 'View all', extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px 18px', borderBottom: '1px solid #F1F4F7' }}>
      {Icon && (
        <span style={{ width: 34, height: 34, borderRadius: 10, background: '#EEF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color="#1E88E5" />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 16.5, color: '#0F172A', letterSpacing: -.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{title}</span>
        {extra}
      </div>
      {onViewAll && (
        <button onClick={onViewAll}
          style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#1E88E5', background: 'none', border: 'none', borderRadius: 8, padding: '6px 6px 6px 10px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'inherit', transition: 'background .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#EEF6FF'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
          {viewAllLabel.replace(/\s*→\s*$/, '')} <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

/* ─── Horizontal Product Strip (auto-sliding rail with arrows) ── */
function ProductStrip({ products, cardWidth = 176 }) {
  const { isMobile } = useBreakpoint();
  return <ProductRail products={products} cardWidth={isMobile ? 152 : cardWidth} compact={isMobile} />;
}

/* ─── Banner Carousel ─────────────────────────────────────────── */
/* Where a banner goes when clicked: its link (page or https), else its product */
const bannerTarget = (b) => b.link_url || (b.product_id ? `/products/${b.product_id}` : null);
const openBanner = (b, navigate) => {
  const t = bannerTarget(b);
  if (!t) return;
  if (t.startsWith('/')) navigate(t);
  else if (/^https?:\/\//.test(t)) window.open(t, '_blank', 'noopener');
};

/* A side tile beside the slider */
function SideTile({ b, navigate, style }) {
  const clickable = !!bannerTarget(b);
  return (
    <div onClick={() => openBanner(b, navigate)} role={clickable ? 'link' : undefined}
      style={{ borderRadius: 12, overflow: 'hidden', background: '#EEF2F6', cursor: clickable ? 'pointer' : 'default', position: 'relative', minHeight: 0, ...style }}
      onMouseEnter={e => { const i = e.currentTarget.querySelector('img'); if (i && clickable) i.style.transform = 'scale(1.03)'; }}
      onMouseLeave={e => { const i = e.currentTarget.querySelector('img'); if (i) i.style.transform = 'none'; }}>
      <img src={b.image} alt={b.title || ''} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .35s ease' }} />
    </div>
  );
}

function BannerCarousel({ banners }) {
  const navigate = useNavigate();
  const [cur, setCur]         = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX]   = useState(0);
  const timerRef              = useRef(null);

  const resetTimer = () => {
    clearInterval(timerRef.current);
    if (banners.length > 1) {
      timerRef.current = setInterval(() => setCur(c => (c + 1) % banners.length), 5000);
    }
  };

  useEffect(() => { resetTimer(); return () => clearInterval(timerRef.current); }, [banners.length]);

  const prev = () => { setCur(c => (c - 1 + banners.length) % banners.length); resetTimer(); };
  const next = () => { setCur(c => (c + 1) % banners.length); resetTimer(); };

  const onMouseDown = (e) => { setStartX(e.clientX); setDragging(false); };
  const onMouseMove = (e) => { if (Math.abs(e.clientX - startX) > 5) setDragging(true); };
  const onTouchStart = (e) => setStartX(e.touches[0].clientX);
  const onTouchEnd   = (e) => { const diff = startX - e.changedTouches[0].clientX; if (Math.abs(diff) > 50) diff > 0 ? next() : prev(); };

  if (!banners.length) {
    return (
      <div style={{ flex: 1, background: 'linear-gradient(135deg,#212529,#1565C0)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', minHeight: 260 }}>
        <div style={{ marginBottom: 4 }}><Zap size={48} fill="currentColor" /></div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>লতা ইলেকট্রিক</div>
        <div style={{ color: '#9aa5b1', fontSize: 12, marginTop: 6 }}>Add banners from Admin → Banners</div>
      </div>
    );
  }

  const b = banners[cur];
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 10, cursor: b.product_id ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={() => { if (!dragging) openBanner(b, navigate); }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      <div style={{ display: 'flex', transition: 'transform .5s ease', transform: `translateX(-${cur * 100}%)` }}>
        {banners.map(bn => (
          <div key={bn.id} style={{ minWidth: '100%', aspectRatio: '16/7', background: '#212529', flexShrink: 0, position: 'relative' }}>
            <img src={bn.image} alt={bn.title || ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            {(bn.title || bn.subtitle) && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.65))', padding: '40px 24px 18px' }}>
                {bn.title && <div style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(14px,1.8vw,22px)', textShadow: '0 2px 4px rgba(0,0,0,.5)' }}>{bn.title}</div>}
                {bn.subtitle && <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 12, marginTop: 3 }}>{bn.subtitle}</div>}
                {bn.product_id && <div style={{ marginTop: 8, display: 'inline-block', background: '#1E88E5', color: '#fff', padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>Shop Now →</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {banners.length > 1 && <>
        <button onClick={e => { e.stopPropagation(); prev(); }} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <button onClick={e => { e.stopPropagation(); next(); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
          {banners.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setCur(i); resetTimer(); }}
              style={{ width: i === cur ? 20 : 7, height: 7, borderRadius: 4, border: 'none', cursor: 'pointer', background: i === cur ? '#1E88E5' : 'rgba(255,255,255,.5)', padding: 0, transition: 'all .3s' }} />
          ))}
        </div>
      </>}
    </div>
  );
}

/* ─── Flash Sale Section ─────────────────────────────────────── */
function FlashSaleSection({ products, flashConfig }) {
  const navigate = useNavigate();
  const [time, setTime] = useState({ h: '00', m: '00', s: '00', ended: false });

  useEffect(() => {
    if (!flashConfig?.flash_sale_ends) return;
    const tick = () => {
      const diff = new Date(flashConfig.flash_sale_ends) - Date.now();
      if (diff <= 0) { setTime({ h: '00', m: '00', s: '00', ended: true }); return; }
      setTime({ h: String(Math.floor(diff/3600000)).padStart(2,'0'), m: String(Math.floor((diff%3600000)/60000)).padStart(2,'0'), s: String(Math.floor((diff%60000)/1000)).padStart(2,'0'), ended: false });
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [flashConfig]);

  if (!flashConfig?.flash_sale_active || products.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #EDF0F3', boxShadow: '0 1px 3px rgba(15,23,42,.05)', minWidth: 0 }}>
      {/* Red header */}
      <div style={{ background: 'linear-gradient(90deg, #1565C0, #1E88E5)', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ background: '#DC3545', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 900, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Zap size={11} fill="currentColor" /> FLASH</span>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: .5 }}>Deals</span>
          <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>{products.length} deals</span>
        </div>
        {/* Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 12 }}>{time.ended ? 'Ended' : 'Ends in'}</span>
          {[time.h, time.m, time.s].map((val, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ background: '#212529', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'monospace', padding: '3px 7px', borderRadius: 5, minWidth: 28, textAlign: 'center' }}>{val}</span>
              {i < 2 && <span style={{ color: 'rgba(255,255,255,.7)', fontWeight: 700 }}>:</span>}
            </span>
          ))}
        </div>
        <button onClick={() => navigate('/flash-sale')}
          style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', padding: '4px 14px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          View All Deals →
        </button>
      </div>

      {/* Cards — same auto-sliding rail as the other sections */}
      <FlashRail products={products} />
    </div>
  );
}

function FlashRail({ products }) {
  const { isMobile } = useBreakpoint();
  return <ProductRail products={products} cardWidth={isMobile ? 152 : 176} compact={isMobile} />;
}

/* ─── Shared: Block wrapper ──────────────────────────────────── */
const Block = ({ children, style = {} }) => (
  <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #EDF0F3', boxShadow: '0 1px 3px rgba(15,23,42,.05)', minWidth: 0, ...style }}>
    {children}
  </div>
);

/* ─── Main Home Page ──────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;
  const [sections,      setSections]      = useState({ flash: [], featured: [], topSell: [], trending: [], newest: [], deals: [], brands: [], counts: {}, byCat: {} });
  const [categories,    setCategories]    = useState([]);
  const [banners,       setBanners]       = useState([]);
  const [flashConfig,   setFlashConfig]   = useState(null);
  const [electricians,  setElectricians]  = useState([]);
  const [shopSettings,  setShopSettings]  = useState(null);
  const [loading,       setLoading]       = useState(true);

  // All-products search/filter state
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sort,      setSort]      = useState('newest');
  const [page,      setPage]      = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    const catHandler = (e) => { setCatFilter(String(e.detail)); setPage(1); window.scrollTo({ top: document.getElementById('all-products')?.offsetTop - 80 || 0, behavior: 'smooth' }); };
    window.addEventListener('lata:cat', catHandler);
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat'); const q = params.get('q');
    if (cat) setCatFilter(String(cat));
    if (q)   setSearch(q);
    return () => window.removeEventListener('lata:cat', catHandler);
  }, []);

  useEffect(() => {
    // Each section asks the database only for what it shows (never the whole catalogue)
    const strip = (flag) => supabase.from('products').select('*').eq('is_active', true).eq(flag, true)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
    const load = async () => {
      const [cRes, bRes, sRes, eRes, flashRes, featRes, topRes, trendRes, catRes, newRes, dealRes, brandRes, counts] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('banners').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('electricians').select('*').eq('is_active', true).order('sort_order').order('id'),
        strip('flash_sale').gt('flash_price', 0),
        strip('featured'),
        strip('top_sell'),
        strip('trending'),
        supabase.rpc('home_category_products', { p_per_cat: 12 }),
        supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10),
        supabase.from('products').select('*').eq('is_active', true).not('original_price', 'is', null).limit(80),
        supabase.from('products').select('id, brand, image').eq('is_active', true).not('brand', 'is', null).order('top_sell', { ascending: false }).limit(400),
        fetchCategoryCounts(),
      ]);
      // Hot deals: biggest real discounts first
      const pct = (p) => {
        const price = p.flash_sale && p.flash_price ? +p.flash_price : +p.price;
        const orig  = p.flash_sale && p.flash_price ? +p.price : +p.original_price;
        return orig > price ? (orig - price) / orig : 0;
      };
      const seen = new Set();
      const deals = [...(flashRes.data || []), ...(dealRes.data || [])]
        .filter(p => pct(p) >= 0.01 && !seen.has(p.id) && seen.add(p.id))
        .sort((a, b) => pct(b) - pct(a)).slice(0, 10);
      // Top brands: most products first, with three product photos each
      const byBrand = {};
      (brandRes.data || []).forEach(p => {
        const name = String(p.brand || '').trim(); if (!name) return;
        const b = (byBrand[name.toLowerCase()] ||= { name, count: 0, images: [] });
        b.count++; if (p.image && b.images.length < 3) b.images.push(p.image);
      });
      const brands = Object.values(byBrand).sort((a, b) => b.count - a.count).slice(0, 12);
      const byCat = {};
      (catRes.data || []).forEach(p => { (byCat[p.category_id] ||= []).push(p); });
      const next = { flash: flashRes.data || [], featured: featRes.data || [], topSell: topRes.data || [], trending: trendRes.data || [], newest: newRes.data || [], deals, brands, counts, byCat };
      setSections(next);
      setCategories(cRes.data || []);
      setBanners(bRes.data || []);
      setElectricians(eRes.data || []);
      setShopSettings(sRes.data || null);
      if (sRes.data?.flash_sale_active) setFlashConfig(sRes.data);
      setLoading(false);

      // Preload above-the-fold pictures, then let the intro overlay (index.html) fade out
      const urls = [
        ...(bRes.data || []).map(b => b.image),
        ...[...next.flash, ...next.featured, ...(catRes.data || [])].slice(0, 12).map(p => p.image),
      ].filter(Boolean);
      const preload = (src) => new Promise(res => {
        const img = new Image();
        img.onload = img.onerror = res;
        img.src = src;
      });
      await Promise.race([Promise.all(urls.map(preload)), new Promise(r => setTimeout(r, 6000))]);
      window.__lataHomeReady = true;
      window.dispatchEvent(new Event('lata:home-ready'));
    };
    load();
  }, []);

  const flashProducts    = sections.flash;
  const featuredProducts = sections.featured;
  const topSellProducts  = sections.topSell;
  const trending         = sections.trending;

  // Category sections: only categories with at least 1 product
  const catSections = useMemo(() =>
    categories
      .map(c => ({ ...c, products: sections.byCat[c.id] || [] }))
      .filter(c => c.products.length > 0),
    [categories, sections]
  );

  // All-products grid — one page at a time from the database
  const [paginated,   setPaginated]   = useState([]);
  const [gridTotal,   setGridTotal]   = useState(0);
  const [gridLoading, setGridLoading] = useState(true);
  const [debounced,   setDebounced]   = useState(search);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    let cancelled = false;
    setGridLoading(true);
    fetchProductPage({ cat: catFilter, q: debounced, sort, page, perPage: PER_PAGE })
      .then(r => { if (!cancelled) { setPaginated(r.products); setGridTotal(r.total); } })
      .catch(() => { if (!cancelled) { setPaginated([]); setGridTotal(0); } })
      .finally(() => { if (!cancelled) setGridLoading(false); });
    return () => { cancelled = true; };
  }, [catFilter, debounced, sort, page]);

  const totalPages = Math.ceil(gridTotal / PER_PAGE);
  const gotoPage   = (n) => { setPage(n); window.scrollTo({ top: document.getElementById('all-products')?.offsetTop - 80 || 0, behavior: 'smooth' }); };

  useSeo({ path: '/', jsonLd: storeJsonLd(shopSettings || {}) });

  // Width ÷ height of each banner image (decides slider vs side box)
  const [bannerRatio, setBannerRatio] = useState({});
  useEffect(() => {
    let cancelled = false;
    banners.forEach(b => {
      const im = new Image();
      im.onload = () => { if (!cancelled && im.naturalHeight) setBannerRatio(r => ({ ...r, [b.id]: im.naturalWidth / im.naturalHeight })); };
      im.src = b.image;
    });
    return () => { cancelled = true; };
  }, [banners]);

  const W = { maxWidth: 1260, margin: '0 auto', padding: isMobile ? '0 8px' : '0 14px' };

  return (
    <CustomerLayout>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
      `}</style>

      <div style={{ background: '#fff', paddingBottom: 32 }}>

        {/* ══════════════ ANNOUNCEMENT TICKER ══════════════ */}
        {shopSettings?.announcement_bar && (
          <div style={{ ...W, paddingTop: isMobile ? 8 : 12, paddingBottom: 0 }}>
            <div style={{ background: '#fff', borderRadius: 50, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '1px solid #EBEBEB', height: 38, display: 'flex', alignItems: 'center' }}>
              <div style={{ flexShrink: 0, background: '#1E88E5', borderRadius: 50, padding: '4px 14px', margin: '0 12px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', letterSpacing: .3 }}>
                NOTICE
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div style={{ whiteSpace: 'nowrap', fontSize: 13, color: '#374151', fontWeight: 500, animation: 'marquee 28s linear infinite' }}>
                  {shopSettings.announcement_bar}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ HERO: slider + side tiles (2 wide, 2 small) ══════════════ */}
        {(() => {
          // Placement comes from Admin → Banners. Banners saved before placements existed:
          // square-ish pictures count as small side tiles, the rest stay in the slider.
          const place = (b) => b.placement || ((bannerRatio[b.id] || 99) < 1.3 ? 'side_small' : 'slider');
          const sliderBanners = banners.filter(b => place(b) === 'slider');
          const sideWide      = banners.filter(b => place(b) === 'side_wide').slice(0, 2);
          const sideSmall     = banners.filter(b => place(b) === 'side_small').slice(0, 2);
          const hasSide       = sideWide.length + sideSmall.length > 0;
          // Right column width chosen so the tiles keep their own shape (13:6 wide, 32:37 small)
          // and the column is as tall as the 16:7 slider — no cropping.
          const full = sideWide.length === 2 && sideSmall.length > 0;
          const sideCol = full ? 'calc(22.6% - 11px)' : sideWide.length === 2 ? 'calc(32.2% - 13px)' : '26%';

          return (
            <div style={{ ...W, paddingTop: isMobile ? 10 : 18, paddingBottom: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: (!isMobile && hasSide) ? `minmax(0, 1fr) ${sideCol}` : 'minmax(0, 1fr)', gap: isMobile ? 8 : 12, alignItems: full || sideWide.length === 2 ? 'start' : 'stretch' }}>
                <BannerCarousel banners={sliderBanners.length ? sliderBanners : banners.filter(b => !sideWide.includes(b) && !sideSmall.includes(b))} />

                {hasSide && !isMobile && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
                    {sideWide.map(b => <SideTile key={b.id} b={b} navigate={navigate} style={sideWide.length === 2 ? { aspectRatio: '13 / 6' } : { flex: '1 1 0' }} />)}
                    {sideSmall.length > 0 && (
                      <div style={{ flex: full ? 'none' : '1 1 0', display: 'grid', gridTemplateColumns: sideSmall.length > 1 ? '1fr 1fr' : '1fr', gap: 12, minHeight: 0 }}>
                        {sideSmall.map(b => <SideTile key={b.id} b={b} navigate={navigate} style={full ? { aspectRatio: '32 / 37' } : {}} />)}
                      </div>
                    )}
                  </div>
                )}

                {/* Phones: side tiles under the slider */}
                {hasSide && isMobile && (
                  <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', scrollPaddingLeft: 8, margin: '0 -8px', padding: '0 8px' }}>
                    {sideWide.map(b => <SideTile key={b.id} b={b} navigate={navigate} style={{ flex: '0 0 auto', height: 140, aspectRatio: '13 / 6', scrollSnapAlign: 'start' }} />)}
                    {sideSmall.map(b => <SideTile key={b.id} b={b} navigate={navigate} style={{ flex: '0 0 auto', height: 140, aspectRatio: '32 / 37', scrollSnapAlign: 'start' }} />)}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ══════════════ SHOP BY CATEGORY (round pictures) ══════════════ */}
        {categories.length > 0 && (
          <div style={{ ...W, marginTop: isMobile ? 22 : 34 }}>
            <CategoryCircles categories={categories} counts={sections.counts}
              previewImages={Object.fromEntries(Object.entries(sections.byCat).map(([id, ps]) => [id, ps.find(p => p.image)?.image]))} />
          </div>
        )}

        {/* ══════════════ TRUST STRIP ══════════════ */}
        <div style={{ ...W, marginTop: isMobile ? 14 : 20 }}>
          <TrustStrip settings={shopSettings} />
        </div>

        {/* ══════════════ FLASH DEALS ══════════════ */}
        {flashConfig?.flash_sale_active && flashProducts.length > 0 && (
          <div style={{ ...W, marginTop: isMobile ? 26 : 40 }}>
            <FlashSaleSection products={flashProducts} flashConfig={flashConfig} />
          </div>
        )}

        {/* ══════════════ HOT DEALS ══════════════ */}
        {sections.deals.length > 0 && (
          <div style={{ ...W, marginTop: isMobile ? 26 : 40 }}>
            <HotDeals products={sections.deals} />
          </div>
        )}

        {/* ══════════════ RECOMMENDED FOR YOU (tabs) ══════════════ */}
        <div style={{ ...W, marginTop: isMobile ? 26 : 40 }}>
          <RecommendedTabs tabs={[
            { key: 'featured', label: 'Featured',     products: featuredProducts },
            { key: 'top',      label: 'Top Selling',  products: topSellProducts },
            { key: 'trending', label: 'Trending',     products: trending },
            { key: 'new',      label: 'New Arrivals', products: sections.newest, to: '/products' },
          ]} />
        </div>

        {/* ══════════════ ONE ROW PER CATEGORY ══════════════ */}
        {!loading && catSections.map(c => (
          <div key={c.id} style={{ ...W, marginTop: isMobile ? 26 : 40 }}>
            <SectionTitle title={String(c.name).trim()} sub={sections.counts[c.id] ? `${sections.counts[c.id]} products` : null} to={`/products?cat=${c.id}`} />
            <div style={{ margin: isMobile ? '0 -8px' : '0 -18px' }}>
              <ProductStrip products={c.products} cardWidth={184} />
            </div>
          </div>
        ))}

        {/* ══════════════ TOP BRANDS ══════════════ */}
        {sections.brands.length > 1 && (
          <div style={{ ...W, marginTop: isMobile ? 26 : 40 }}>
            <TopBrands brands={sections.brands} />
          </div>
        )}

        {/* ══════════════ ALL PRODUCTS GRID ══════════════ */}
        <div id="all-products" style={{ ...W, marginTop: isMobile ? 26 : 40 }}>
          <Block>
            {/* Toolbar */}
            <div style={{ padding: isMobile ? '10px 12px' : '12px 18px', borderBottom: '1px solid #F8F9FA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: isMobile ? 8 : 0 }}>
                <div style={{ width: 3, height: 20, background: '#1E88E5', borderRadius: 2, flexShrink: 0 }} />
                <span style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, color: '#212529' }}>All Products</span>
                {catFilter !== 'all' && (
                  <span style={{ background: '#212529', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 16 }}>
                    {categories.find(c => String(c.id) === catFilter)?.name}
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#9aa5b1' }}>{gridTotal} items</span>
                {(search || catFilter !== 'all') && (
                  <button onClick={() => { setSearch(''); setCatFilter('all'); setPage(1); }}
                    style={{ padding: '4px 10px', fontSize: 11, color: '#1E88E5', background: 'none', border: '1px solid #1E88E5', borderRadius: 16, cursor: 'pointer' }}>
                    × Clear
                  </button>
                )}
                {!isMobile && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
                      style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, width: 170, outline: 'none' }}
                      onFocus={e => e.target.style.borderColor='#1E88E5'}
                      onBlur={e => e.target.style.borderColor='#e0e0e0'} />
                    <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
                      style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none' }}>
                      <option value="newest">Newest First</option>
                      <option value="price_asc">Price: Low → High</option>
                      <option value="price_desc">Price: High → Low</option>
                      <option value="name_asc">Name A–Z</option>
                    </select>
                  </div>
                )}
              </div>
              {isMobile && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search products…"
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none' }}
                    onFocus={e => e.target.style.borderColor='#1E88E5'}
                    onBlur={e => e.target.style.borderColor='#e0e0e0'} />
                  <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
                    style={{ padding: '7px 8px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12, background: '#fff', cursor: 'pointer', outline: 'none', flexShrink: 0 }}>
                    <option value="newest">Newest</option>
                    <option value="price_asc">↑ Price</option>
                    <option value="price_desc">↓ Price</option>
                    <option value="name_asc">A–Z</option>
                  </select>
                </div>
              )}
            </div>

            {/* Grid */}
            <div style={{ padding: isMobile ? '10px 10px 14px' : '16px 18px 18px' }}>
              {gridLoading && paginated.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                  <div style={{ width: 38, height: 38, border: '4px solid #f0f0f0', borderTop: '4px solid #1E88E5', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
                </div>
              ) : paginated.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: '#9aa5b1' }}>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Search size={48} color="#ccc" /></div>
                  <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>No products found</div>
                  <div style={{ fontSize: 13 }}>Try a different search or category.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill, minmax(175px,1fr))', gap: isMobile ? 8 : 14 }}>
                    {paginated.map(p => <RailCard key={p.id} product={p} />)}
                  </div>

                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24, flexWrap: 'wrap' }}>
                      <button onClick={() => gotoPage(Math.max(1, page-1))} disabled={page===1}
                        style={{ padding: '7px 13px', border: 'none', borderRadius: 8, cursor: page===1?'not-allowed':'pointer', background: '#f0f0f0', color: '#555', opacity: page===1?.4:1 }}>←</button>
                      {Array.from({length:totalPages},(_,i)=>i+1)
                        .filter(n=>n===1||n===totalPages||Math.abs(n-page)<=2)
                        .reduce((acc,n,i,arr)=>{ if(i>0&&n-arr[i-1]>1)acc.push('…'); acc.push(n); return acc; },[])
                        .map((n,i)=>n==='…'
                          ? <span key={`e${i}`} style={{padding:'7px 4px',color:'#9aa5b1'}}>…</span>
                          : <button key={n} onClick={()=>gotoPage(n)}
                              style={{width:34,height:34,border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13,background:page===n?'#1E88E5':'#f0f0f0',color:page===n?'#fff':'#555'}}>{n}</button>
                        )}
                      <button onClick={() => gotoPage(Math.min(totalPages, page+1))} disabled={page===totalPages}
                        style={{ padding: '7px 13px', border: 'none', borderRadius: 8, cursor: page===totalPages?'not-allowed':'pointer', background: '#f0f0f0', color: '#555', opacity: page===totalPages?.4:1 }}>→</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Block>
        </div>

        {/* ══════════════ OUR TEAM (ELECTRICIANS) ══════════════ */}
        {electricians.length > 0 && (
          <div style={{ ...W, marginTop: isMobile ? 10 : 14 }}>
            <Block>
              <SectionHeader title="আমাদের টিম" Icon={HardHat} extra={<span style={{ marginLeft: 8, fontSize: 12, color: '#9aa5b1', fontWeight: 400 }}>Our Expert Electricians</span>} />
              <div style={{ padding: isMobile ? '14px 12px' : '16px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(170px,1fr))', gap: isMobile ? 10 : 14 }}>
                  {electricians.map(el => (
                    <div key={el.id} style={{ background: '#F8F9FA', borderRadius: 14, padding: '18px 14px 14px', textAlign: 'center', border: '1px solid #ebebeb', transition: 'box-shadow .2s, transform .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 20px rgba(30,136,229,.12)'; e.currentTarget.style.transform='translateY(-3px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}>
                      {/* Avatar */}
                      <div style={{ width: isMobile ? 70 : 80, height: isMobile ? 70 : 80, borderRadius: '50%', margin: '0 auto 12px', border: '3px solid #fff', boxShadow: '0 4px 12px rgba(30,136,229,.18)', overflow: 'hidden', background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {el.image
                          ? <img src={el.image} alt={el.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <User size={isMobile ? 30 : 36} color="#9aa5b1" />}
                      </div>
                      {/* Name */}
                      <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 14, color: '#212529', marginBottom: 5, lineHeight: 1.3 }}>{el.name}</div>
                      {/* Role badge */}
                      <div style={{ display: 'inline-block', background: '#E3F2FD', color: '#1E88E5', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 16, marginBottom: el.phone ? 8 : 0 }}>{el.role}</div>
                      {/* Phone */}
                      {el.phone && (
                        <a href={`tel:${el.phone.replace(/[^+\d]/g,'')}`}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, color: '#28A745', fontWeight: 600, textDecoration: 'none', marginTop: 6 }}
                          onClick={e => e.stopPropagation()}>
                          <Phone size={12} /> {el.phone}
                        </a>
                      )}
                      {/* Bio */}
                      {el.bio && !isMobile && (
                        <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 6, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{el.bio}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Block>
          </div>
        )}

        {/* ══════════════ FIND OUR SHOP ══════════════ */}
        {(shopSettings?.map_url || shopSettings?.map_embed_src || shopSettings?.address) && (
          <div style={{ ...W, marginTop: isMobile ? 10 : 14 }}>
            <Block>
              <SectionHeader title="আমাদের শপ খুঁজুন" Icon={MapPin} extra={<span style={{ marginLeft: 8, fontSize: 12, color: '#9aa5b1', fontWeight: 400 }}>Visit our shop</span>} />
              <div style={{ padding: isMobile ? '14px 12px' : '18px 18px 20px', background: '#F8FAFC' }}>
                <ShopLocation settings={shopSettings} isMobile={isMobile} />
              </div>
            </Block>
          </div>
        )}

      </div>
    </CustomerLayout>
  );
}
