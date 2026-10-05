import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Package, Zap, ShoppingCart, LayoutGrid, List } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductCard from '../../components/ProductCard';
import { supabase } from '../../lib/supabase';
import { fetchProductPage, fetchBrands } from '../../lib/catalog';
import { addToCart } from '../../store/cartStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useSeo } from '../../lib/seo';

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
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', cursor: 'pointer', fontSize: 13, color: checked ? '#1E88E5' : 'var(--tx-444, #444)' }}>
      <span style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${checked ? '#1E88E5' : 'var(--bd-ccc, #ccc)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: checked ? '#1E88E5' : 'var(--bg-fff, #fff)', transition: 'all .15s' }}>
        {checked && <span style={{ width: 6, height: 6, background: 'var(--bg-fff, #fff)', borderRadius: '50%', display: 'block' }} />}
      </span>
      <input type="radio" checked={checked} onChange={onChange} style={{ display: 'none' }} />
      <span style={{ fontWeight: checked ? 600 : 400 }}>{label}</span>
    </label>
  );
}

/* ─── Section header in sidebar ─────────────────────────────── */
function SidebarSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--bd-f0f0f0, #f0f0f0)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx-212529, #212529)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function AllProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcats,    setSubcats]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;

  // Category, subcategory group and search live in the URL (?cat=…&sub=…&q=…), so the
  // mega menu, mobile drawer, header search and back button all work — even while
  // this page is already open.
  const catFilter = searchParams.get('cat') || 'all';
  const subFilter = searchParams.get('sub') || '';
  const search    = searchParams.get('q')   || '';
  const setUrl = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => { if (!v || v === 'all') next.delete(k); else next.set(k, v); });
    setSearchParams(next, { replace: true });
  };
  const setCatFilter = (v) => setUrl({ cat: v, sub: '' });
  const setSubFilter = (v) => setUrl({ sub: v });
  const setSearch    = (v) => setUrl({ q: v });

  const [brandFilter,setBrandFilter]= useState('all');
  const [brandSearch,setBrandSearch]= useState('');
  const [priceRange, setPriceRange] = useState(0); // index into PRICE_RANGES
  const [sort,       setSort]       = useState('newest');
  const [viewMode,   setViewMode]   = useState('grid'); // 'grid' | 'list'
  const [page,       setPage]       = useState(1);

  useEffect(() => { setPage(1); window.scrollTo({ top: 0 }); }, [catFilter, subFilter, search]);
  useEffect(() => { setPage(1); }, [brandFilter, priceRange, sort]);

  // Categories, subcategory groups and brands (small lists)
  const [brandList, setBrandList] = useState([]);
  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
      supabase.from('subcategories').select('id, category_id, header').order('sort_order'),
      fetchBrands(),
    ]).then(([cRes, sRes, b]) => { setCategories(cRes.data || []); setSubcats(sRes.data || []); setBrandList(b); });
  }, []);

  const brands = useMemo(() => brandSearch
    ? brandList.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()))
    : brandList, [brandList, brandSearch]);

  // One page of products, filtered and sorted by the database.
  // When a search inside a category finds nothing (e.g. a mega-menu item no product
  // name mentions), show the whole category instead.
  const [total, setTotal] = useState(0);
  const [searchFellBack, setSearchFellBack] = useState(false);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const range = PRICE_RANGES[priceRange];
    const opts = { cat: catFilter, sub: subFilter, brand: brandFilter, minPrice: range.min, maxPrice: range.max, sort, page, perPage: PER_PAGE };
    setLoading(true); setLoadError(false);
    (async () => {
      try {
        let res = await fetchProductPage({ ...opts, q: search });
        let fellBack = false;
        if (search && res.total === 0 && catFilter !== 'all') {
          const all = await fetchProductPage(opts);
          if (all.total > 0) { res = all; fellBack = true; }
        }
        if (cancelled) return;
        setProducts(res.products); setTotal(res.total); setSearchFellBack(fellBack);
      } catch {
        if (!cancelled) { setProducts([]); setTotal(0); setLoadError(true); }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [catFilter, subFilter, brandFilter, priceRange, sort, page, search]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const paginated  = products;

  const seoCat = categories.find(c => String(c.id) === catFilter)?.name;
  useSeo({
    title: search ? `Search: ${search}` : seoCat ? `${seoCat} — Buy Online in Bangladesh` : 'All Products',
    description: seoCat
      ? `Shop ${seoCat} at Lata Electric: genuine products, best prices in Bangladesh, delivery across the country and cash on delivery.`
      : 'Browse all electrical and hardware products at Lata Electric — fans, lights, cables, switches, appliances and more. Cash on delivery across Bangladesh.',
    noindex: !!search,   // search result pages stay out of Google
  });

  const resetAll = () => { setSearchParams({}, { replace: true }); setBrandFilter('all'); setPriceRange(0); setSort('newest'); setPage(1); };
  const gotoPage = (n) => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const hasFilters = catFilter !== 'all' || subFilter || brandFilter !== 'all' || priceRange !== 0 || search;

  const FilterPanel = ({ onApply }) => (
    <div>
      <SidebarSection title="Category">
        <div style={{ maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          <RadioRow label="All Categories" checked={catFilter === 'all'} onChange={() => { setCatFilter('all'); onApply?.(); }} />
          {categories.map(c => (
            <RadioRow key={c.id} label={c.name} checked={catFilter === String(c.id)}
              onChange={() => { setCatFilter(String(c.id)); onApply?.(); }} />
          ))}
        </div>
      </SidebarSection>
      {brands.length > 0 && (
        <SidebarSection title="Brand">
          <input value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder="Search brands..."
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor='#1E88E5'}
            onBlur={e => e.target.style.borderColor='var(--bd-e0e0e0, #e0e0e0)'} />
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
        style={{ width: '100%', padding: '10px', background: hasFilters ? '#1E88E5' : 'var(--bg-f8f9fa, #F8F9FA)', color: hasFilters ? '#fff' : 'var(--tx-9aa5b1, #9aa5b1)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-fff, #fff)', zIndex: 601, borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', transform: filterDrawerOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)', boxShadow: '0 -8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd-f0f0f0, #f0f0f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>≡</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--tx-212529, #212529)' }}>Filter & Sort</span>
                {hasFilters && <span style={{ background: '#1E88E5', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>{[catFilter!=='all',!!subFilter,brandFilter!=='all',priceRange!==0,!!search].filter(Boolean).length} active</span>}
              </div>
              <button onClick={() => setFilterDrawerOpen(false)} style={{ background: 'var(--bg-f8f9fa, #F8F9FA)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--tx-333, #333)' }}>Done</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <FilterPanel onApply={() => {}} />
            </div>
          </div>
        </>
      )}

      <div style={{ background: 'var(--bg-f8f9fa, #F8F9FA)', minHeight: '100vh', paddingBottom: isCompact ? 80 : 32 }}>
        <div style={{ maxWidth: 1260, margin: '0 auto', padding: isCompact ? '10px 8px' : '16px 14px', display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '230px 1fr', gap: 14, alignItems: 'start' }}>

          {/* ══ SIDEBAR (desktop only) ══ */}
          {!isCompact && (
            <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, border: '1px solid var(--bd-ebebeb, #ebebeb)', position: 'sticky', top: 78, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--bd-f0f0f0, #f0f0f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 16 }}>≡</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tx-212529, #212529)' }}>Filter</span>
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
            <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, border: '1px solid var(--bd-ebebeb, #ebebeb)', padding: isCompact ? '8px 12px' : '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

              {/* Mobile: filter button */}
              {isCompact && (
                <button onClick={() => setFilterDrawerOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: hasFilters ? '#1E88E5' : 'var(--bg-f8f9fa, #F8F9FA)', color: hasFilters ? '#fff' : 'var(--tx-333, #333)', border: `1px solid ${hasFilters ? '#1E88E5' : 'var(--bd-e0e0e0, #e0e0e0)'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  <span>≡</span> Filter {hasFilters ? `(${[catFilter!=='all',!!subFilter,brandFilter!=='all',priceRange!==0,!!search].filter(Boolean).length})` : ''}
                </button>
              )}

              {/* Sort */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!isCompact && <span style={{ fontSize: 13, color: 'var(--tx-7f8c9a, #7f8c9a)', whiteSpace: 'nowrap' }}>Sort by</span>}
                <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
                  style={{ padding: isCompact ? '7px 10px' : '6px 28px 6px 12px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, fontSize: 13, background: 'var(--bg-fff, #fff)', cursor: 'pointer', outline: 'none', fontWeight: 500, color: 'var(--tx-212529, #212529)' }}>
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{isCompact ? o.label.replace('Newest Arrivals','Newest').replace('Most Popular','Popular').replace('Price: Low → High','↑ Price').replace('Price: High → Low','↓ Price').replace('Name A–Z','A–Z') : o.label}</option>)}
                </select>
              </div>

              {/* Filter chips */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1, overflow: 'hidden' }}>
                {catFilter !== 'all' && (
                  <span style={{ background: 'var(--bg-e3f2fd, #E3F2FD)', color: '#1E88E5', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {categories.find(c=>String(c.id)===catFilter)?.name}
                    <button onClick={() => setCatFilter('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                )}
                {brandFilter !== 'all' && (
                  <span style={{ background: 'var(--bg-e3f2fd, #E3F2FD)', color: '#1E88E5', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {brandFilter}
                    <button onClick={() => setBrandFilter('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                )}
                {priceRange !== 0 && (
                  <span style={{ background: 'var(--bg-e3f2fd, #E3F2FD)', color: '#1E88E5', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {PRICE_RANGES[priceRange].label}
                    <button onClick={() => setPriceRange(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                )}
                {subFilter && (
                  <span style={{ background: 'var(--bg-e3f2fd, #E3F2FD)', color: '#1E88E5', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {subcats.find(s => String(s.id) === subFilter)?.header || 'Subcategory'}
                    <button onClick={() => setSubFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                )}
                {search && (
                  <span style={{ background: 'var(--bg-e3f2fd, #E3F2FD)', color: '#1E88E5', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    "{search}"
                    <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                )}
              </div>

              <span style={{ fontSize: 12, color: 'var(--tx-9aa5b1, #9aa5b1)', whiteSpace: 'nowrap', marginLeft: 'auto', flexShrink: 0 }}>
                <strong style={{ color: 'var(--tx-212529, #212529)' }}>{total}</strong> items
              </span>

              {/* Grid/List toggle — desktop only */}
              {!isCompact && (
                <div style={{ display: 'flex', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, overflow: 'hidden' }}>
                  {[{ mode: 'grid', Icon: LayoutGrid }, { mode: 'list', Icon: List }].map(({ mode, Icon }) => (
                    <button key={mode} onClick={() => setViewMode(mode)}
                      style={{ padding: '6px 11px', border: 'none', background: viewMode === mode ? '#1E88E5' : 'var(--bg-fff, #fff)', color: viewMode === mode ? '#fff' : 'var(--tx-888, #888)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .15s' }}>
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {searchFellBack && !loading && (
              <div style={{ background: 'var(--bg-fff8e1, #FFF8E1)', border: '1px solid #FFE082', color: 'var(--tx-7a5d00, #7a5d00)', borderRadius: 10, padding: '9px 14px', fontSize: 13, marginBottom: 10 }}>
                No exact matches for "<strong>{search}</strong>" — showing all products in {categories.find(c => String(c.id) === catFilter)?.name || 'this category'}.
              </div>
            )}

            {/* Products */}
            {loading ? (
              <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, padding: 80, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, border: '4px solid var(--bd-f0f0f0, #f0f0f0)', borderTop: '4px solid #1E88E5', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
              </div>

            ) : paginated.length === 0 ? (
              <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, padding: '60px 0', textAlign: 'center', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Search size={56} color="#ccc" /></div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--tx-333, #333)' }}>{loadError ? 'Could not load products' : 'No products found'}</div>
                <div style={{ fontSize: 13, marginBottom: 20 }}>{loadError ? 'Please check your connection and try again.' : 'Try adjusting your filters or search.'}</div>
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
  const navigate = useNavigate();
  const price    = p.flash_sale && p.flash_price ? p.flash_price : p.price;
  const orig     = p.flash_sale && p.flash_price ? p.price : p.original_price;
  const disc     = orig && orig > price ? Math.round((1 - price / orig) * 100) : null;
  const inStock  = p.stock > 0;

  return (
    <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, border: '1px solid var(--bd-ebebeb, #ebebeb)', display: 'flex', gap: 16, padding: 14, transition: 'box-shadow .2s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>

      <div onClick={() => navigate(`/products/${p.id}`)}
        style={{ width: 120, height: 120, background: 'var(--bg-f8f9fa, #f8f9fa)', borderRadius: 10, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} /> : <Package size={40} color="#ccc" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {p.brand && <div style={{ fontSize: 11, color: 'var(--tx-9aa5b1, #9aa5b1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>{p.brand}</div>}
        <div onClick={() => navigate(`/products/${p.id}`)}
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-212529, #212529)', cursor: 'pointer', marginBottom: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.name}
        </div>
        {p.description && (
          <div style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {inStock
            ? <span style={{ fontSize: 11, fontWeight: 600, color: '#28A745', background: 'var(--bg-e8f5e9, #e8f5e9)', padding: '2px 8px', borderRadius: 12 }}>In Stock ({p.stock})</span>
            : <span style={{ fontSize: 11, fontWeight: 600, color: '#1E88E5', background: 'var(--bg-fce4e4, #fce4e4)', padding: '2px 8px', borderRadius: 12 }}>Out of Stock</span>}
          {p.flash_sale && <span style={{ fontSize: 11, fontWeight: 700, color: '#1E88E5', background: 'var(--bg-e3f2fd, #E3F2FD)', padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Zap size={10} fill="currentColor" /> Flash Sale</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, minWidth: 130 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: p.flash_sale ? '#1E88E5' : 'var(--tx-212529, #212529)' }}>৳{price.toLocaleString('en-BD')}</div>
          {orig && orig > price && <div style={{ fontSize: 12, color: 'var(--tx-bbb, #bbb)', textDecoration: 'line-through' }}>৳{orig.toLocaleString('en-BD')}</div>}
          {disc && <div style={{ fontSize: 11, fontWeight: 700, color: '#28A745' }}>Save {disc}%</div>}
        </div>
        <button
          onClick={() => { addToCart(p, { price }); }}
          disabled={!inStock}
          style={{ padding: '9px 20px', background: inStock ? '#1E88E5' : 'var(--bg-e0e0e0, #e0e0e0)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: inStock ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
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
        style={{ padding: '7px 14px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, cursor: page===1?'not-allowed':'pointer', background: 'var(--bg-fff, #fff)', color: 'var(--tx-555, #555)', opacity: page===1?.4:1, fontWeight: 600 }}>← Prev</button>
      {Array.from({length:totalPages},(_,i)=>i+1)
        .filter(n=>n===1||n===totalPages||Math.abs(n-page)<=2)
        .reduce((acc,n,i,arr)=>{ if(i>0&&n-arr[i-1]>1)acc.push('…'); acc.push(n); return acc; },[])
        .map((n,i)=>n==='…'
          ? <span key={`e${i}`} style={{padding:'7px 4px',color:'var(--tx-9aa5b1, #9aa5b1)',lineHeight:'34px'}}>…</span>
          : <button key={n} onClick={()=>gotoPage(n)}
              style={{width:36,height:36,border:'1px solid',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13,borderColor:page===n?'#1E88E5':'var(--bd-e0e0e0, #e0e0e0)',background:page===n?'#1E88E5':'var(--bg-fff, #fff)',color:page===n?'#fff':'var(--tx-555, #555)'}}>{n}</button>
        )}
      <button onClick={() => gotoPage(Math.min(totalPages, page+1))} disabled={page===totalPages}
        style={{ padding: '7px 14px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, cursor: page===totalPages?'not-allowed':'pointer', background: 'var(--bg-fff, #fff)', color: 'var(--tx-555, #555)', opacity: page===totalPages?.4:1, fontWeight: 600 }}>Next →</button>
    </div>
  );
}
