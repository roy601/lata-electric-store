import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu, X, Zap, Heart, Package, ShoppingCart, Search, User,
  Home as HomeIcon, FolderOpen, MapPin, Phone, Clock,
  Truck, CheckCircle2, CreditCard, RefreshCw, ChevronLeft, ChevronRight,
  ChevronDown, LogOut, ShoppingBag, Settings, HardHat,
  Cable, Power, ShieldCheck, Lightbulb, Wind, Smartphone, Cpu,
  Wrench, Droplets, Camera, Sun, Battery, Car, Sparkles, DoorOpen,
  LayoutGrid,
} from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { supabase } from '../../lib/supabase';
import CartSidebar from '../CartSidebar';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/* ── Category icon map (component references) ── */
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

const CatIcon = ({ name, size = 16, color = 'currentColor' }) => {
  const Icon = CAT_ICONS[name] || Package;
  return <Icon size={size} color={color} />;
};

/* ─── Mobile Category Drawer ────────────────────────────────── */
function MobileDrawer({ open, onClose, categories, subcategories, products, navigate }) {
  const [activeCat, setActiveCat] = useState(null);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const goToCat = (catId) => {
    window.dispatchEvent(new CustomEvent('lata:cat', { detail: catId }));
    navigate(`/products?cat=${catId}`);
    onClose();
  };

  const subcats = activeCat
    ? subcategories.filter(s => s.category_id === activeCat.id).sort((a,b) => a.sort_order - b.sort_order)
    : [];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 800, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .25s' }} />
      <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '85vw', maxWidth: 340, background: '#fff', zIndex: 801, display: 'flex', flexDirection: 'column', transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)', boxShadow: '4px 0 24px rgba(0,0,0,.15)' }}>

        {/* Header */}
        <div style={{ background: '#1E88E5', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          {activeCat ? (
            <button onClick={() => setActiveCat(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChevronLeft size={18} /> Back
            </button>
          ) : (
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LayoutGrid size={16} /> All Categories
            </span>
          )}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!activeCat ? (
            <>
              <div onClick={() => { navigate('/products'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid #F8F9FA', cursor: 'pointer', background: '#E3F2FD' }}>
                <Package size={18} color="#1E88E5" />
                <span style={{ fontWeight: 700, color: '#1E88E5', fontSize: 14 }}>All Products</span>
              </div>
              {categories.map(c => {
                const count = subcategories.filter(s => s.category_id === c.id).length;
                return (
                  <div key={c.id}
                    onClick={() => count > 0 ? setActiveCat(c) : goToCat(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid #F8F9FA', cursor: 'pointer' }}>
                    <span style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CatIcon name={c.name} size={18} color="#555" />
                    </span>
                    <span style={{ flex: 1, fontSize: 14, color: '#222' }}>{c.name}</span>
                    {count > 0 && <ChevronRight size={16} color="#bbb" />}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div onClick={() => goToCat(activeCat.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#E3F2FD', borderBottom: '1px solid #dce9f8', cursor: 'pointer' }}>
                <CatIcon name={activeCat.name} size={20} color="#1E88E5" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#1E88E5' }}>{activeCat.name}</div>
                  <div style={{ fontSize: 11, color: '#9aa5b1' }}>View all {products.filter(p=>p.category_id===activeCat.id).length} products →</div>
                </div>
              </div>
              {subcats.map((group, gi) => (
                <div key={gi} style={{ padding: '12px 16px', borderBottom: '1px solid #F8F9FA' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#212529', marginBottom: 8 }}>{group.header}</div>
                  {(group.items || []).map(item => (
                    <div key={item}
                      onClick={() => { navigate(`/products?cat=${activeCat.id}&q=${encodeURIComponent(item)}`); onClose(); }}
                      style={{ padding: '6px 0', fontSize: 13, color: '#555', cursor: 'pointer', borderBottom: '1px solid #f9f9f9' }}
                      onMouseEnter={e => e.currentTarget.style.color='#1E88E5'}
                      onMouseLeave={e => e.currentTarget.style.color='#555'}>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
              {subcats.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: '#bbb', fontSize: 13 }}>No subcategories — click header to view all products</div>
              )}
            </>
          )}
        </div>

        {/* Bottom nav links */}
        <div style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0 }}>
          {[
            { to: '/',             Icon: HomeIcon,  label: 'Home' },
            { to: '/flash-sale',   Icon: Zap,       label: 'Flash Sale' },
            { to: '/electricians', Icon: HardHat,   label: 'Electricians' },
            { to: '/account',      Icon: Package,   label: 'My Orders' },
            { to: '/wishlist',     Icon: Heart,     label: 'Wishlist' },
          ].map(({ to, Icon, label }) => (
            <div key={to} onClick={() => { navigate(to); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: 14, color: '#333' }}>
              <Icon size={18} color="#555" /><span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Desktop Mega Menu ─────────────────────────────────────── */
function MegaMenu({ categories, products, subcategories, onClose, navigate }) {
  const [activeCat, setActiveCat] = useState(categories[0] || null);
  const hoverTimer = useRef(null);
  const flashProds = products.filter(p => p.flash_sale && p.flash_price);

  const handleCatHover = (cat) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActiveCat(cat), 80);
  };

  const goToCat = (catId, searchTerm) => {
    navigate(searchTerm ? `/products?cat=${catId}&q=${encodeURIComponent(searchTerm)}` : `/products?cat=${catId}`);
    window.dispatchEvent(new CustomEvent('lata:cat', { detail: catId }));
    onClose();
  };

  const subcats = activeCat
    ? subcategories.filter(s => s.category_id === activeCat.id).sort((a,b) => a.sort_order - b.sort_order)
    : [];

  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: '#fff', borderRadius: '0 0 12px 12px', boxShadow: '0 20px 60px rgba(0,0,0,.18)', display: 'flex', width: 'min(1060px, 90vw)', border: '1px solid #e8e8e8', borderTop: '3px solid #1E88E5', overflow: 'hidden' }}
      onMouseLeave={onClose}>

      {/* Left category list */}
      <div style={{ width: 220, background: '#fafafa', borderRight: '1px solid #efefef', flexShrink: 0, overflowY: 'auto', maxHeight: 480 }}>
        {categories.map(c => {
          const isActive = activeCat?.id === c.id;
          return (
            <div key={c.id} onMouseEnter={() => handleCatHover(c)} onClick={() => goToCat(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 10px 12px', cursor: 'pointer', background: isActive ? '#fff' : 'transparent', borderLeft: `3px solid ${isActive ? '#1E88E5' : 'transparent'}`, transition: 'all .1s' }}>
              <span style={{ flexShrink: 0, width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CatIcon name={c.name} size={16} color={isActive ? '#1E88E5' : '#666'} />
              </span>
              <span style={{ fontSize: 13, color: isActive ? '#1E88E5' : '#2d2d2d', fontWeight: isActive ? 700 : 400, flex: 1, lineHeight: 1.3 }}>{c.name}</span>
              <ChevronRight size={14} color={isActive ? '#1E88E5' : '#bbb'} />
            </div>
          );
        })}
        <div onClick={() => { navigate('/products'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', cursor: 'pointer', borderTop: '1px solid #efefef', color: '#1E88E5', fontSize: 12, fontWeight: 700 }}>
          View All Categories <ChevronRight size={14} />
        </div>
      </div>

      {/* Middle: subcategory panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: 480 }}>
        {activeCat && (
          <>
            <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid #f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafeff', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CatIcon name={activeCat.name} size={18} color="#1E88E5" />
                <span style={{ fontWeight: 800, fontSize: 15, color: '#212529' }}>{activeCat.name}</span>
                <span style={{ fontSize: 11, color: '#9aa5b1', background: '#F8F9FA', padding: '2px 8px', borderRadius: 12 }}>
                  {products.filter(p => p.category_id === activeCat.id).length} products
                </span>
              </div>
              <button onClick={() => goToCat(activeCat.id)} style={{ fontSize: 12, color: '#1E88E5', background: '#E3F2FD', border: 'none', borderRadius: 14, padding: '4px 14px', cursor: 'pointer', fontWeight: 700 }}>View All →</button>
            </div>

            {subcats.length > 0 ? (
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 24px', flex: 1 }}>
                {subcats.map((group, gi) => (
                  <div key={gi} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#212529', marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid #f4f4f4' }}>{group.header}</div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {(group.items || []).map(item => (
                        <li key={item}>
                          <span onClick={() => goToCat(activeCat.id)}
                            style={{ display: 'block', fontSize: 12.5, color: '#555', padding: '3px 0', cursor: 'pointer', lineHeight: 1.5, transition: 'color .12s' }}
                            onMouseEnter={e => e.currentTarget.style.color='#1E88E5'}
                            onMouseLeave={e => e.currentTarget.style.color='#555'}>
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {products.filter(p => p.category_id === activeCat.id).slice(0, 8).map(p => {
                  const price = p.flash_sale && p.flash_price ? p.flash_price : p.price;
                  return (
                    <div key={p.id} onClick={() => { navigate(`/products/${p.id}`); onClose(); }}
                      style={{ cursor: 'pointer', borderRadius: 8, border: '1px solid #f0f0f0', overflow: 'hidden', transition: 'box-shadow .15s' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
                      <div style={{ height: 80, background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                        {p.image ? <img src={p.image} alt={p.name} style={{ maxWidth:'100%',maxHeight:'100%',objectFit:'contain' }} /> : <Package size={28} color="#ccc" />}
                      </div>
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: '#444', lineHeight: 1.3, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: p.flash_sale ? '#1E88E5' : '#212529' }}>৳{price.toLocaleString('en-BD')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: promo panel */}
      <div style={{ width: 190, borderLeft: '1px solid #efefef', padding: '14px 12px', background: '#fafafa', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div onClick={() => { navigate('/flash-sale'); onClose(); }}
          style={{ background: 'linear-gradient(135deg,#7b0000,#DC3545)', borderRadius: 10, padding: '14px 12px', cursor: 'pointer', color: '#fff', position: 'relative', overflow: 'hidden', minHeight: 120 }}>
          <div style={{ position: 'absolute', right: -6, top: -6, opacity: .1 }}><Zap size={70} fill="currentColor" /></div>
          <div style={{ fontSize: 10, fontWeight: 700, opacity: .85, letterSpacing: .8, textTransform: 'uppercase', marginBottom: 6 }}>Limited Time</div>
          <div style={{ fontWeight: 900, fontSize: 20, lineHeight: 1.1, marginBottom: 4 }}>Flash Sale</div>
          <div style={{ fontSize: 11, opacity: .85, marginBottom: 12 }}>{flashProds.length} deals live!</div>
          <div style={{ background: '#fff', color: '#DC3545', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 800, display: 'inline-block' }}>Shop Now →</div>
        </div>
        <div onClick={() => { navigate('/products'); onClose(); }}
          style={{ background: 'linear-gradient(135deg,#212529,#1565C0)', borderRadius: 10, padding: '14px 12px', cursor: 'pointer', color: '#fff', position: 'relative', overflow: 'hidden', minHeight: 120 }}>
          <div style={{ position: 'absolute', right: -6, top: -6, opacity: .1 }}><Package size={70} /></div>
          <div style={{ fontSize: 10, fontWeight: 700, opacity: .7, letterSpacing: .8, textTransform: 'uppercase', marginBottom: 6 }}>Fast & Free Shipping</div>
          <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2, marginBottom: 4 }}>Fresh Deals<br />Arrive</div>
          <div style={{ background: '#1E88E5', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 800, display: 'inline-block', marginTop: 8 }}>Get It Today →</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Layout ─────────────────────────────────────────────────── */
export default function CustomerLayout({ children }) {
  const { isMobile, isTablet } = useBreakpoint();
  const { user, signOut }      = useCustomerAuth();
  const cartCount = useCartStore(s => s.items.reduce((a, i) => a + i.qty, 0));
  const [search, setSearch]             = useState('');
  const [categories, setCategories]     = useState([]);
  const [products, setProducts]         = useState([]);
  const [subcategories,setSubcategories]= useState([]);
  const [branding, setBranding]         = useState({});
  const [cartOpen, setCartOpen]         = useState(false);
  const [megaOpen, setMegaOpen]         = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [showSugg, setShowSugg]         = useState(false);
  const [activeSugg, setActiveSugg]     = useState(-1);
  const [userMenuOpen,    setUserMenuOpen]    = useState(false);
  const [contactOpen,     setContactOpen]     = useState(false);
  const [showScrollTop,   setShowScrollTop]   = useState(false);
  const megaRef    = useRef(null);
  const megaTimer  = useRef(null);
  const searchRef  = useRef(null);
  const userMenuRef = useRef(null);
  const navigate   = useNavigate();
  const isCompact  = isMobile || isTablet;

  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.first_name
    || user?.email?.split('@')[0]
    || 'Account';
  const initial = (displayName[0] || 'A').toUpperCase();

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
      supabase.from('products').select('id, name, price, image, category_id, flash_sale, flash_price, stock').eq('is_active', true),
      supabase.from('subcategories').select('*').order('sort_order'),
      supabase.from('settings').select('logo_url,logo_bg_color,store_name_bn,store_tagline,site_name,phone,address,hours,whatsapp,facebook').eq('id',1).maybeSingle(),
    ]).then(([cRes, pRes, sRes, bRes]) => {
      setCategories(cRes.data || []);
      setProducts(pRes.data || []);
      setSubcategories(sRes.data || []);
      setBranding(bRes.data || {});
    });
  }, []);

  useEffect(() => {
    const handler = () => setCartOpen(true);
    window.addEventListener('lata:open-cart', handler);
    return () => window.removeEventListener('lata:open-cart', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (megaRef.current && !megaRef.current.contains(e.target)) setMegaOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openMega  = () => { clearTimeout(megaTimer.current); setMegaOpen(true); };
  const closeMega = () => { megaTimer.current = setTimeout(() => setMegaOpen(false), 180); };

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSugg(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = (() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    const prodMatches = products
      .filter(p => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q))
      .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1))
      .slice(0, 6)
      .map(p => ({ type: 'product', id: p.id, label: p.name, sub: `৳${(p.flash_sale && p.flash_price ? p.flash_price : p.price).toLocaleString('en-BD')}`, image: p.image, flash: p.flash_sale }));
    const catMatches = categories
      .filter(c => c.name.toLowerCase().includes(q)).slice(0, 3)
      .map(c => ({ type: 'category', id: c.id, label: c.name, sub: 'Browse category' }));
    return [...catMatches, ...prodMatches].slice(0, 8);
  })();

  const commitSuggestion = (item) => {
    setSearch(''); setShowSugg(false); setActiveSugg(-1); setSearchOpen(false);
    if (item.type === 'product') navigate(`/products/${item.id}`);
    else navigate(`/products?cat=${item.id}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (activeSugg >= 0 && suggestions[activeSugg]) { commitSuggestion(suggestions[activeSugg]); return; }
    if (search.trim()) { navigate(`/products?q=${encodeURIComponent(search.trim())}`); setSearch(''); setShowSugg(false); setSearchOpen(false); }
  };

  const handleSearchKey = (e) => {
    if (!showSugg || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSugg(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSugg(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') { setShowSugg(false); setActiveSugg(-1); }
  };

  /* ─── Suggestions dropdown (shared) ── */
  const SuggDropdown = ({ mobile = false }) => (
    <div style={{ position: 'absolute', top: mobile ? 'calc(100% - 2px)' : 'calc(100% + 4px)', left: mobile ? 10 : 0, right: mobile ? 10 : 0, background: '#fff', borderRadius: mobile ? '0 0 10px 10px' : 10, boxShadow: '0 8px 32px rgba(0,0,0,.15)', border: '1px solid #e8ecf0', zIndex: 500, overflow: 'hidden', ...(mobile ? { borderTop: 'none', maxHeight: '50vh', overflowY: 'auto' } : {}) }}>
      {suggestions.length === 0 ? (
        <div style={{ padding: '14px 16px', fontSize: 13, color: '#9aa5b1', textAlign: 'center' }}>No results for "{search}"</div>
      ) : (
        <>
          {suggestions.map((item, i) => (
            <div key={`${item.type}-${item.id}`}
              onMouseDown={() => commitSuggestion(item)}
              onMouseEnter={() => setActiveSugg(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: mobile ? '10px 12px' : '9px 14px', cursor: 'pointer', background: activeSugg === i ? '#E3F2FD' : '#fff', borderBottom: '1px solid #f8f9fa', transition: 'background .1s' }}>
              {item.type === 'product' ? (
                <div style={{ width: mobile ? 32 : 36, height: mobile ? 32 : 36, background: '#f8f9fa', borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} /> : <Package size={mobile ? 16 : 18} color="#ccc" />}
                </div>
              ) : (
                <div style={{ width: mobile ? 32 : 36, height: mobile ? 32 : 36, background: '#E3F2FD', borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FolderOpen size={mobile ? 16 : 18} color="#1E88E5" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#212529', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label.toLowerCase().includes(search.toLowerCase()) ? (() => {
                    const idx = item.label.toLowerCase().indexOf(search.toLowerCase());
                    return <>{item.label.slice(0, idx)}<mark style={{ background: '#fff3cd', padding: 0, borderRadius: 2 }}>{item.label.slice(idx, idx + search.length)}</mark>{item.label.slice(idx + search.length)}</>;
                  })() : item.label}
                </div>
                <div style={{ fontSize: 11, color: item.type === 'product' ? (item.flash ? '#DC3545' : '#1E88E5') : '#9aa5b1', fontWeight: item.type === 'product' ? 700 : 400 }}>{item.sub}</div>
              </div>
              <ChevronRight size={14} color="#ccc" />
            </div>
          ))}
          <div onMouseDown={handleSearch} style={{ padding: '9px 14px', background: '#F8F9FA', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1E88E5', fontWeight: 600, borderTop: '1px solid #e8ecf0' }}>
            <Search size={14} /> Search all results for "<strong>{search}</strong>"
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Hind Siliguri', 'Segoe UI', sans-serif", background: '#F8F9FA' }}>

      {/* Top info bar */}
      {!isMobile && (
        <div style={{ background: '#212529', color: '#9aa5b1', fontSize: 12, padding: '5px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={12} /> {branding.address || 'Ka/6 Nadda, Gulshan, Dhaka-1212'}</span>
          <span style={{ opacity: .4 }}>|</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={12} /> {branding.phone || '01700-000000'}</span>
          <span style={{ opacity: .4 }}>|</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={12} /> {branding.hours || 'Sat–Thu: 9am–8pm'}</span>
        </div>
      )}

      {/* Header */}
      <header style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.08)', position: 'sticky', top: 0, zIndex: 300 }}>

        {/* Main row */}
        <div style={{ maxWidth: 1260, margin: '0 auto', padding: isMobile ? '0 10px' : '0 16px', height: isMobile ? 54 : 64, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>

          {isMobile && (
            <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <Menu size={24} />
            </button>
          )}

          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="logo"
                style={{ height: isMobile ? 38 : 52, width: 'auto', maxWidth: isMobile ? 130 : 210, objectFit: 'contain', display: 'block' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 7 : 10 }}>
                <div style={{ width: isMobile ? 34 : 42, height: isMobile ? 34 : 42, background: branding.logo_bg_color || '#1E88E5', borderRadius: isMobile ? 8 : 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={isMobile ? 18 : 22} color="#fff" fill="#fff" />
                </div>
                {!isMobile && (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#212529', lineHeight: 1.15 }}>{branding.store_name_bn || 'লতা ইলেকট্রিক'}</div>
                    <div style={{ fontSize: 10, color: '#9aa5b1' }}>{branding.store_tagline || 'Lata Electric'}</div>
                  </div>
                )}
              </div>
            )}
          </Link>

          {/* Search */}
          {!isMobile ? (
            <div ref={searchRef} style={{ flex: 1, maxWidth: 560, position: 'relative' }}>
              <form onSubmit={handleSearch} style={{ display: 'flex' }}>
                <input value={search}
                  onChange={e => { setSearch(e.target.value); setShowSugg(true); setActiveSugg(-1); }}
                  onFocus={() => setShowSugg(true)}
                  onKeyDown={handleSearchKey}
                  placeholder="Search products, brands…"
                  style={{ flex: 1, padding: '10px 16px', border: '2px solid #e0e0e0', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 14, outline: 'none', transition: 'border-color .2s', borderColor: showSugg && search ? '#1E88E5' : '#e0e0e0' }}
                  onBlur={e => { if (!searchRef.current?.contains(e.relatedTarget)) setTimeout(() => setShowSugg(false), 150); }}
                />
                <button type="submit" style={{ padding: '10px 20px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: '0 8px 8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={18} />
                </button>
              </form>
              {showSugg && search.trim().length > 0 && <SuggDropdown />}
            </div>
          ) : (
            <button onClick={() => setSearchOpen(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <Search size={22} />
            </button>
          )}

          {/* Right icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 2, marginLeft: 'auto' }}>
            {!isMobile && (
              <>
                {[
                  { to: '/flash-sale', Icon: Zap,   label: 'Flash Sale', highlight: true },
                  { to: '/wishlist',   Icon: Heart,  label: 'Wishlist' },
                ].map(({ to, Icon, label, highlight }) => (
                  <Link key={to} to={to} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: highlight ? '#1E88E5' : '#666', fontSize: 10, padding: '4px 10px', fontWeight: highlight ? 700 : 400, gap: 2 }}
                    onMouseEnter={e => e.currentTarget.style.color=highlight?'#1565C0':'#212529'}
                    onMouseLeave={e => e.currentTarget.style.color=highlight?'#1E88E5':'#666'}>
                    <Icon size={20} />
                    {label}
                  </Link>
                ))}

                {/* ── User account dropdown ── */}
                <div ref={userMenuRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setUserMenuOpen(v => !v)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: userMenuOpen ? '#1E88E5' : '#666', fontSize: 10, padding: '4px 10px', gap: 2, fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.color='#212529'}
                    onMouseLeave={e => e.currentTarget.style.color=userMenuOpen?'#1E88E5':'#666'}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {user ? (
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1E88E5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{initial}</div>
                      ) : (
                        <User size={20} />
                      )}
                      <ChevronDown size={10} style={{ transition: 'transform .2s', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }} />
                    </div>
                    {user ? displayName.split(' ')[0] : 'Account'}
                  </button>

                  {userMenuOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.14)', border: '1px solid #E5E7EB', minWidth: 228, zIndex: 450, overflow: 'hidden' }}>
                      {!user ? (
                        <>
                          <div style={{ padding: '18px 20px 14px' }}>
                            <div style={{ fontWeight: 800, fontSize: 17, color: '#0F172A', marginBottom: 4 }}>Welcome!</div>
                            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.4 }}>Sign in to access your account</div>
                          </div>
                          <div style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                            <Link to="/login" onClick={() => setUserMenuOpen(false)}
                              style={{ display: 'block', textAlign: 'center', padding: '11px', background: '#1E88E5', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14, transition: 'background .15s' }}
                              onMouseEnter={e => e.currentTarget.style.background='#1565C0'}
                              onMouseLeave={e => e.currentTarget.style.background='#1E88E5'}>
                              Sign In
                            </Link>
                            <Link to="/login?tab=signup" onClick={() => setUserMenuOpen(false)}
                              style={{ display: 'block', textAlign: 'center', padding: '11px', background: '#fff', color: '#1E88E5', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14, border: '1.5px solid #1E88E5', transition: 'all .15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background='#EFF6FF'; }}
                              onMouseLeave={e => { e.currentTarget.style.background='#fff'; }}>
                              Create Account
                            </Link>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F3F4F6' }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1E88E5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{initial}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                              <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                            </div>
                          </div>
                          <div style={{ padding: '6px 0' }}>
                            {[
                              { to: '/account',    Icon: ShoppingBag, label: 'My Orders' },
                              { to: '/wishlist',   Icon: Heart,       label: 'Wishlist' },
                            ].map(({ to, Icon, label }) => (
                              <Link key={to} to={to} onClick={() => setUserMenuOpen(false)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', textDecoration: 'none', color: '#374151', fontSize: 14, transition: 'background .12s' }}
                                onMouseEnter={e => e.currentTarget.style.background='#F9FAFB'}
                                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                <Icon size={16} color="#6B7280" />{label}
                              </Link>
                            ))}
                          </div>
                          <div style={{ borderTop: '1px solid #F3F4F6', padding: '6px 0 6px' }}>
                            <button onClick={async () => { await signOut(); setUserMenuOpen(false); navigate('/'); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 14, width: '100%', fontFamily: 'inherit', transition: 'background .12s' }}
                              onMouseEnter={e => e.currentTarget.style.background='#FEF2F2'}
                              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                              <LogOut size={16} /> Sign Out
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {isMobile && (
              <button onClick={() => user ? navigate('/account') : navigate('/login')}
                style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: '#444', display: 'flex', alignItems: 'center' }}>
                {user ? (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1E88E5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{initial}</div>
                ) : (
                  <User size={22} />
                )}
              </button>
            )}
            <button onClick={() => setCartOpen(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#666', fontSize: 10, padding: isMobile ? '4px 6px' : '4px 10px', position: 'relative', background: 'none', border: 'none', cursor: 'pointer', gap: 2 }}>
              <ShoppingCart size={isMobile ? 22 : 20} />
              {!isMobile && 'Cart'}
              {cartCount > 0 && (
                <span style={{ position: 'absolute', top: 0, right: isMobile ? 0 : 4, background: '#DC3545', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search expandable */}
        {isMobile && searchOpen && (
          <div ref={searchRef} style={{ padding: '8px 10px', borderTop: '1px solid #f0f0f0', position: 'relative' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex' }}>
              <input value={search}
                onChange={e => { setSearch(e.target.value); setShowSugg(true); setActiveSugg(-1); }}
                onKeyDown={handleSearchKey}
                placeholder="Search products, brands…" autoFocus
                style={{ flex: 1, padding: '9px 12px', border: '2px solid #1E88E5', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 14, outline: 'none' }} />
              <button type="submit" style={{ padding: '9px 16px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: '0 8px 8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Search size={16} />
              </button>
            </form>
            {showSugg && search.trim().length > 0 && suggestions.length > 0 && <SuggDropdown mobile />}
          </div>
        )}

        {/* Nav bar (desktop/tablet) */}
        {!isMobile && (
          <div style={{ background: '#1E88E5', borderTop: '1px solid #1565C0' }}>
            <div style={{ maxWidth: 1260, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'stretch', height: 42 }}>
              <div ref={megaRef} style={{ position: 'relative', flexShrink: 0 }} onMouseEnter={openMega} onMouseLeave={closeMega}>
                <button style={{ height: '100%', padding: '0 18px', background: megaOpen ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <Menu size={18} /> All Categories <ChevronRight size={14} style={{ opacity: .8, transform: megaOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                </button>
                {megaOpen && categories.length > 0 && (
                  <MegaMenu categories={categories} products={products} subcategories={subcategories} onClose={() => setMegaOpen(false)} navigate={navigate} />
                )}
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,.2)', margin: '8px 4px' }} />
              {[
                { to: '/', label: 'Home' },
                { to: '/products', label: 'All Products' },
                { to: '/flash-sale', label: 'Flash Sale', Icon: Zap },
                { to: '/electricians', label: 'Electricians', Icon: HardHat },
              ].map(({ to, label, Icon }) => (
                <button key={to} onClick={() => navigate(to)}
                  style={{ padding: '0 16px', background: 'none', border: 'none', color: 'rgba(255,255,255,.9)', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(0,0,0,.15)'; e.currentTarget.style.color='#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='rgba(255,255,255,.9)'; }}>
                  {Icon && <Icon size={14} fill={to === '/flash-sale' ? 'currentColor' : 'none'} />}{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile nav strip */}
        {isMobile && (
          <div style={{ background: '#1E88E5', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }} className="hide-scrollbar">
            {[
              { to: '/',             Icon: HomeIcon,  label: 'Home' },
              { to: '/products',     Icon: Package,   label: 'All' },
              { to: '/flash-sale',   Icon: Zap,       label: 'Flash' },
              { to: '/electricians', Icon: HardHat,   label: 'Electricians' },
              { to: '/account',      Icon: User,      label: 'Orders' },
            ].map(({ to, Icon, label }) => (
              <button key={to} onClick={() => navigate(to)}
                style={{ padding: '7px 14px', background: 'none', border: 'none', color: 'rgba(255,255,255,.9)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        )}
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} categories={categories} subcategories={subcategories} products={products} navigate={navigate} />
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />
      <main style={{ flex: 1 }}>{children}</main>

      {/* Footer */}
      <footer style={{ background: '#212529', color: '#9aa5b1', padding: isMobile ? '24px 16px 80px' : '32px 16px 16px', marginTop: 8 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 20 : 24, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, background: branding.logo_bg_color || '#1E88E5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {branding.logo_url ? <img src={branding.logo_url} alt="logo" style={{ width:'100%',height:'100%',objectFit:'contain',padding:2 }} /> : <Zap size={16} color="#fff" fill="#fff" />}
                </div>
                <span style={{ color: '#fff', fontWeight: 700 }}>{branding.store_name_bn || 'লতা ইলেকট্রিক'}</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>Your trusted electrical & hardware shop in Gulshan, Dhaka.</p>
            </div>
            {!isMobile && (
              <div>
                <div style={{ color: '#fff', fontWeight: 600, marginBottom: 10 }}>Quick Links</div>
                {[['/', 'Home'], ['/flash-sale', 'Flash Sale'], ['/electricians', 'Electricians'], ['/account', 'My Orders']].map(([to, label]) => (
                  <div key={to} style={{ marginBottom: 6 }}>
                    <Link to={to} style={{ color: '#9aa5b1', textDecoration: 'none', fontSize: 13 }}>{label}</Link>
                  </div>
                ))}
              </div>
            )}
            <div>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: 10 }}>Contact</div>
              <div style={{ fontSize: 13, lineHeight: 2.2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={13} /> {branding.address || 'Ka/6 Nadda, Gulshan, Dhaka-1212'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={13} /> {branding.phone || '01700-000000'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={13} /> {branding.hours || 'Sat–Thu: 9am–8pm'}</div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #343A40', paddingTop: 14, textAlign: 'center', fontSize: 12 }}>
            © {new Date().getFullYear()} {branding.store_name_bn || 'লতা ইলেকট্রিক'} — All rights reserved
          </div>
        </div>
      </footer>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e0e0e0', display: 'flex', zIndex: 400, boxShadow: '0 -4px 16px rgba(0,0,0,.1)' }}>
          {[
            { to: '/',          Icon: HomeIcon,     label: 'Home',     onClick: null },
            { to: '/products',  Icon: Package,      label: 'Products', onClick: null },
            { to: null,         Icon: Menu,         label: 'Menu',     onClick: () => setDrawerOpen(true) },
            { to: user ? '/account' : '/login', Icon: User, label: user ? displayName.split(' ')[0] : 'Sign In', onClick: null },
            { to: null,         Icon: ShoppingCart, label: 'Cart',     onClick: () => setCartOpen(true), badge: cartCount },
          ].map(({ to, Icon, label, onClick, badge }) => (
            <button key={label}
              onClick={onClick || (() => navigate(to))}
              style={{ flex: 1, padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10, color: '#666', position: 'relative' }}>
              <Icon size={20} />
              {label}
              {badge > 0 && (
                <span style={{ position: 'absolute', top: 4, left: '55%', background: '#1E88E5', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>

      {/* ── Floating buttons ── */}
      <div style={{ position: 'fixed', bottom: isMobile ? 76 : 24, right: 16, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>

        {/* Contact popup */}
        {contactOpen && (
          <>
            <div onClick={() => setContactOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 498 }} />
            <div style={{ position: 'absolute', bottom: 110, right: 0, background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,.18)', width: 280, zIndex: 499, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>Contact us</span>
                <button onClick={() => setContactOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa5b1', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
              </div>
              <div style={{ padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  branding.whatsapp && {
                    label: 'WhatsApp',
                    sub: 'Chat with us instantly',
                    bg: '#25D366',
                    href: `https://wa.me/${(branding.whatsapp || '').replace(/[^+\d]/g, '')}`,
                    icon: (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.555 4.118 1.528 5.847L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.904-1.345l-.352-.208-3.624.945.974-3.521-.228-.361A9.6 9.6 0 012.4 12c0-5.293 4.307-9.6 9.6-9.6s9.6 4.307 9.6 9.6-4.307 9.6-9.6 9.6z"/></svg>
                    ),
                  },
                  branding.facebook && {
                    label: 'Messenger',
                    sub: 'Chat on Facebook',
                    bg: '#0099FF',
                    href: `https://m.me/${branding.facebook.replace(/.*facebook\.com\//,'').replace(/\//,'')}`,
                    icon: (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M12 0C5.373 0 0 5.18 0 11.573c0 3.636 1.822 6.874 4.667 9.007V24l4.253-2.34c1.136.315 2.34.484 3.58.484 6.627 0 12-5.18 12-11.571S18.627 0 12 0zm1.193 15.567l-3.056-3.26-5.963 3.26L10.986 8.4l3.13 3.26 5.89-3.26-6.813 7.167z"/></svg>
                    ),
                  },
                  branding.phone && {
                    label: 'Call Us',
                    sub: branding.phone,
                    bg: '#C0143C',
                    href: `tel:${(branding.phone || '').replace(/[^+\d]/g, '')}`,
                    icon: (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.82 19.79 19.79 0 01.01 1.18 2 2 0 012 .01h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/></svg>
                    ),
                  },
                ].filter(Boolean).map(({ label, sub, bg, href, icon }) => (
                  <a key={label} href={href} target={label !== 'Call Us' ? '_blank' : undefined} rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 10px', borderRadius: 10, border: '1px solid #F3F4F6', textDecoration: 'none', background: '#fff', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{label}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{sub}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Scroll to top */}
        {showScrollTop && (
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ width: 44, height: 44, borderRadius: '50%', background: '#1E88E5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(30,136,229,.4)', transition: 'transform .15s, background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background='#1565C0'}
            onMouseLeave={e => e.currentTarget.style.background='#1E88E5'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
        )}

        {/* Chat button */}
        <button onClick={() => setContactOpen(v => !v)}
          style={{ width: 52, height: 52, borderRadius: '50%', background: '#1E88E5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(30,136,229,.45)', transition: 'transform .15s, background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background='#1565C0'}
          onMouseLeave={e => e.currentTarget.style.background='#1E88E5'}>
          {contactOpen
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          }
        </button>
      </div>
    </div>
  );
}
