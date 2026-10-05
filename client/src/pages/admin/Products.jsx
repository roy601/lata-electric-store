import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, X, Camera, ImagePlus, Copy, ChevronDown, ChevronRight, Pencil, Trash2, FileSpreadsheet, EyeOff, ChevronLeft } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import ProductImport from './ProductImport';
import { CategorySidebar, CategoryChips, CategoryEditor } from './CategoryPanel';
import { uploadImage, getProducts, getCategories, getSubcategories, createProduct, updateProduct, deleteProduct, updateCategory, getProductMeta, getProductRefs, errMsg } from '../../api/adminApi';
import { compressImage } from '../../lib/compressImage';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import toast from 'react-hot-toast';

const DEFAULT_VARIANTS = [
  { key: 'size',     label: 'SIZE',     enabled: false, options: [] },
  { key: 'color',    label: 'COLOR',    enabled: false, options: [] },
  { key: 'warranty', label: 'WARRANTY', enabled: false, options: [] },
];
const BUILT_IN_KEYS = ['size', 'color', 'warranty'];

const migrateVariants = (variants) => {
  if (!variants) return DEFAULT_VARIANTS.map(v => ({ ...v }));
  if (Array.isArray(variants)) return variants.map(v => ({
    ...v,
    options: (v.options || []).map(o => typeof o === 'string' ? { value: o, price: null } : o),
  }));
  // old object format → convert
  return Object.entries(variants).map(([key, v]) => ({
    key, label: key.toUpperCase(), enabled: v.enabled || false,
    options: (v.options || []).map(o => typeof o === 'string' ? { value: o, price: null } : o),
  }));
};

const EMPTY = { name: '', brand: '', sku: '', price: '', original_price: '', stock: '', description: '', image: '', extra_images: [], category_id: '', subcategory_id: '', is_active: true, specifications: [], variants: DEFAULT_VARIANTS.map(v => ({ ...v })) };

// Category + brand of the last saved product, so the next new product starts with them
const LAST_KEY = 'lata-admin-last-product';
const readLast = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY)) || {}; } catch { return {}; } };
const writeLast = (v) => { try { localStorage.setItem(LAST_KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };

// Same order as the shop menu
const sortCats = (list) => [...list].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));

const toForm = (p) => ({
  ...p,
  category_id: p.category_id || '', subcategory_id: p.subcategory_id || '',
  specifications: Array.isArray(p.specifications) ? p.specifications.map(s => ({ ...s })) : [],
  extra_images: Array.isArray(p.extra_images) ? [...p.extra_images] : [],
  variants: migrateVariants(p.variants),
});

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit' };
const labelStyle = { display: 'block', fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', marginBottom: 4, fontWeight: 600 };

/* ── Click a number in the list to change it in place (Enter saves, Esc cancels) ── */
function InlineNumber({ value, onSave, min = 0, integer = false, children }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const lock = useRef(false); // Enter and blur can both fire — save only once

  const start  = () => { lock.current = false; setDraft(String(value ?? '')); setEditing(true); };
  const cancel = () => { lock.current = true; setEditing(false); };
  const commit = async () => {
    if (lock.current) return;
    if (draft.trim() === String(value ?? '')) { cancel(); return; }
    const n = +draft;
    if (draft.trim() === '' || isNaN(n) || n < min || (integer && !Number.isInteger(n))) {
      toast.error(integer ? `Enter a whole number (${min} or more)` : 'Enter a price above 0');
      return;
    }
    lock.current = true;
    setBusy(true);
    const ok = await onSave(n);
    setBusy(false);
    if (ok) setEditing(false); else lock.current = false;
  };

  if (editing) return (
    <input type="number" autoFocus value={draft} readOnly={busy}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
      onBlur={commit}
      style={{ width: 84, padding: '5px 8px', border: '2px solid #1E88E5', borderRadius: 6, fontSize: 13, fontWeight: 600 }} />
  );
  return (
    <button type="button" onClick={start} title="Click to change"
      style={{ background: 'none', border: 'none', padding: '2px 4px', margin: '-2px -4px', cursor: 'pointer', borderRadius: 6, textAlign: 'left', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-f1f7fe, #F1F7FE)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      {children}
      <Pencil size={11} color="#b0bac5" />
    </button>
  );
}

export default function AdminProducts() {
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCat = searchParams.get('cat') || 'all';   // 'all' | 'none' | category id
  const selectCat = (key) => { setSearchParams(key === 'all' ? {} : { cat: key }, { replace: true }); setStockFilter(''); };
  const [stockFilter, setStockFilter] = useState('');      // '' | 'out' | 'low'
  const [editingCat, setEditingCat] = useState(null);
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [form, setForm]             = useState(null); // null = closed, {} = new, {...} = edit
  const [copiedFrom, setCopiedFrom] = useState('');
  const [showMore, setShowMore]     = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [imgLoading, setImgLoading]       = useState(false);
  const [subcatOptions, setSubcatOptions] = useState([]);
  const [variantInput,  setVariantInput]  = useState({});
  const [editingLabel,  setEditingLabel]  = useState(null);
  const nameRef = useRef(null);

  /* ── Data: categories + catalogue numbers once, products one page at a time ── */
  const PAGE_SIZE = 50;
  const [meta, setMeta]         = useState({ total: 0, uncategorised: 0, counts: {}, brands: [], specKeys: {}, allSpecKeys: [] });
  const [page, setPage]         = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, pages: 1, stats: { out: 0, low: 0 } });
  const [listLoading, setListLoading] = useState(true);
  const [sort, setSort]         = useState('newest');
  const [debounced, setDebounced] = useState('');
  const reqId = useRef(0);

  const loadCategories = async () => {
    try { const { data } = await getCategories(); setCategories(sortCats(data.categories || [])); }
    catch (err) { toast.error(errMsg(err, 'Failed to load categories')); }
  };
  const loadMeta = async () => {
    try { const { data } = await getProductMeta(); setMeta(data); } catch { /* numbers only */ }
  };
  const loadPage = async () => {
    const id = ++reqId.current;
    setListLoading(true);
    try {
      const { data } = await getProducts({
        page, limit: PAGE_SIZE, sort,
        q: debounced || undefined,
        category: selectedCat === 'all' ? undefined : selectedCat,
        stock: stockFilter || undefined,
      });
      if (id !== reqId.current) return;   // a newer request is on its way
      setProducts(data.products || []);
      setPageInfo({ total: data.total, pages: data.pages, stats: data.stats });
    } catch (err) {
      if (id === reqId.current) toast.error(errMsg(err, 'Failed to load products'));
    }
    if (id === reqId.current) setListLoading(false);
  };
  // After any change: refresh this page and the counts
  const load = () => { loadPage(); loadMeta(); };

  useEffect(() => { Promise.all([loadCategories(), loadMeta()]).finally(() => setLoading(false)); }, []);
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [selectedCat, debounced, stockFilter, sort]);
  useEffect(() => { loadPage(); }, [selectedCat, debounced, stockFilter, sort, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // When category changes, load its subcategory groups
  useEffect(() => {
    const catId = form?.category_id;
    if (!catId) { setSubcatOptions([]); return; }
    getSubcategories({ category_id: catId })
      .then(({ data }) => setSubcatOptions(data.subcategories || []))
      .catch(() => setSubcatOptions([]));
  }, [form?.category_id]);

  /* ── Suggestions learned from existing products ── */
  const brands = meta.brands || [];
  const allSpecKeys = meta.allSpecKeys || [];
  // Spec template: the property names other products in this category use, most common first (worked out on the server)
  const specKeysFor = (catId) => (meta.specKeys || {})[catId] || [];
  const templateSpecs = (catId) => specKeysFor(catId).map(key => ({ key, value: '' }));

  /* ── Opening the form ── */
  const focusName = () => setTimeout(() => nameRef.current?.focus(), 50);

  const openNew = () => {
    const last = readLast();
    const viewing = categories.some(c => String(c.id) === selectedCat) ? selectedCat : '';
    const catId = viewing || (categories.some(c => String(c.id) === String(last.category_id)) ? String(last.category_id) : '');
    setForm({ ...EMPTY, variants: DEFAULT_VARIANTS.map(v => ({ ...v })), category_id: catId, brand: last.brand || '', specifications: catId ? templateSpecs(catId) : [] });
    setCopiedFrom(''); setShowMore(false); setVariantInput({});
    focusName();
  };
  const openEdit = (p) => {
    setForm(toForm(p)); setCopiedFrom(''); setShowMore(true); setVariantInput({});
  };
  const openDuplicate = (p) => {
    const { id, created_at, updated_at, categories: _c, ...rest } = p;
    setForm({ ...toForm(rest), sku: '' });
    setCopiedFrom(p.name); setShowMore(false); setVariantInput({});
    toast('Copied — change the name, price and stock, then save', { duration: 3500 });
    focusName();
  };

  const changeCategory = (catId) => setForm(f => {
    const next = { ...f, category_id: catId, subcategory_id: '' };
    // Fill in the category's spec names, unless the admin has already typed spec values
    const hasValues = (f.specifications || []).some(s => s.value?.trim());
    if (!hasValues) next.specifications = catId ? templateSpecs(catId) : [];
    return next;
  });

  /* ── Images ── */
  const [extraImgLoading, setExtraImgLoading] = useState(false);

  const handleImageFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImgLoading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
      const { data } = await uploadImage(compressed);
      setForm(f => ({ ...f, image: data.url }));
      toast.success('Photo added');
    } catch { toast.error('Upload failed'); }
    finally { setImgLoading(false); }
  };

  const handleExtraImageFiles = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (!files.length) return;
    setExtraImgLoading(true);
    try {
      const urls = await Promise.all(files.map(async file => {
        const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
        const { data } = await uploadImage(compressed);
        return data.url;
      }));
      setForm(f => ({ ...f, extra_images: [...(f.extra_images || []), ...urls] }));
      toast.success(`${urls.length} image(s) uploaded`);
    } catch { toast.error('Upload failed'); }
    finally { setExtraImgLoading(false); }
  };

  /* ── Save ── */
  const save = async (addAnother = false) => {
    if (!form.name?.trim())            { toast.error('Please enter the product name'); nameRef.current?.focus(); return; }
    if (!(+form.price > 0))            { toast.error('Please enter a price'); return; }
    if (form.stock !== '' && form.stock != null && (+form.stock < 0 || !Number.isInteger(+form.stock))) { toast.error('Stock must be a whole number'); return; }
    if (imgLoading || extraImgLoading) { toast.error('Please wait — photo still uploading'); return; }
    setSaving(true);
    const payload = {
      name:           form.name.trim(),
      brand:          form.brand?.trim() || null,
      sku:            form.sku?.trim()   || null,
      price:          +form.price,
      original_price: form.original_price ? +form.original_price : null,
      stock:          +form.stock || 0,
      description:    form.description || null,
      image:          form.image || null,
      extra_images:   form.extra_images || [],
      category_id:    form.category_id    ? +form.category_id    : null,
      subcategory_id: form.subcategory_id || null,
      is_active:      form.is_active,
      specifications: (form.specifications || []).filter(s => s.key.trim() && s.value.trim()),
      variants: form.variants || DEFAULT_VARIANTS,
    };

    try {
      if (form.id) await updateProduct(form.id, payload);
      else         await createProduct(payload);
    } catch (err) {
      setSaving(false);
      toast.error('Save failed: ' + errMsg(err));
      return;
    }
    setSaving(false);
    toast.success(form.id ? 'Product updated' : `"${payload.name}" added`);
    if (!form.id) writeLast({ category_id: form.category_id, brand: form.brand?.trim() || '' });

    if (addAnother) {
      // Keep category, subcategory and brand; clear the rest; keep spec names with empty values
      setForm(f => ({
        ...EMPTY, variants: DEFAULT_VARIANTS.map(v => ({ ...v })),
        category_id: f.category_id, subcategory_id: f.subcategory_id, brand: f.brand,
        specifications: (f.specifications || []).filter(s => s.key.trim()).map(s => ({ key: s.key, value: '' })),
      }));
      setCopiedFrom(''); setVariantInput({});
      focusName();
    } else {
      setForm(null);
    }
    load();
  };

  /* ── Quick edits from the list ── */
  const quickUpdate = async (p, patch, label) => {
    try {
      await updateProduct(p.id, patch);
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...patch } : x));
      toast.success(`${label} updated`, { duration: 1500 });
      return true;
    } catch (err) {
      toast.error('Update failed: ' + errMsg(err));
      return false;
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await deleteProduct(id); }
    catch (err) { toast.error('Delete failed: ' + errMsg(err)); return; }
    toast.success('Deleted');
    load();
  };

  /* ── Categories ── */
  const counts = meta.counts || {};
  const uncategorised = meta.uncategorised || 0;
  const currentCat = categories.find(c => String(c.id) === selectedCat) || null;
  const catsByName = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);

  // If the selected category no longer exists (deleted, bad link), go back to All
  useEffect(() => {
    if (!loading && selectedCat !== 'all' && selectedCat !== 'none' && !currentCat) selectCat('all');
  }, [loading, selectedCat, currentCat]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCategoryCreated = (cat) => {
    setCategories(cs => sortCats([...cs, cat]));
    selectCat(String(cat.id));
  };
  const onCategorySaved = (cat) => {
    setCategories(cs => sortCats(cs.map(c => c.id === cat.id ? { ...c, ...cat } : c)));
    setEditingCat(c => c && c.id === cat.id ? { ...c, ...cat } : c);
    setProducts(ps => ps.map(p => p.category_id === cat.id ? { ...p, categories: { ...(p.categories || {}), name: cat.name } } : p));
  };
  const onCategoryDeleted = (id) => {
    setEditingCat(null);
    setCategories(cs => cs.filter(c => c.id !== id));
    selectCat('all');
    load();
  };
  // Move a category up/down in the shop menu; renumbers so equal sort orders can't get stuck
  const moveCategory = async (cat, dir) => {
    const list = [...categories];
    const i = list.findIndex(c => c.id === cat.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const renumbered = list.map((c, k) => ({ ...c, sort_order: k + 1 }));
    setCategories(renumbered);
    try {
      await Promise.all(renumbered
        .filter(c => categories.find(o => o.id === c.id)?.sort_order !== c.sort_order)
        .map(c => updateCategory(c.id, { sort_order: c.sort_order })));
    } catch (err) { toast.error(errMsg(err, 'Could not save the new order')); loadCategories(); }
  };

  const visible  = products;
  const outCount = pageInfo.stats?.out || 0;
  const lowCount = pageInfo.stats?.low || 0;
  const scopeTotal = selectedCat === 'all' ? meta.total : selectedCat === 'none' ? uncategorised : (counts[selectedCat] || 0);

  const stockBadge = (p) => (
    <span style={{ background: p.stock === 0 ? 'var(--bg-f8d7da, #f8d7da)' : p.stock <= 5 ? 'var(--bg-fff3cd, #fff3cd)' : 'var(--bg-d1e7dd, #d1e7dd)', color: p.stock === 0 ? 'var(--tx-842029, #842029)' : p.stock <= 5 ? 'var(--tx-856404, #856404)' : 'var(--tx-0f5132, #0f5132)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {p.stock === 0 ? 'Out' : p.stock}
    </span>
  );
  const priceCell = (p) => <InlineNumber value={p.price} min={0.01} onSave={n => quickUpdate(p, { price: n }, 'Price')}><span style={{ fontWeight: 700 }}>৳{p.price}</span></InlineNumber>;
  const stockCell = (p) => <InlineNumber value={p.stock} integer onSave={n => quickUpdate(p, { stock: n }, 'Stock')}>{stockBadge(p)}</InlineNumber>;
  const actionBtn = { padding: '6px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 };
  const actions = (p) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button onClick={() => openEdit(p)} style={{ ...actionBtn, background: '#212529', color: '#fff' }}><Pencil size={12} /> Edit</button>
      <button onClick={() => openDuplicate(p)} title="Make a similar product" style={{ ...actionBtn, background: 'var(--bg-e3f2fd, #E3F2FD)', color: 'var(--tx-1565c0, #1565C0)' }}><Copy size={12} /> Copy</button>
      <button onClick={() => remove(p.id, p.name)} title="Delete" style={{ ...actionBtn, background: 'var(--bg-f8d7da, #f8d7da)', color: 'var(--tx-842029, #842029)' }}><Trash2 size={12} /></button>
    </div>
  );
  const thumb = (p, size) => (
    <div style={{ width: size, height: size, borderRadius: 8, background: 'var(--bg-f8f9fa, #F8F9FA)', backgroundImage: p.image ? `url(${p.image})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {!p.image && <Package size={size / 2.2} color="#ccc" />}
    </div>
  );

  const emptyState = (
    <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>
      {listLoading ? 'Loading…' : scopeTotal === 0 ? <>
        <Package size={40} color="#d5dbe3" />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-555, #555)', margin: '10px 0 4px' }}>
          {currentCat ? `No products in ${currentCat.name} yet` : 'No products yet'}
        </div>
        <div style={{ fontSize: 13, marginBottom: 14 }}>Add one by hand, or many at once from Excel.</div>
        <button onClick={openNew} style={{ padding: '9px 18px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>+ Add the first product</button>
      </> : 'No products match your search or filter.'}
    </div>
  );

  // Spec names the template suggests that aren't in the form yet
  const missingSpecKeys = form?.category_id
    ? specKeysFor(form.category_id).filter(k => !(form.specifications || []).some(s => s.key.trim().toLowerCase() === k.toLowerCase()))
    : [];

  return (
    <AdminLayout title="Products & Categories">
      {isCompact && (
        <CategoryChips categories={categories} counts={counts} total={meta.total} uncategorised={uncategorised}
          selected={selectedCat} onSelect={selectCat} onCreated={onCategoryCreated} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '240px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
      {!isCompact && (
        <CategorySidebar categories={categories} counts={counts} total={meta.total} uncategorised={uncategorised}
          selected={selectedCat} onSelect={selectCat} onEdit={setEditingCat} onCreated={onCategoryCreated} />
      )}
      <div style={{ minWidth: 0 }}>

      {/* Heading for the chosen category */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {currentCat && <span style={{ width: 12, height: 12, borderRadius: '50%', background: currentCat.color || '#1E88E5' }} />}
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 800, color: 'var(--tx-212529, #212529)' }}>
          {currentCat ? currentCat.name : selectedCat === 'none' ? 'Products without a category' : 'All products'}
        </h2>
        {currentCat && !currentCat.is_active && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-f1f3f5, #F1F3F5)', color: 'var(--tx-6b7280, #6B7280)', fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 12 }}><EyeOff size={12} /> Hidden in shop</span>
        )}
        {currentCat && (
          <button onClick={() => setEditingCat(currentCat)}
            style={{ marginLeft: 'auto', padding: '7px 12px', background: 'var(--bg-fff, #fff)', color: 'var(--tx-374151, #374151)', border: '1px solid var(--bd-e2e8f0, #e2e8f0)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={13} /> Edit category
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <input
          placeholder={currentCat ? `Search in ${currentCat.name}…` : 'Search name, SKU or brand…'}
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: '9px 14px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, fontSize: 14 }}
        />
        <button onClick={() => setImportOpen(true)} title="Import from Excel"
          style={{ padding: isMobile ? '9px 11px' : '9px 14px', background: 'var(--bg-fff, #fff)', color: '#1D6F42', border: '1px solid #A5D6A7', borderRadius: 8, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileSpreadsheet size={16} />{!isMobile && ' Import from Excel'}
        </button>
        <button onClick={openNew} style={{ padding: '9px 18px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {currentCat && !isMobile ? `+ Add to ${currentCat.name.length > 18 ? currentCat.name.slice(0, 16) + '…' : currentCat.name}` : '+ Add Product'}
        </button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--tx-7f8c9a, #7f8c9a)', marginBottom: 16 }}>
        {pageInfo.total === scopeTotal ? `${scopeTotal} product${scopeTotal !== 1 ? 's' : ''}` : `${pageInfo.total} of ${scopeTotal} products`}
        {outCount > 0 && (
          <button onClick={() => setStockFilter(f => f === 'out' ? '' : 'out')} title="Show only these"
            style={{ marginLeft: 12, background: 'var(--bg-f8d7da, #f8d7da)', color: 'var(--tx-842029, #842029)', padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `2px solid ${stockFilter === 'out' ? '#842029' : 'transparent'}`, cursor: 'pointer' }}>
            {outCount} out of stock{stockFilter === 'out' ? ' ×' : ''}
          </button>
        )}
        {lowCount > 0 && (
          <button onClick={() => setStockFilter(f => f === 'low' ? '' : 'low')} title="Show only these"
            style={{ marginLeft: 6, background: 'var(--bg-fff3cd, #fff3cd)', color: 'var(--tx-856404, #856404)', padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `2px solid ${stockFilter === 'low' ? '#856404' : 'transparent'}`, cursor: 'pointer' }}>
            {lowCount} low stock{stockFilter === 'low' ? ' ×' : ''}
          </button>
        )}
        <select value={sort} onChange={e => setSort(e.target.value)} title="Sort"
          style={{ marginLeft: 10, padding: '3px 6px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 6, fontSize: 12, color: 'var(--tx-374151, #374151)', background: 'var(--bg-fff, #fff)' }}>
          <option value="newest">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
          <option value="stock_asc">Stock: lowest first</option>
        </select>
        {!isMobile && <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--tx-9aa5b1, #9aa5b1)' }}>Tip: click a price or stock number to change it.</span>}
      </div>

      {/* List */}
      <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', opacity: listLoading && products.length ? .55 : 1, transition: 'opacity .15s' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>Loading…</div>
        ) : isMobile ? (
          /* Phone: one card per product */
          <div>
            {visible.map(p => (
              <div key={p.id} style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid var(--bd-f1f3f5, #F1F3F5)' }}>
                {thumb(p, 56)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--tx-212529, #212529)', fontSize: 14, lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx-9aa5b1, #9aa5b1)', margin: '2px 0 8px' }}>
                    {p.categories?.name || 'No category'}{!p.is_active && <span style={{ color: 'var(--tx-842029, #842029)', fontWeight: 600 }}> · Hidden</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, fontSize: 13 }}>
                    {priceCell(p)}
                    {stockCell(p)}
                  </div>
                  {actions(p)}
                </div>
              </div>
            ))}
            {visible.length === 0 && emptyState}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-f8f9fa, #f8f9fa)' }}>
                {['Image', 'Name', 'Category', 'Price', 'Stock', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: 'var(--tx-7f8c9a, #7f8c9a)', fontWeight: 600, borderBottom: '1px solid var(--bd-eee, #eee)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--bd-f8f9fa, #F8F9FA)' }}>
                  <td style={{ padding: '10px 14px' }}>{thumb(p, 44)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--tx-212529, #212529)' }}>{p.name}</div>
                    {(p.sku || p.brand) && <div style={{ color: 'var(--tx-9aa5b1, #9aa5b1)', fontSize: 12 }}>{[p.brand, p.sku && `SKU: ${p.sku}`].filter(Boolean).join(' · ')}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--tx-555, #555)' }}>{p.categories?.name || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {priceCell(p)}
                    {p.original_price && <div style={{ color: 'var(--tx-9aa5b1, #9aa5b1)', fontSize: 12, textDecoration: 'line-through' }}>৳{p.original_price}</div>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>{stockCell(p)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: p.is_active ? 'var(--bg-d1e7dd, #d1e7dd)' : 'var(--bg-f8d7da, #f8d7da)', color: p.is_active ? 'var(--tx-0f5132, #0f5132)' : 'var(--tx-842029, #842029)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {p.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>{actions(p)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7}>{emptyState}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pages */}
      {pageInfo.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, fontSize: 13, color: 'var(--tx-555, #555)' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || listLoading}
            style={{ padding: '7px 12px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, background: 'var(--bg-fff, #fff)', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? .4 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={14} /> Previous
          </button>
          <span>Page <strong>{page}</strong> of {pageInfo.pages}</span>
          <button onClick={() => setPage(p => Math.min(pageInfo.pages, p + 1))} disabled={page >= pageInfo.pages || listLoading}
            style={{ padding: '7px 12px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, background: 'var(--bg-fff, #fff)', cursor: page >= pageInfo.pages ? 'default' : 'pointer', opacity: page >= pageInfo.pages ? .4 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      </div>
      </div>

      {editingCat && (
        <CategoryEditor key={editingCat.id} category={editingCat} categories={categories} isMobile={isMobile}
          productCount={counts[editingCat.id] || 0}
          loadRefs={async () => (await getProductRefs(editingCat.id)).data.products || []}
          onClose={() => setEditingCat(null)} onSaved={onCategorySaved} onDeleted={onCategoryDeleted} onMove={moveCategory} />
      )}

      {importOpen && (
        <ProductImport categories={categories}
          onClose={() => setImportOpen(false)} onDone={load} onCategoriesChanged={loadCategories} />
      )}

      {/* Add / Edit form */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 0 : '32px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: isMobile ? 0 : 12, width: '100%', maxWidth: 580, minHeight: isMobile ? '100%' : undefined, display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: isMobile ? '14px 16px' : '20px 24px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: isMobile ? '1px solid var(--bd-f0f0f0, #f0f0f0)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{form.id ? 'Edit Product' : 'Add Product'}</h3>
                {copiedFrom && <div style={{ fontSize: 12, color: 'var(--tx-1565c0, #1565C0)', marginTop: 2 }}>Copied from "{copiedFrom}"</div>}
              </div>
              <button onClick={() => setForm(null)} aria-label="Close" style={{ background: 'var(--bg-f3f4f6, #F3F4F6)', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
            </div>

            <div style={{ padding: isMobile ? 16 : '8px 24px 0', flex: 1 }}>

              {/* ── 1. Photo ── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 16 }}>
                <div style={{ width: 104, height: 104, borderRadius: 12, border: form.image ? '2px solid #1E88E5' : '2px dashed var(--bd-cfd8e3, #cfd8e3)', background: 'var(--bg-f8fafc, #F8FAFC)', flexShrink: 0, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imgLoading ? <span style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)' }}>Uploading…</span>
                    : form.image ? <>
                        <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => setForm(f => ({ ...f, image: '' }))} aria-label="Remove photo"
                          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,53,69,.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
                      </>
                    : <Package size={34} color="#cfd8e3" />}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-374151, #374151)' }}>Product photo</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ padding: '9px 14px', background: '#1E88E5', color: '#fff', borderRadius: 8, cursor: imgLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Camera size={15} /> Take photo
                      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImageFile} disabled={imgLoading} />
                    </label>
                    <label style={{ padding: '9px 14px', background: 'var(--bg-f1f3f5, #F1F3F5)', color: 'var(--tx-374151, #374151)', borderRadius: 8, cursor: imgLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ImagePlus size={15} /> Choose file
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} disabled={imgLoading} />
                    </label>
                  </div>
                </div>
              </div>

              {/* ── 2. Essentials ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Product name *</label>
                  <input ref={nameRef} value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Walton 12W LED Bulb" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Price (৳) *</label>
                  <input type="number" inputMode="decimal" value={form.price ?? ''} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Stock</label>
                  <input type="number" inputMode="numeric" value={form.stock ?? ''} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    placeholder="0" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Category</label>
                  <select value={form.category_id || ''} onChange={e => changeCategory(e.target.value)} style={inputStyle}>
                    <option value="">— Choose category —</option>
                    {catsByName.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (hidden in shop)'}</option>)}
                  </select>
                </div>
              </div>

              {/* ── 3. More details (folded away) ── */}
              <button type="button" onClick={() => setShowMore(s => !s)}
                style={{ width: '100%', marginTop: 16, padding: '11px 12px', background: 'var(--bg-f8f9fa, #F8F9FA)', border: '1px solid var(--bd-eceff3, #eceff3)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--tx-374151, #374151)', fontFamily: 'inherit' }}>
                {showMore ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                More details
                <span style={{ fontWeight: 400, color: 'var(--tx-9aa5b1, #9aa5b1)', fontSize: 12 }}>brand, old price, specs, options, more photos…</span>
              </button>

              {showMore && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 14 }}>
                  <div>
                    <label style={labelStyle}>Brand</label>
                    <input list="admin-brands" value={form.brand ?? ''} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Walton" style={inputStyle} />
                    <datalist id="admin-brands">{brands.map(b => <option key={b} value={b} />)}</datalist>
                  </div>
                  <div>
                    <label style={labelStyle}>Old price (৳) <span style={{ fontWeight: 400, color: 'var(--tx-bbb, #bbb)' }}>shows as crossed out</span></label>
                    <input type="number" inputMode="decimal" value={form.original_price ?? ''} onChange={e => setForm(f => ({ ...f, original_price: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>SKU</label>
                    <input value={form.sku ?? ''} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} style={inputStyle} />
                  </div>

                  {/* Subcategory — shown only when the selected category has subcategory groups */}
                  {subcatOptions.length > 0 && (
                    <div>
                      <label style={labelStyle}>Subcategory <span style={{ fontWeight: 400, color: 'var(--tx-bbb, #bbb)' }}>(optional)</span></label>
                      <select value={form.subcategory_id || ''} onChange={e => setForm(f => ({ ...f, subcategory_id: e.target.value }))} style={inputStyle}>
                        <option value="">— None —</option>
                        {subcatOptions.map(s => <option key={s.id} value={s.id}>{s.header}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Active */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: isMobile ? 0 : 20 }}>
                    <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <label htmlFor="is_active" style={{ fontSize: 14 }}>Active (visible in store)</label>
                  </div>

                  {/* Description */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Description</label>
                    <textarea rows={3} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>

                  {/* Specifications */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', fontWeight: 600 }}>SPECIFICATIONS</label>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, specifications: [...(f.specifications || []), { key: '', value: '' }] }))}
                        style={{ fontSize: 12, padding: '4px 12px', background: 'var(--bg-e3f2fd, #E3F2FD)', color: '#1E88E5', border: '1px solid #1E88E5', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                        + Add Row
                      </button>
                    </div>
                    {missingSpecKeys.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--tx-9aa5b1, #9aa5b1)' }}>Used in this category:</span>
                        {missingSpecKeys.map(k => (
                          <button key={k} type="button" onClick={() => setForm(f => ({ ...f, specifications: [...(f.specifications || []), { key: k, value: '' }] }))}
                            style={{ fontSize: 11, padding: '3px 9px', background: 'var(--bg-fff, #fff)', color: 'var(--tx-1565c0, #1565C0)', border: '1px dashed #90CAF9', borderRadius: 14, cursor: 'pointer' }}>+ {k}</button>
                        ))}
                      </div>
                    )}
                    {(form.specifications || []).length === 0 ? (
                      <div style={{ padding: '18px', background: 'var(--bg-f8f9fa, #F8F9FA)', borderRadius: 8, border: '1px dashed var(--bd-e0e0e0, #e0e0e0)', textAlign: 'center', fontSize: 12, color: 'var(--tx-9aa5b1, #9aa5b1)' }}>
                        No specifications yet. Click "+ Add Row" to add details like Wattage, Model or Warranty. Next time you pick this category, the same rows appear automatically.
                      </div>
                    ) : (
                      <div style={{ border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, overflow: 'hidden' }}>
                        <datalist id="admin-spec-keys">{allSpecKeys.map(k => <option key={k} value={k} />)}</datalist>
                        {(form.specifications || []).map((spec, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, padding: '6px 10px', borderTop: i ? '1px solid var(--bd-f0f0f0, #f0f0f0)' : 'none', alignItems: 'center' }}>
                            <input list="admin-spec-keys"
                              value={spec.key} placeholder="e.g. Wattage"
                              onChange={e => setForm(f => { const s = [...f.specifications]; s[i] = { ...s[i], key: e.target.value }; return { ...f, specifications: s }; })}
                              style={{ padding: '8px 10px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', fontWeight: 600, background: 'var(--bg-fafbfc, #FAFBFC)' }} />
                            <input
                              value={spec.value} placeholder="value"
                              onChange={e => setForm(f => { const s = [...f.specifications]; s[i] = { ...s[i], value: e.target.value }; return { ...f, specifications: s }; })}
                              style={{ padding: '8px 10px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
                            <button type="button" aria-label="Remove row"
                              onClick={() => setForm(f => ({ ...f, specifications: f.specifications.filter((_, j) => j !== i) }))}
                              style={{ width: 28, height: 28, border: 'none', background: 'var(--bg-fce4e4, #fce4e4)', color: '#DC3545', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--tx-9aa5b1, #9aa5b1)', background: 'var(--bg-fafbfc, #FAFBFC)', borderTop: '1px solid var(--bd-f0f0f0, #f0f0f0)' }}>Rows left empty are not saved.</div>
                      </div>
                    )}
                  </div>

                  {/* Variants */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', fontWeight: 600 }}>OPTIONS CUSTOMERS CHOOSE (size, colour…)</label>
                      <button type="button"
                        onClick={() => {
                          const key = `custom_${Date.now()}`;
                          setForm(f => ({ ...f, variants: [...(f.variants || []), { key, label: 'NEW VARIANT', enabled: true, options: [] }] }));
                          setEditingLabel(key);
                        }}
                        style={{ fontSize: 12, padding: '4px 12px', background: 'var(--bg-e8f5e9, #E8F5E9)', color: 'var(--tx-2e7d32, #2E7D32)', border: '1px solid #2E7D32', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                        + Custom
                      </button>
                    </div>
                    {(form.variants || []).map((v, vi) => {
                      const inp = variantInput[v.key] || { value: '', price: '' };
                      const addOpt = () => {
                        if (!inp.value?.trim()) return;
                        const opt = { value: inp.value.trim(), price: inp.price ? +inp.price : null };
                        setForm(f => { const vs = [...f.variants]; vs[vi] = { ...vs[vi], options: [...vs[vi].options, opt] }; return { ...f, variants: vs }; });
                        setVariantInput(p => ({ ...p, [v.key]: { value: '', price: '' } }));
                      };
                      return (
                        <div key={v.key} style={{ border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: v.enabled ? 10 : 0 }}>
                            <input type="checkbox" checked={v.enabled}
                              onChange={e => setForm(f => { const vs = [...f.variants]; vs[vi] = { ...vs[vi], enabled: e.target.checked }; return { ...f, variants: vs }; })} />
                            {editingLabel === v.key ? (
                              <input autoFocus value={v.label}
                                onChange={e => setForm(f => { const vs = [...f.variants]; vs[vi] = { ...vs[vi], label: e.target.value.toUpperCase() }; return { ...f, variants: vs }; })}
                                onBlur={() => setEditingLabel(null)}
                                onKeyDown={e => e.key === 'Enter' && setEditingLabel(null)}
                                style={{ fontSize: 13, fontWeight: 700, border: '1px solid #1E88E5', borderRadius: 4, padding: '2px 8px', width: 140 }} />
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-212529, #212529)' }}>{v.label}</span>
                            )}
                            <button type="button" onClick={() => setEditingLabel(v.key)}
                              style={{ background: 'none', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 4, cursor: 'pointer', color: 'var(--tx-7f8c9a, #7f8c9a)', fontSize: 11, padding: '2px 6px' }}>✎ Rename</button>
                            {!BUILT_IN_KEYS.includes(v.key) && (
                              <button type="button"
                                onClick={() => setForm(f => ({ ...f, variants: f.variants.filter((_, i) => i !== vi) }))}
                                style={{ marginLeft: 'auto', background: 'var(--bg-fce4e4, #fce4e4)', color: '#DC3545', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Delete</button>
                            )}
                          </div>
                          {v.enabled && (
                            <>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                {(v.options || []).map((opt, oi) => (
                                  <span key={oi} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-e3f2fd, #E3F2FD)', color: 'var(--tx-1565c0, #1565C0)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                    {opt.value}{opt.price != null ? ` · ৳${opt.price}` : ''}
                                    <button type="button"
                                      onClick={() => setForm(f => { const vs = [...f.variants]; vs[vi] = { ...vs[vi], options: vs[vi].options.filter((_, j) => j !== oi) }; return { ...f, variants: vs }; })}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-1565c0, #1565C0)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                                  </span>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input value={inp.value ?? ''}
                                  onChange={e => setVariantInput(p => ({ ...p, [v.key]: { ...p[v.key], value: e.target.value } }))}
                                  onKeyDown={e => e.key === 'Enter' && addOpt()}
                                  placeholder="Option (e.g. 36 Inch)"
                                  style={{ flex: 2, minWidth: 0, padding: '7px 10px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 6, fontSize: 13 }} />
                                <input value={inp.price ?? ''}
                                  onChange={e => setVariantInput(p => ({ ...p, [v.key]: { ...p[v.key], price: e.target.value } }))}
                                  onKeyDown={e => e.key === 'Enter' && addOpt()}
                                  placeholder="Price ৳"
                                  type="number"
                                  style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 6, fontSize: 13 }} />
                                <button type="button" onClick={addOpt}
                                  style={{ padding: '7px 14px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Add</button>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--tx-9aa5b1, #9aa5b1)', marginTop: 4 }}>Leave price empty if this option uses the base product price.</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Extra images + image link */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>MORE PHOTOS</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {(form.extra_images || []).map((url, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={url} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--bd-e0e0e0, #e0e0e0)' }} />
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, extra_images: f.extra_images.filter((_, j) => j !== i) }))}
                            style={{ position: 'absolute', top: -6, right: -6, background: '#DC3545', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      ))}
                      <label style={{ width: 72, height: 72, border: '2px dashed var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: extraImgLoading ? 'wait' : 'pointer', color: 'var(--tx-9aa5b1, #9aa5b1)', fontSize: 11, gap: 2 }}>
                        {extraImgLoading ? 'Uploading…' : <><span style={{ fontSize: 22 }}>+</span><span>Add</span></>}
                        <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleExtraImageFiles} disabled={extraImgLoading} />
                      </label>
                    </div>
                    <label style={{ ...labelStyle, marginTop: 10 }}>Main photo link <span style={{ fontWeight: 400, color: 'var(--tx-bbb, #bbb)' }}>(instead of uploading)</span></label>
                    <input value={form.image ?? ''} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="https://…" style={inputStyle} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer — stays visible at the bottom */}
            <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-fff, #fff)', borderTop: '1px solid var(--bd-f0f0f0, #f0f0f0)', padding: isMobile ? '12px 16px' : '14px 24px', marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', borderRadius: isMobile ? 0 : '0 0 12px 12px' }}>
              {!isMobile && (
                <button onClick={() => setForm(null)} style={{ padding: '10px 18px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, background: 'var(--bg-fff, #fff)', cursor: 'pointer', marginRight: 'auto' }}>Cancel</button>
              )}
              {!form.id && (
                <button onClick={() => save(true)} disabled={saving}
                  style={{ flex: isMobile ? 1 : undefined, padding: '10px 16px', background: 'var(--bg-e3f2fd, #E3F2FD)', color: 'var(--tx-1565c0, #1565C0)', border: '1px solid #90CAF9', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 700 }}>
                  Save & add another
                </button>
              )}
              <button onClick={() => save(false)} disabled={saving}
                style={{ flex: isMobile ? 1 : undefined, padding: '10px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 700 }}>
                {saving ? 'Saving…' : form.id ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
