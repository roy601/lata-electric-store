import { useEffect, useState, useRef } from 'react';
import { Image, Pencil, Eye, EyeOff, Trash2, FolderOpen, Clock, Plus, X, Link2 } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import toast from 'react-hot-toast';
import { getBanners, createBanner, updateBanner, deleteBanner, getProducts, getCategories, uploadImage, errMsg } from '../../api/adminApi';
import { compressImage } from '../../lib/compressImage';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/* Where a banner can go on the home page, and the picture size for each place */
export const PLACEMENTS = {
  slider:     { label: 'Main slider',      size: '1600 × 700', ratio: '16 / 7',   max: [1600, 700], slots: null,
                note: 'The big rotating banner. Add as many as you like.' },
  side_wide:  { label: 'Side — wide',      size: '650 × 300',  ratio: '13 / 6',   max: [900, 420],  slots: 2,
                note: 'Right of the slider, stacked. The first 2 are shown.' },
  side_small: { label: 'Side — small',     size: '320 × 370',  ratio: '32 / 37',  max: [560, 650],  slots: 2,
                note: 'Under the wide tiles, side by side. The first 2 are shown.' },
};
const ORDER = ['slider', 'side_wide', 'side_small'];
const placementOf = (b) => (PLACEMENTS[b.placement] ? b.placement : 'slider');

const EMPTY = { image: '', title: '', subtitle: '', placement: 'slider', linkType: 'none', product_id: '', category_id: '', link_url: '', sort_order: 0, is_active: true };

/* Read a saved banner's link back into the form's "when clicked" choice */
const linkFromBanner = (b) => {
  const m = String(b.link_url || '').match(/^\/products\?cat=(\d+)$/);
  if (m) return { linkType: 'category', category_id: m[1] };
  if (b.link_url) return { linkType: 'page', link_url: b.link_url };
  if (b.product_id) return { linkType: 'product', product_id: String(b.product_id) };
  return { linkType: 'none' };
};

export default function AdminBanners() {
  const { isMobile } = useBreakpoint();
  const [banners,    setBanners]    = useState([]);
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(EMPTY);
  const [editId,     setEditId]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const [bRes, pRes, cRes] = await Promise.all([getBanners(), getProducts(), getCategories()]);
      setBanners(bRes.data.banners || []);
      setProducts((pRes.data.products || []).filter(p => p.is_active).sort((a, b) => a.name.localeCompare(b.name)));
      setCategories((cRes.data.categories || []).map(c => ({ ...c, name: String(c.name).trim() })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) { toast.error(errMsg(err, 'Failed to load banners')); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd  = (placement = 'slider') => { setForm({ ...EMPTY, placement }); setEditId(null); setModal(true); };
  const openEdit = (b) => {
    setForm({ ...EMPTY, image: b.image, title: b.title || '', subtitle: b.subtitle || '', placement: placementOf(b), sort_order: b.sort_order || 0, is_active: b.is_active, ...linkFromBanner(b) });
    setEditId(b.id); setModal(true);
  };
  const close = () => { setModal(false); setForm(EMPTY); setEditId(null); };
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const [maxWidth, maxHeight] = PLACEMENTS[form.placement].max;
      const compressed = await compressImage(file, { maxWidth, maxHeight, quality: 0.88 });
      const { data } = await uploadImage(compressed);
      upd('image', data.url);
      // Gentle check: does the picture's shape suit the chosen place?
      const im = new window.Image();
      im.onload = () => {
        const want = { slider: 16 / 7, side_wide: 13 / 6, side_small: 32 / 37 }[form.placement];
        const got = im.naturalWidth / im.naturalHeight;
        if (Math.abs(got - want) / want > 0.25) toast(`This picture is ${im.naturalWidth}×${im.naturalHeight}. "${PLACEMENTS[form.placement].label}" looks best at ${PLACEMENTS[form.placement].size} — edges may be cropped.`, { duration: 7000 });
      };
      im.src = data.url;
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const save = async () => {
    if (!form.image) { toast.error('Banner picture is required'); return; }
    let product_id = null, link_url = null;
    if (form.linkType === 'product') {
      if (!form.product_id) { toast.error('Choose the product to open'); return; }
      product_id = +form.product_id;
    } else if (form.linkType === 'category') {
      if (!form.category_id) { toast.error('Choose the category to open'); return; }
      link_url = `/products?cat=${form.category_id}`;
    } else if (form.linkType === 'page') {
      const u = form.link_url.trim();
      if (!/^(\/|https?:\/\/)/.test(u)) { toast.error('Link must start with / (a page on this site) or https://'); return; }
      link_url = u;
    }
    setSaving(true);
    const payload = {
      image: form.image, placement: form.placement, product_id, link_url,
      title: form.placement === 'slider' ? form.title || null : null,
      subtitle: form.placement === 'slider' ? form.subtitle || null : null,
      sort_order: +form.sort_order || 0, is_active: form.is_active,
    };
    try { editId ? await updateBanner(editId, payload) : await createBanner(payload); }
    catch (err) {
      setSaving(false);
      toast.error(/placement|link_url|column/i.test(errMsg(err)) ? 'The database needs migration 06 (banner placements) first.' : errMsg(err));
      return;
    }
    setSaving(false);
    toast.success(editId ? 'Banner updated' : 'Banner added');
    close(); load();
  };

  const del = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try { await deleteBanner(id); } catch (err) { toast.error(errMsg(err)); return; }
    toast.success('Deleted'); load();
  };
  const toggleActive = async (id, current) => {
    try { await updateBanner(id, { is_active: !current }); } catch (err) { toast.error(errMsg(err)); return; }
    setBanners(bs => bs.map(b => b.id === id ? { ...b, is_active: !current } : b));
  };

  const linkText = (b) => {
    const l = linkFromBanner(b);
    if (l.linkType === 'product')  return `Product: ${products.find(p => p.id === +l.product_id)?.name || `#${l.product_id}`}`;
    if (l.linkType === 'category') return `Category: ${categories.find(c => String(c.id) === l.category_id)?.name || `#${l.category_id}`}`;
    if (l.linkType === 'page')     return `Page: ${l.link_url}`;
    return null;
  };

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' };
  const lb  = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#212529' };

  return (
    <AdminLayout title="Banners">
      <p style={{ margin: '0 0 18px', fontSize: 13, color: '#7f8c9a', maxWidth: 760, lineHeight: 1.6 }}>
        The home page shows the <strong>main slider</strong> with a column on the right: <strong>2 wide tiles</strong> on top and <strong>2 small tiles</strong> below.
        Use the right picture size for each place. With no side tiles, the slider uses the full width.
      </p>

      {loading ? <div style={{ padding: 80, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div> : ORDER.map(key => {
        const P = PLACEMENTS[key];
        const list = banners.filter(b => placementOf(b) === key).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
        const shown = list.filter(b => b.is_active);
        return (
          <section key={key} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{P.label}</h2>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1565C0', background: '#EEF6FF', padding: '3px 10px', borderRadius: 20 }}>{P.size}</span>
              <span style={{ fontSize: 12.5, color: '#7f8c9a' }}>{P.note}{P.slots && shown.length > P.slots ? ` (${shown.length} active — only ${P.slots} show)` : ''}</span>
              <button onClick={() => openAdd(key)} style={{ marginLeft: 'auto', padding: '8px 16px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={15} /> Add
              </button>
            </div>
            {list.length === 0 ? (
              <button onClick={() => openAdd(key)} style={{ width: '100%', padding: '26px 0', background: '#FAFBFC', border: '2px dashed #E2E8F0', borderRadius: 12, cursor: 'pointer', color: '#7f8c9a', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Image size={18} /> No {P.label.toLowerCase()} banners yet — add one ({P.size})
              </button>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${key === 'side_small' ? 180 : 280}px, 1fr))`, gap: 14 }}>
                {list.map((b, i) => {
                  const hiddenBySlots = P.slots && b.is_active && shown.indexOf(b) >= P.slots;
                  return (
                    <div key={b.id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #EDF0F3', opacity: b.is_active ? 1 : .55 }}>
                      <div style={{ aspectRatio: P.ratio, background: '#F1F5F9', position: 'relative' }}>
                        {b.image && <img src={b.image} alt={b.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                          <span style={{ background: !b.is_active ? '#7f8c9a' : hiddenBySlots ? '#D97706' : '#16A34A', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10 }}>
                            {!b.is_active ? 'Hidden' : hiddenBySlots ? 'Not shown (slots full)' : 'Live'}
                          </span>
                          <span style={{ background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10 }}>#{i + 1}</span>
                        </div>
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        {b.title && <div style={{ fontWeight: 700, fontSize: 13.5, color: '#212529' }}>{b.title}</div>}
                        <div style={{ fontSize: 12, color: linkText(b) ? '#1565C0' : '#9aa5b1', display: 'flex', alignItems: 'center', gap: 5, margin: '2px 0 8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          <Link2 size={12} style={{ flexShrink: 0 }} /> {linkText(b) || 'Not clickable'}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(b)} style={{ flex: 1, padding: '7px 0', background: '#F1F3F5', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Pencil size={13} /> Edit</button>
                          <button onClick={() => toggleActive(b.id, b.is_active)} title={b.is_active ? 'Hide' : 'Show'} style={{ padding: '7px 10px', background: b.is_active ? '#fff3cd' : '#d4edda', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', color: b.is_active ? '#856404' : '#155724' }}>
                            {b.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button onClick={() => del(b.id)} title="Delete" style={{ padding: '7px 10px', background: '#fee', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={14} color="#DC3545" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {/* ── Add / edit ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 0 : '32px 16px', overflowY: 'auto' }}
          onClick={e => e.target === e.currentTarget && close()}>
          <div style={{ background: '#fff', borderRadius: isMobile ? 0 : 16, padding: isMobile ? 18 : 26, width: '100%', maxWidth: 560, minHeight: isMobile ? '100%' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, flex: 1 }}>{editId ? 'Edit banner' : 'Add banner'}</h3>
              <button onClick={close} aria-label="Close" style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={17} /></button>
            </div>

            {/* Where */}
            <label style={lb}>Where on the home page</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
              {ORDER.map(key => {
                const P = PLACEMENTS[key]; const on = form.placement === key;
                return (
                  <button key={key} type="button" onClick={() => upd('placement', key)}
                    style={{ padding: 10, borderRadius: 10, border: `2px solid ${on ? '#1E88E5' : '#E2E8F0'}`, background: on ? '#EEF6FF' : '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                    {/* mini map of the hero, with this place highlighted */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 3, height: 44, marginBottom: 8 }}>
                      <div style={{ borderRadius: 3, background: key === 'slider' ? '#1E88E5' : '#CBD5E1' }} />
                      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr 1.2fr', gap: 3 }}>
                        <div style={{ borderRadius: 2, background: key === 'side_wide' ? '#1E88E5' : '#CBD5E1' }} />
                        <div style={{ borderRadius: 2, background: key === 'side_wide' ? '#1E88E5' : '#CBD5E1' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                          <div style={{ borderRadius: 2, background: key === 'side_small' ? '#1E88E5' : '#CBD5E1' }} />
                          <div style={{ borderRadius: 2, background: key === 'side_small' ? '#1E88E5' : '#CBD5E1' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{P.label}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>{P.size}</div>
                  </button>
                );
              })}
            </div>

            {/* Picture */}
            <label style={lb}>Picture <span style={{ fontWeight: 400, color: '#7f8c9a' }}>— best at {PLACEMENTS[form.placement].size} px</span></label>
            <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: PLACEMENTS[form.placement].ratio, maxHeight: 260, background: '#F1F5F9', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #CBD5E1', marginInline: form.placement === 'side_small' ? 'auto' : 0, width: form.placement === 'side_small' ? 200 : '100%' }}>
              {form.image ? <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 12.5, color: '#94A3B8' }}>Preview ({PLACEMENTS[form.placement].size})</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <input value={form.image} onChange={e => upd('image', e.target.value)} placeholder="Paste an image link, or upload →" style={{ ...inp, flex: 1, minWidth: 0 }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ padding: '9px 14px', background: '#F1F3F5', border: 'none', borderRadius: 8, cursor: uploading ? 'wait' : 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                {uploading ? <><Clock size={14} /> Uploading…</> : <><FolderOpen size={14} /> Upload</>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { uploadFile(e.target.files[0]); e.target.value = ''; }} />
            </div>

            {/* Click target */}
            <label style={lb}>When someone clicks it, open…</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {[['none', 'Nothing'], ['product', 'A product'], ['category', 'A category'], ['page', 'Another page']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => upd('linkType', k)}
                  style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${form.linkType === k ? '#1E88E5' : '#E2E8F0'}`, background: form.linkType === k ? '#1E88E5' : '#fff', color: form.linkType === k ? '#fff' : '#334155', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {label}
                </button>
              ))}
            </div>
            {form.linkType === 'product' && (
              <select value={form.product_id} onChange={e => upd('product_id', e.target.value)} style={{ ...inp, marginBottom: 18 }}>
                <option value="">— Choose a product —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {form.linkType === 'category' && (
              <select value={form.category_id} onChange={e => upd('category_id', e.target.value)} style={{ ...inp, marginBottom: 18 }}>
                <option value="">— Choose a category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {form.linkType === 'page' && (
              <div style={{ marginBottom: 18 }}>
                <input value={form.link_url} onChange={e => upd('link_url', e.target.value)} placeholder="/flash-sale   or   /products?q=walton   or   https://…" style={inp} />
                <div style={{ fontSize: 11.5, color: '#7f8c9a', marginTop: 4 }}>A page on this site starts with “/”. Outside links start with https://</div>
              </div>
            )}
            {form.linkType === 'none' && <div style={{ marginBottom: 18 }} />}

            {/* Text over the slider picture (optional) */}
            {form.placement === 'slider' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 6 }}>
                <div><label style={lb}>Title <span style={{ fontWeight: 400, color: '#7f8c9a' }}>(optional)</span></label>
                  <input value={form.title} onChange={e => upd('title', e.target.value)} placeholder="e.g. Summer Sale" style={inp} /></div>
                <div><label style={lb}>Subtitle <span style={{ fontWeight: 400, color: '#7f8c9a' }}>(optional)</span></label>
                  <input value={form.subtitle} onChange={e => upd('subtitle', e.target.value)} placeholder="Short tagline" style={inp} /></div>
              </div>
            )}
            {form.placement === 'slider' && <div style={{ fontSize: 11.5, color: '#7f8c9a', marginBottom: 16 }}>Shown over the picture. Leave empty when the picture already has its text.</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                Order <input type="number" value={form.sort_order} onChange={e => upd('sort_order', e.target.value)} style={{ ...inp, width: 80 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} /> Show on the website
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={close} style={{ padding: '10px 20px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save} disabled={saving || uploading} style={{ padding: '10px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : editId ? 'Save changes' : 'Add banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
