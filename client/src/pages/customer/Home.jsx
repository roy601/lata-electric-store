import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cable, Power, ShieldCheck, Lightbulb, Wind, Smartphone, Cpu,
  Home as HomeIcon, Wrench, Droplets, Camera, Sun, Battery, Car,
  Sparkles, DoorOpen, Package, Zap, ShoppingCart, Search, TrendingUp,
  MapPin, Phone, Clock, User, HardHat, Map,
} from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductCard from '../../components/ProductCard';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/cartStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';

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
function SectionHeader({ title, Icon, onViewAll, viewAllLabel = 'View All →', extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px 10px', borderBottom: '1px solid #F8F9FA' }}>
      <div style={{ width: 3, height: 20, background: '#1E88E5', borderRadius: 2, marginRight: 10, flexShrink: 0 }} />
      {Icon && <span style={{ marginRight: 7, display: 'flex', alignItems: 'center' }}><Icon size={18} color="#1E88E5" /></span>}
      <span style={{ fontWeight: 800, fontSize: 16, color: '#212529' }}>{title}</span>
      {extra}
      {onViewAll && (
        <button onClick={onViewAll}
          style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#1E88E5', background: 'none', border: '1px solid #1E88E5', borderRadius: 16, padding: '3px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {viewAllLabel}
        </button>
      )}
    </div>
  );
}

/* ─── Horizontal Product Strip ───────────────────────────────── */
function ProductStrip({ products, cardWidth = 170, cardHeight = 150 }) {
  const navigate = useNavigate();
  const { add }  = useCartStore();
  const ref      = useRef(null);

  if (!products.length) return null;

  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: '12px 18px 14px' }} className="hide-scrollbar">
        {products.map(p => {
          const price   = p.flash_sale && p.flash_price ? p.flash_price : p.price;
          const orig    = p.flash_sale && p.flash_price ? p.price : p.original_price;
          const disc    = orig && orig > price ? Math.round((1 - price / orig) * 100) : null;
          const inStock = p.stock > 0;

          return (
            <div key={p.id}
              style={{ minWidth: cardWidth, maxWidth: cardWidth, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', transition: 'box-shadow .2s, transform .15s', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'; e.currentTarget.style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}
              onClick={() => navigate(`/products/${p.id}`)}>

              <div style={{ height: cardHeight, background: '#f8f9fa', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                {p.image
                  ? <img src={p.image} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <Package size={38} color="#ccc" />}
                {disc && <span style={{ position: 'absolute', top: 6, left: 6, background: '#DC3545', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>-{disc}%</span>}
                {p.flash_sale && <span style={{ position: 'absolute', top: 6, right: 6, background: '#DC3545', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center' }}><Zap size={10} fill="currentColor" /></span>}
                {!inStock && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ background: '#555', color: '#fff', fontSize: 10, padding: '3px 8px', borderRadius: 12, fontWeight: 700 }}>Out of Stock</span>
                  </div>
                )}
              </div>

              <div style={{ padding: '8px 10px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, color: '#222', fontWeight: 500, lineHeight: 1.4, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32 }}>{p.name}</div>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: p.flash_sale ? '#DC3545' : '#212529' }}>৳{price.toLocaleString('en-BD')}</span>
                    {orig && orig > price && <span style={{ fontSize: 11, color: '#bbb', textDecoration: 'line-through' }}>৳{orig.toLocaleString('en-BD')}</span>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); if (inStock) { add({ id: p.id, name: p.name, price, image: p.image }); window.dispatchEvent(new CustomEvent('lata:open-cart')); } }}
                    disabled={!inStock}
                    style={{ width: '100%', padding: '6px 0', background: inStock ? '#1E88E5' : '#e0e0e0', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: inStock ? 'pointer' : 'not-allowed' }}>
                    {inStock ? '+ Add to Cart' : 'Out of Stock'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Banner Carousel ─────────────────────────────────────────── */
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
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 10, cursor: b.product_id ? 'pointer' : 'default', userSelect: 'none', minHeight: 260 }}
      onClick={() => { if (!dragging && b.product_id) navigate(`/products/${b.product_id}`); }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      <div style={{ display: 'flex', height: '100%', transition: 'transform .5s ease', transform: `translateX(-${cur * 100}%)` }}>
        {banners.map(bn => (
          <div key={bn.id} style={{ minWidth: '100%', height: 280, background: '#212529', flexShrink: 0, position: 'relative' }}>
            <img src={bn.image} alt={bn.title || ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
  const { add }  = useCartStore();
  const stripRef = useRef(null);
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
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '2px solid #f0d0d0', boxShadow: '0 2px 8px rgba(192,57,43,.08)' }}>
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

      {/* Cards */}
      <div ref={stripRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '12px 14px 14px' }} className="hide-scrollbar">
        {products.map(p => {
          const price   = p.flash_price || p.price;
          const disc    = p.price > price ? Math.round((1 - price / p.price) * 100) : null;
          const inStock = p.stock > 0;
          return (
            <div key={p.id}
              style={{ minWidth: 160, maxWidth: 160, background: '#fff', border: '1px solid #f4d0d0', borderRadius: 10, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', transition: 'box-shadow .2s, transform .15s', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(192,57,43,.18)'; e.currentTarget.style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}
              onClick={() => navigate(`/products/${p.id}`)}>

              <div style={{ height: 140, background: '#fff8f8', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                {p.image ? <img src={p.image} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={40} color="#ccc" />}
                {disc && <span style={{ position: 'absolute', top: 6, left: 6, background: '#DC3545', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>-{disc}%</span>}
                {!inStock && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ background: '#555', color: '#fff', fontSize: 10, padding: '3px 8px', borderRadius: 12 }}>Out of Stock</span></div>}
              </div>

              <div style={{ padding: '8px 10px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 11, color: '#333', fontWeight: 500, lineHeight: 1.4, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 30 }}>{p.name}</div>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#DC3545' }}>৳{price.toLocaleString('en-BD')}</span>
                    {disc && <span style={{ fontSize: 11, color: '#bbb', textDecoration: 'line-through' }}>৳{p.price.toLocaleString('en-BD')}</span>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); if (inStock) { add({ id: p.id, name: p.name, price, image: p.image }); window.dispatchEvent(new CustomEvent('lata:open-cart')); } }}
                    disabled={!inStock}
                    style={{ width: '100%', padding: '6px 0', background: inStock ? '#1E88E5' : '#e0e0e0', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: inStock ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    {inStock ? <><ShoppingCart size={11} /> Add to Cart</> : 'Out of Stock'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Shared: Block wrapper ──────────────────────────────────── */
const Block = ({ children, style = {} }) => (
  <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #ebebeb', boxShadow: '0 1px 4px rgba(0,0,0,.05)', ...style }}>
    {children}
  </div>
);

/* ─── Main Home Page ──────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;
  const [allProducts,   setAllProducts]   = useState([]);
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
    const load = async () => {
      const [pRes, cRes, bRes, sRes, eRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('banners').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('electricians').select('*').eq('is_active', true).order('sort_order').order('id'),
      ]);
      setAllProducts(pRes.data || []);
      setCategories(cRes.data || []);
      setBanners(bRes.data || []);
      setElectricians(eRes.data || []);
      setShopSettings(sRes.data || null);
      if (sRes.data?.flash_sale_active) setFlashConfig(sRes.data);
      setLoading(false);
    };
    load();
  }, []);

  const flashProducts = useMemo(() => allProducts.filter(p => p.flash_sale && p.flash_price && p.is_active), [allProducts]);
  const trending      = useMemo(() => {
    const topSell  = allProducts.filter(p => p.top_sell);
    const featured = allProducts.filter(p => p.featured && !p.top_sell);
    const rest     = allProducts.filter(p => !p.top_sell && !p.featured).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return [...topSell, ...featured, ...rest].slice(0, 20);
  }, [allProducts]);

  // Category sections: only categories with at least 1 product
  const catSections = useMemo(() =>
    categories
      .map(c => ({ ...c, products: allProducts.filter(p => p.category_id === c.id).slice(0, 10) }))
      .filter(c => c.products.length > 0),
    [categories, allProducts]
  );

  // All-products grid
  const filtered = useMemo(() => {
    let list = [...allProducts];
    if (catFilter !== 'all') list = list.filter(p => p.category_id === +catFilter);
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand||'').toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      if (sort === 'price_asc')  return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'name_asc')   return a.name.localeCompare(b.name);
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return list;
  }, [allProducts, catFilter, search, sort]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const gotoPage   = (n) => { setPage(n); window.scrollTo({ top: document.getElementById('all-products')?.offsetTop - 80 || 0, behavior: 'smooth' }); };

  const W = { maxWidth: 1260, margin: '0 auto', padding: isMobile ? '0 8px' : '0 14px' };

  return (
    <CustomerLayout>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
      `}</style>

      <div style={{ background: '#F8F9FA', paddingBottom: 24 }}>

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

        {/* ══════════════ HERO: Sidebar + Banner + Side Banners ══════════════ */}
        {(() => {
          const sideBanners  = banners.length >= 3 ? banners.slice(-2) : [];
          const mainBanners  = banners.length >= 3 ? banners.slice(0, -2) : banners;
          const cols = isCompact
            ? (sideBanners.length ? '1fr 200px' : '1fr')
            : (sideBanners.length ? '210px 1fr 200px' : '210px 1fr');

          return (
            <div style={{ ...W, paddingTop: isMobile ? 8 : 14, paddingBottom: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'start' }}>

                {/* Category sidebar — desktop/tablet only */}
                {!isMobile && (
                  <Block style={{ position: 'sticky', top: 74, zIndex: 10 }}>
                    <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid #F8F9FA' }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: '#212529', textTransform: 'uppercase', letterSpacing: .5 }}>All Categories</span>
                    </div>
                    <div style={{ maxHeight: 340, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                      {[{ id: 'all', name: 'All Products', isAll: true }, ...categories].map(c => {
                        const isActive = catFilter === String(c.id);
                        return (
                          <div key={c.id}
                            onClick={() => { setCatFilter(String(c.id)); setPage(1); document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: isActive ? '#1E88E5' : '#333', fontWeight: isActive ? 700 : 400, background: isActive ? '#E3F2FD' : 'transparent', borderLeft: isActive ? '3px solid #1E88E5' : '3px solid transparent', transition: 'all .15s' }}
                            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background='#f8f9fa'; e.currentTarget.style.color='#212529'; } }}
                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#333'; } }}>
                            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                              {c.isAll ? <Package size={15} color={isActive ? '#1E88E5' : '#666'} /> : <CatIcon name={c.name} size={15} color={isActive ? '#1E88E5' : '#666'} />}
                            </span>
                            <span style={{ lineHeight: 1.3, flex: 1 }}>{c.name}</span>
                            <span style={{ fontSize: 10, color: '#bbb' }}>›</span>
                          </div>
                        );
                      })}
                    </div>
                  </Block>
                )}

                {/* Main carousel */}
                <BannerCarousel banners={mainBanners} />

                {/* Right side banners — only when 3+ banners uploaded */}
                {sideBanners.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'stretch' }}>
                    {sideBanners.map(b => (
                      <div key={b.id}
                        onClick={() => b.product_id && navigate(`/products/${b.product_id}`)}
                        style={{ flex: 1, borderRadius: 10, overflow: 'hidden', cursor: b.product_id ? 'pointer' : 'default', position: 'relative', background: '#212529', minHeight: 130 }}
                        onMouseEnter={e => { if (b.product_id) e.currentTarget.style.opacity = '.88'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                        <img src={b.image} alt={b.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        {(b.title || b.subtitle) && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.65))', padding: '24px 12px 10px' }}>
                            {b.title && <div style={{ color: '#fff', fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{b.title}</div>}
                            {b.subtitle && <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 10, marginTop: 2 }}>{b.subtitle}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Mobile: horizontal category scroll */}
        {isMobile && categories.length > 0 && (
          <div style={{ ...W, marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }} className="hide-scrollbar">
              {[{ id: 'all', name: 'All', isAll: true }, ...categories].map(c => {
                const isActive = catFilter === String(c.id);
                return (
                  <button key={c.id}
                    onClick={() => { setCatFilter(String(c.id)); setPage(1); document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 12px', background: isActive ? '#1E88E5' : '#fff', color: isActive ? '#fff' : '#444', border: `1px solid ${isActive ? '#1E88E5' : '#e0e0e0'}`, borderRadius: 12, cursor: 'pointer', flexShrink: 0, minWidth: 60, fontSize: 10, fontWeight: isActive ? 700 : 500 }}>
                    {c.isAll ? <Package size={18} color={isActive ? '#fff' : '#666'} /> : <CatIcon name={c.name} size={18} color={isActive ? '#fff' : '#666'} />}
                    <span style={{ whiteSpace: 'nowrap', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════ FLASH DEALS ══════════════ */}
        {flashConfig?.flash_sale_active && flashProducts.length > 0 && (
          <div style={{ ...W, marginTop: 14 }}>
            <FlashSaleSection products={flashProducts} flashConfig={flashConfig} />
          </div>
        )}

        {/* ══════════════ TRENDING PRODUCTS ══════════════ */}
        {trending.length > 0 && (
          <div style={{ ...W, marginTop: 14 }}>
            <Block>
              <SectionHeader title="Trending Products" Icon={TrendingUp} onViewAll={() => { setCatFilter('all'); document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' }); }} />
              <ProductStrip products={trending} cardWidth={175} cardHeight={155} />
            </Block>
          </div>
        )}

        {/* ══════════════ CATEGORY BLOCKS ══════════════ */}
        {!loading && catSections.length > 0 && (
          <div style={{ ...W, marginTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 14 }}>
              {catSections.slice(0, 2).map(c => (
                <Block key={c.id}>
                  <SectionHeader title={c.name} Icon={CAT_ICONS[c.name] || Package}
                    onViewAll={() => { setCatFilter(String(c.id)); setPage(1); document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' }); }} />
                  <ProductStrip products={c.products} cardWidth={isMobile ? 150 : 155} cardHeight={isMobile ? 120 : 135} />
                </Block>
              ))}
            </div>
          </div>
        )}

        {!loading && catSections.slice(2).map((c, idx) => {
          if (idx % 2 !== 0) return null;
          const partner = catSections.slice(2)[idx + 1];
          return (
            <div key={c.id} style={{ ...W, marginTop: isMobile ? 10 : 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: (!isCompact && partner) ? '1fr 1fr' : '1fr', gap: isMobile ? 10 : 14 }}>
                <Block>
                  <SectionHeader title={c.name} Icon={CAT_ICONS[c.name] || Package}
                    onViewAll={() => { setCatFilter(String(c.id)); setPage(1); document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' }); }} />
                  <ProductStrip products={c.products} cardWidth={isMobile ? 150 : 155} cardHeight={isMobile ? 120 : 135} />
                </Block>
                {partner && !isCompact && (
                  <Block>
                    <SectionHeader title={partner.name} Icon={CAT_ICONS[partner.name] || Package}
                      onViewAll={() => { setCatFilter(String(partner.id)); setPage(1); document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' }); }} />
                    <ProductStrip products={partner.products} cardWidth={155} cardHeight={135} />
                  </Block>
                )}
                {partner && isCompact && (
                  <Block>
                    <SectionHeader title={partner.name} Icon={CAT_ICONS[partner.name] || Package}
                      onViewAll={() => { setCatFilter(String(partner.id)); setPage(1); document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' }); }} />
                    <ProductStrip products={partner.products} cardWidth={isMobile ? 150 : 155} cardHeight={isMobile ? 120 : 135} />
                  </Block>
                )}
              </div>
            </div>
          );
        })}

        {/* ══════════════ ALL PRODUCTS GRID ══════════════ */}
        <div id="all-products" style={{ ...W, marginTop: isMobile ? 10 : 14 }}>
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
                <span style={{ fontSize: 12, color: '#9aa5b1' }}>{filtered.length} items</span>
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
              {loading ? (
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
                    {paginated.map(p => <ProductCard key={p.id} product={p} />)}
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

        {/* ══════════════ FIND OUR SHOP (MAP) ══════════════ */}
        {(shopSettings?.map_url || shopSettings?.map_embed_src) && (
          <div style={{ ...W, marginTop: isMobile ? 10 : 14 }}>
            <Block>
              <SectionHeader title="আমাদের শপ খুঁজুন" Icon={MapPin} extra={<span style={{ marginLeft: 8, fontSize: 12, color: '#9aa5b1', fontWeight: 400 }}>Find Our Shop</span>} />
              <div style={{ padding: isMobile ? '14px 12px' : '16px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: isMobile ? 14 : 20, alignItems: 'start' }}>
                  {/* Shop info card */}
                  <div style={{ background: '#F8F9FA', borderRadius: 12, padding: '20px 18px', border: '1px solid #ebebeb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, background: '#1E88E5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={22} color="#fff" fill="#fff" /></div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#212529' }}>{shopSettings?.store_name_bn || 'লতা ইলেকট্রিক'}</div>
                        <div style={{ fontSize: 11, color: '#9aa5b1' }}>{shopSettings?.store_tagline || 'Lata Electric'}</div>
                      </div>
                    </div>
                    {shopSettings?.address && (
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                        <MapPin size={16} color="#1E88E5" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>{shopSettings.address}</span>
                      </div>
                    )}
                    {shopSettings?.phone && (
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                        <Phone size={16} color="#1E88E5" />
                        <a href={`tel:${shopSettings.phone.replace(/[^+\d]/g,'')}`} style={{ fontSize: 13, color: '#1E88E5', fontWeight: 600, textDecoration: 'none' }}>{shopSettings.phone}</a>
                      </div>
                    )}
                    {shopSettings?.hours && (
                      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                        <Clock size={16} color="#1E88E5" />
                        <span style={{ fontSize: 13, color: '#555' }}>{shopSettings.hours}</span>
                      </div>
                    )}
                    {shopSettings?.map_url && (
                      <a href={shopSettings.map_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 16px', background: '#1E88E5', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none', boxSizing: 'border-box', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background='#1565C0'}
                        onMouseLeave={e => e.currentTarget.style.background='#1E88E5'}>
                        <Map size={15} /> Get Directions on Google Maps
                      </a>
                    )}
                  </div>

                  {/* Map embed or click-to-open placeholder */}
                  {shopSettings?.map_embed_src ? (
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #ebebeb', minHeight: isMobile ? 220 : 300, cursor: 'pointer', position: 'relative' }}
                      onClick={() => shopSettings?.map_url && window.open(shopSettings.map_url, '_blank')}>
                      <iframe
                        src={shopSettings.map_embed_src}
                        width="100%" height={isMobile ? 220 : 300}
                        style={{ border: 0, display: 'block', pointerEvents: 'none' }}
                        allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                      />
                      {shopSettings?.map_url && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 12, background: 'transparent' }}>
                          <a href={shopSettings.map_url} target="_blank" rel="noopener noreferrer"
                            style={{ background: '#fff', color: '#1E88E5', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,.2)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                            onClick={e => e.stopPropagation()}>
                            <Map size={13} /> Open in Google Maps
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <a href={shopSettings.map_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: isMobile ? 180 : 280, background: 'linear-gradient(135deg,#E3F2FD,#BBDEFB)', borderRadius: 12, border: '2px dashed #1E88E5', textDecoration: 'none', transition: 'background .15s', gap: 10 }}
                      onMouseEnter={e => e.currentTarget.style.background='linear-gradient(135deg,#BBDEFB,#90CAF9)'}
                      onMouseLeave={e => e.currentTarget.style.background='linear-gradient(135deg,#E3F2FD,#BBDEFB)'}>
                      <Map size={52} color="#1E88E5" />
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#1E88E5' }}>View on Google Maps</span>
                      <span style={{ fontSize: 12, color: '#1565C0' }}>Tap to open directions</span>
                    </a>
                  )}
                </div>
              </div>
            </Block>
          </div>
        )}

      </div>
    </CustomerLayout>
  );
}
