import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Package, Zap, ShoppingCart, LayoutGrid, List } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductCard from '../../components/ProductCard';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/cartStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest Arrivals' },
  { value: 'popular',    label: 'Most Popular' },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'name_asc',   label: 'Name A–Z' },
];

const PRICE_RANGES = [
  { label: 'All Prices',     min: 0,    max: Infinity },
  { label: 'Under ৳500',     min: 0,    max: 500 },
  { label: '৳500 – ৳1,000', min: 500,  max: 1000 },
  { label: '৳1,000 – ৳2,500',min:1000, max: 2500 },
  { label: '৳2,500 – ৳5,000',min:2500, max: 5000 },
  { label: 'Above ৳5,000',   min: 5000, max: Infinity },
];

const PER_PAGE = 20;

/* ─── Sidebar radio row ─────────────────────────────────────── */
function RadioRow({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', cursor: 'pointer', fontSize: 13, color: checked ? '#1E88E5' : '#444' }}>
      <span style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${checked ? '#1E88E5' : '#ccc'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: checked ? '#1E88E5' : '#fff', transition: 'all .15s' }}>
        {checked && <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', display: 'block' }} />}
      </span>
      <input type="radio" checked={checked} onChange={onChange} style={{ display: 'none' }} />
      <span style={{ fontWeight: checked ? 600 : 400 }}>{label}</span>
    </label>
  );
}

/* ─── Section header in sidebar ─────────────────────────────── */
function SidebarSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#212529', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function AllProducts() {
  const [searchParams] = useSearchParams();
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;

  const [search,     setSearch]     = useState(searchParams.get('q') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [catFilter,  setCatFilter]  = useState(searchParams.get('cat') || 'all');
  const [brandFilter,setBrandFilter]= useState('all');
  const [brandSearch,setBrandSearch]= useState('');
  const [priceRange, setPriceRange] = useState(0); // index into PRICE_RANGES
  const [sort,       setSort]       = useState('newest');
  const [viewMode,   setViewMode]   = useState('grid'); // 'grid' | 'list'
  const [page,       setPage]       = useState(1);

  // Listen for category events from nav
  useEffect(() => {
    const handler = (e) => { setCatFilter(String(e.detail)); setPage(1); };
    window.addEventListener('lata:cat', handler);
    return () => window.removeEventListener('lata:cat', handler);
  }, []);

  useEffect(() => {
    const load = async () => {
      const [pRes, cRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
      ]);
      setProducts(pRes.data || []);
      setCategories(cRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  // Derived: unique brands
  const brands = useMemo(() => {
    const all = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
    if (!brandSearch) return all;
    return all.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [products, brandSearch]);

  // Filtered + sorted products
  const filtered = useMemo(() => {
    const range = PRICE_RANGES[priceRange];
    let list = [...products];
    if (catFilter !== 'all')   list = list.filter(p => p.category_id === +catFilter);
    if (brandFilter !== 'all') list = list.filter(p => p.brand === brandFilter);
    if (search)                list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand||'').toLowerCase().includes(search.toLowerCase()));
    list = list.filter(p => p.price >= range.min && p.price < range.max);
    list.sort((a, b) => {
      if (sort === 'price_asc')  return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'name_asc')   return a.name.localeCompare(b.name);
      if (sort === 'popular')    return (b.top_sell ? 1 : 0) - (a.top_sell ? 1 : 0);
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return list;
  }, [products, catFilter, brandFilter, search, priceRange, sort]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  const resetAll = () => { setCatFilter('all'); setBrandFilter('all'); setPriceRange(0); setSearch(''); setSearchInput(''); setSort('newest'); setPage(1); };
  const gotoPage = (n) => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const hasFilters = catFilter !== 'all' || brandFilter !== 'all' || priceRange !== 0 || search;

  const FilterPanel = ({ onApply }) => (
    <div>
      <SidebarSection title="Category">
        <div style={{ maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          <RadioRow label="All Categories" checked={catFilter === 'all'} onChange={() => { setCatFilter('all'); setPage(1); onApply?.(); }} />
          {categories.map(c => (
            <RadioRow key={c.id} label={c.name} checked={catFilter === String(c.id)}
              onChange={() => { setCatFilter(String(c.id)); setPage(1); onApply?.(); }} />
          ))}
        </div>
      </SidebarSection>
      {brands.length > 0 && (
        <SidebarSection title="Brand">
          <input value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder="Search brands..."
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor='#1E88E5'}
            onBlur={e => e.target.style.borderColor='#e0e0e0'} />
          <div style={{ maxHeight: 180, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            <RadioRow label="All Brands" checked={brandFilter === 'all'} onChange={() => { setBrandFilter('all'); setPage(1); }} />
            {brands.map(b => (
              <RadioRow key={b} label={b} checked={brandFilter === b} onChange={() => { setBrandFilter(b); setPage(1); }} />
            ))}
          </div>
        </SidebarSection>
      )}
      <SidebarSection title="Price Range">
        {PRICE_RANGES.map((r, i) => (
          <RadioRow key={r.label} label={r.label} checked={priceRange === i} onChange={() => { setPriceRange(i); setPage(1); }} />
        ))}
      </SidebarSection>
      <button onClick={() => { resetAll(); onApply?.(); }}
        style={{ width: '100%', padding: '10px', background: hasFilters ? '#1E88E5' : '#F8F9FA', color: hasFilters ? '#fff' : '#9aa5b1', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        {hasFilters ? '× Reset All Filters' : 'No Active Filters'}
      </button>
    </div>
  );

  return (
    <CustomerLayout>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>

      {/* Mobile filter drawer */}
      {isCompact && (
        <>
          <div onClick={() => setFilterDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 600, opacity: filterDrawerOpen ? 1 : 0, pointerEvents: filterDrawerOpen ? 'auto' : 'none', transition: 'opacity .25s' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', zIndex: 601, borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', transform: filterDrawerOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)', boxShadow: '0 -8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>≡</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#212529' }}>Filter & Sort</span>
                {hasFilters && <span style={{ background: '#1E88E5', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>{[catFilter!=='all',brandFilter!=='all',priceRange!==0,!!search].filter(Boolean).length} active</span>}
              </div>
              <button onClick={() => setFilterDrawerOpen(false)} style={{ background: '#F8F9FA', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#333' }}>Done</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <FilterPanel onApply={() => {}} />
            </div>
          </div>
        </>
      )}

      <div style={{ background: '#F8F9FA', minHeight: '100vh', paddingBottom: isCompact ? 80 : 32 }}>
        <div style={{ maxWidth: 1260, margin: '0 auto', padding: isCompact ? '10px 8px' : '16px 14px', display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '230px 1fr', gap: 14, alignItems: 'start' }}>

          {/* ══ SIDEBAR (desktop only) ══ */}
          {!isCompact && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', position: 'sticky', top: 78, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 16 }}>≡</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#212529' }}>Filter</span>
                </div>
                {hasFilters && (
                  <button onClick={resetAll} style={{ fontSize: 11, color: '#1E88E5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reset ×</button>
                )}
              </div>
              <div style={{ padding: '14px 16px', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
                <FilterPanel />
              </div>
            </div>
          )}

          {/* ══ MAIN CONTENT ══ */}
          <div>

            {/* Toolbar */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', padding: isCompact ? '8px 12px' : '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

              {/* Mobile: filter button */}
              {isCompact && (
                <button onClick={() => setFilterDrawerOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: hasFilters ? '#1E88E5' : '#F8F9FA', color: hasFilters ? '#fff' : '#333', border: `1px solid ${hasFilters ? '#1E88E5' : '#e0e0e0'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  <span>≡</span> Filter {hasFilters ? `(${[catFilter!=='all',brandFilter!=='all',priceRange!==0,!!search].filter(Boolean).length})` : ''}
                </button>
              )}

              {/* Sort */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!isCompact && <span style={{ fontSize: 13, color: '#7f8c9a', whiteSpace: 'nowrap' }}>Sort by</span>}
                <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
                  style={{ padding: isCompact ? '7px 10px' : '6px 28px 6px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none', fontWeight: 500, color: '#212529' }}>
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{isCompact ? o.label.replace('Newest Arrivals','Newest').replace('Most Popular','Popular').replace('Price: Low → High','↑ Price').replace('Price: High → Low','↓ Price').replace('Name A–Z','A–Z') : o.label}</option>)}
                </select>
              </div>

              {/* Filter chips */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1, overflow: 'hidden' }}>
                {catFilter !== 'all' && (
                  <span style={{ background: '#E3F2FD', color: '#1E88E5', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {categories.find(c=>String(c.id)===catFilter)?.name}
                    <button onClick={() => setCatFilter('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                )}
                {brandFilter !== 'all' && (
                  <span style={{ background: '#E3F2FD', color: '#1E88E5', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {brandFilter}
                    <button onClick={() => setBrandFilter('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                )}
                {priceRange !== 0 && (
                  <span style={{ background: '#E3F2FD', color: '#1E88E5', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {PRICE_RANGES[priceRange].label}
                    <button onClick={() => setPriceRange(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                )}
              </div>

              <span style={{ fontSize: 12, color: '#9aa5b1', whiteSpace: 'nowrap', marginLeft: 'auto', flexShrink: 0 }}>
                <strong style={{ color: '#212529' }}>{filtered.length}</strong> items
              </span>

              {/* Grid/List toggle — desktop only */}
              {!isCompact && (
                <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
                  {[{ mode: 'grid', Icon: LayoutGrid }, { mode: 'list', Icon: List }].map(({ mode, Icon }) => (
                    <button key={mode} onClick={() => setViewMode(mode)}
                      style={{ padding: '6px 11px', border: 'none', background: viewMode === mode ? '#1E88E5' : '#fff', color: viewMode === mode ? '#fff' : '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .15s' }}>
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Products */}
            {loading ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 80, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #f0f0f0', borderTop: '4px solid #1E88E5', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
              </div>

            ) : paginated.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: '60px 0', textAlign: 'center', color: '#9aa5b1' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Search size={56} color="#ccc" /></div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#333' }}>No products found</div>
                <div style={{ fontSize: 13, marginBottom: 20 }}>Try adjusting your filters or search.</div>
                <button onClick={resetAll} style={{ padding: '10px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Reset Filters</button>
              </div>

            ) : (isCompact || viewMode === 'grid') ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'repeat(2,1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: isCompact ? 8 : 12 }}>
                  {paginated.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
                <Pagination page={page} totalPages={totalPages} gotoPage={gotoPage} />
              </>

            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {paginated.map(p => <ListCard key={p.id} product={p} />)}
                </div>
                <Pagination page={page} totalPages={totalPages} gotoPage={gotoPage} />
              </>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}

/* ─── List view card ─────────────────────────────────────────── */
function ListCard({ product: p }) {
  const { add } = useCartStore();
  const navigate = useNavigate();
  const price    = p.flash_sale && p.flash_price ? p.flash_price : p.price;
  const orig     = p.flash_sale && p.flash_price ? p.price : p.original_price;
  const disc     = orig && orig > price ? Math.round((1 - price / orig) * 100) : null;
  const inStock  = p.stock > 0;

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', display: 'flex', gap: 16, padding: 14, transition: 'box-shadow .2s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>

      <div onClick={() => navigate(`/products/${p.id}`)}
        style={{ width: 120, height: 120, background: '#f8f9fa', borderRadius: 10, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} /> : <Package size={40} color="#ccc" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {p.brand && <div style={{ fontSize: 11, color: '#9aa5b1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>{p.brand}</div>}
        <div onClick={() => navigate(`/products/${p.id}`)}
          style={{ fontSize: 15, fontWeight: 600, color: '#212529', cursor: 'pointer', marginBottom: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.name}
        </div>
        {p.description && (
          <div style={{ fontSize: 12, color: '#7f8c9a', lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {inStock
            ? <span style={{ fontSize: 11, fontWeight: 600, color: '#28A745', background: '#e8f5e9', padding: '2px 8px', borderRadius: 12 }}>In Stock ({p.stock})</span>
            : <span style={{ fontSize: 11, fontWeight: 600, color: '#1E88E5', background: '#fce4e4', padding: '2px 8px', borderRadius: 12 }}>Out of Stock</span>}
          {p.flash_sale && <span style={{ fontSize: 11, fontWeight: 700, color: '#1E88E5', background: '#E3F2FD', padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Zap size={10} fill="currentColor" /> Flash Sale</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, minWidth: 130 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: p.flash_sale ? '#1E88E5' : '#212529' }}>৳{price.toLocaleString('en-BD')}</div>
          {orig && orig > price && <div style={{ fontSize: 12, color: '#bbb', textDecoration: 'line-through' }}>৳{orig.toLocaleString('en-BD')}</div>}
          {disc && <div style={{ fontSize: 11, fontWeight: 700, color: '#28A745' }}>Save {disc}%</div>}
        </div>
        <button
          onClick={() => { if (inStock) { add({ id: p.id, name: p.name, price, image: p.image }); window.dispatchEvent(new CustomEvent('lata:open-cart')); } }}
          disabled={!inStock}
          style={{ padding: '9px 20px', background: inStock ? '#1E88E5' : '#e0e0e0', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: inStock ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          {inStock ? <><ShoppingCart size={14} /> Add to Cart</> : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}

/* ─── Pagination ─────────────────────────────────────────────── */
function Pagination({ page, totalPages, gotoPage }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20, flexWrap: 'wrap' }}>
      <button onClick={() => gotoPage(Math.max(1, page-1))} disabled={page===1}
        style={{ padding: '7px 14px', border: '1px solid #e0e0e0', borderRadius: 8, cursor: page===1?'not-allowed':'pointer', background: '#fff', color: '#555', opacity: page===1?.4:1, fontWeight: 600 }}>← Prev</button>
      {Array.from({length:totalPages},(_,i)=>i+1)
        .filter(n=>n===1||n===totalPages||Math.abs(n-page)<=2)
        .reduce((acc,n,i,arr)=>{ if(i>0&&n-arr[i-1]>1)acc.push('…'); acc.push(n); return acc; },[])
        .map((n,i)=>n==='…'
          ? <span key={`e${i}`} style={{padding:'7px 4px',color:'#9aa5b1',lineHeight:'34px'}}>…</span>
          : <button key={n} onClick={()=>gotoPage(n)}
              style={{width:36,height:36,border:'1px solid',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13,borderColor:page===n?'#1E88E5':'#e0e0e0',background:page===n?'#1E88E5':'#fff',color:page===n?'#fff':'#555'}}>{n}</button>
        )}
      <button onClick={() => gotoPage(Math.min(totalPages, page+1))} disabled={page===totalPages}
        style={{ padding: '7px 14px', border: '1px solid #e0e0e0', borderRadius: 8, cursor: page===totalPages?'not-allowed':'pointer', background: '#fff', color: '#555', opacity: page===totalPages?.4:1, fontWeight: 600 }}>Next →</button>
    </div>
  );
}
