import { useEffect, useState } from 'react';
import { Package, X } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../api/adminApi';
import { compressImage } from '../../lib/compressImage';
import toast from 'react-hot-toast';

const EMPTY_VARIANTS = { size: { enabled: false, options: [] }, color: { enabled: false, options: [] }, warranty: { enabled: false, options: [] } };
const EMPTY = { name: '', brand: '', sku: '', price: '', original_price: '', stock: '', description: '', image: '', category_id: '', subcategory_id: '', is_active: true, specifications: [], variants: EMPTY_VARIANTS };

export default function AdminProducts() {
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [form, setForm]             = useState(null); // null = closed, {} = new, {...} = edit
  const [saving, setSaving]         = useState(false);
  const [imgLoading, setImgLoading]       = useState(false);
  const [subcatOptions, setSubcatOptions] = useState([]);
  const [variantInput, setVariantInput]   = useState({ size: '', color: '', warranty: '' });

  const load = async () => {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      supabase.from('products').select('*, categories(name)').order('id', { ascending: false }),
      supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
    ]);
    setProducts(pRes.data || []);
    setCategories(cRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // When category changes, load its subcategory groups
  useEffect(() => {
    const catId = form?.category_id;
    if (!catId) { setSubcatOptions([]); return; }
    supabase.from('subcategories').select('id, header').eq('category_id', catId).order('sort_order')
      .then(({ data }) => setSubcatOptions(data || []));
  }, [form?.category_id]);

  const handleImageFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImgLoading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
      const { data } = await uploadImage(compressed);
      setForm(f => ({ ...f, image: data.url }));
      toast.success('Image uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setImgLoading(false); }
  };

  const save = async () => {
    if (!form.name || !form.price) { toast.error('Name and price are required'); return; }
    setSaving(true);
    const payload = {
      name:           form.name,
      brand:          form.brand || null,
      sku:            form.sku   || null,
      price:          +form.price,
      original_price: form.original_price ? +form.original_price : null,
      stock:          +form.stock || 0,
      description:    form.description || null,
      image:          form.image || null,
      category_id:    form.category_id    ? +form.category_id    : null,
      subcategory_id: form.subcategory_id || null,
      is_active:      form.is_active,
      specifications: (form.specifications || []).filter(s => s.key.trim() && s.value.trim()),
      variants: form.variants || EMPTY_VARIANTS,
    };

    let error;
    if (form.id) {
      ({ error } = await supabase.from('products').update(payload).eq('id', form.id));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }
    setSaving(false);
    if (error) { console.error('Save error:', error); toast.error('Save failed: ' + error.message); return; }
    toast.success(form.id ? 'Product updated' : 'Product added');
    setForm(null);
    load();
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await supabase.from('products').delete().eq('id', id);
    toast.success('Deleted');
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const visible = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search)
  );

  return (
    <AdminLayout title="Products">
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <input
          placeholder="Search products…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '9px 14px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14 }}
        />
        <button onClick={() => setForm({ ...EMPTY })} style={{ padding: '9px 20px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          + Add Product
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#7f8c9a', marginBottom: 16 }}>
        {search ? `${visible.length} of ${products.length} products` : `${products.length} products total`}
        {products.filter(p => p.stock === 0).length > 0 && (
          <span style={{ marginLeft: 12, background: '#f8d7da', color: '#842029', padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            {products.filter(p => p.stock === 0).length} out of stock
          </span>
        )}
        {products.filter(p => p.stock > 0 && p.stock <= 5).length > 0 && (
          <span style={{ marginLeft: 6, background: '#fff3cd', color: '#856404', padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            {products.filter(p => p.stock > 0 && p.stock <= 5).length} low stock
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                {['Image', 'Name', 'Category', 'Price', 'Stock', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#7f8c9a', fontWeight: 600, borderBottom: '1px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F8F9FA' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: '#F8F9FA', backgroundImage: p.image ? `url(${p.image})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!p.image && <Package size={20} color="#ccc" />}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#212529' }}>{p.name}</div>
                    {p.sku && <div style={{ color: '#9aa5b1', fontSize: 12 }}>SKU: {p.sku}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555' }}>{p.categories?.name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                    ৳{p.price}
                    {p.original_price && <div style={{ color: '#9aa5b1', fontSize: 12, textDecoration: 'line-through' }}>৳{p.original_price}</div>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: p.stock === 0 ? '#f8d7da' : p.stock <= 5 ? '#fff3cd' : '#d1e7dd', color: p.stock === 0 ? '#842029' : p.stock <= 5 ? '#856404' : '#0f5132', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {p.stock === 0 ? 'Out' : p.stock}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: p.is_active ? '#d1e7dd' : '#f8d7da', color: p.is_active ? '#0f5132' : '#842029', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {p.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => setForm({ ...p, category_id: p.category_id || '', subcategory_id: p.subcategory_id || '', specifications: Array.isArray(p.specifications) ? p.specifications : [], variants: p.variants || EMPTY_VARIANTS })} style={{ marginRight: 6, padding: '5px 12px', background: '#212529', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                    <button onClick={() => remove(p.id, p.name)} style={{ padding: '5px 12px', background: '#f8d7da', color: '#842029', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Delete</button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>No products found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 560 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{form.id ? 'Edit Product' : 'Add Product'}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { key: 'name',           label: 'Product Name *', span: 2 },
                { key: 'price',          label: 'Price (৳) *',    type: 'number' },
                { key: 'original_price', label: 'Original Price (৳)', type: 'number' },
                { key: 'stock',          label: 'Stock',          type: 'number' },
                { key: 'sku',            label: 'SKU' },
                { key: 'brand',          label: 'Brand' },
              ].map(({ key, label, type, span }) => (
                <div key={key} style={{ gridColumn: span === 2 ? '1 / -1' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>{label}</label>
                  <input
                    type={type || 'text'} value={form[key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Category</label>
                <select value={form.category_id || ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value, subcategory_id: '' }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14 }}>
                  <option value="">— None —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Subcategory — shown only when the selected category has subcategory groups */}
              {subcatOptions.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Subcategory <span style={{ fontWeight: 400, color: '#bbb' }}>(optional)</span></label>
                  <select value={form.subcategory_id || ''} onChange={e => setForm(f => ({ ...f, subcategory_id: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14 }}>
                    <option value="">— None —</option>
                    {subcatOptions.map(s => <option key={s.id} value={s.id}>{s.header}</option>)}
                  </select>
                </div>
              )}

              {/* Active */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label htmlFor="is_active" style={{ fontSize: 14 }}>Active (visible in store)</label>
              </div>

              {/* Description */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Description</label>
                <textarea rows={3} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              {/* Specifications */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: '#7f8c9a', fontWeight: 600 }}>SPECIFICATIONS</label>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, specifications: [...(f.specifications || []), { key: '', value: '' }] }))}
                    style={{ fontSize: 12, padding: '4px 12px', background: '#E3F2FD', color: '#1E88E5', border: '1px solid #1E88E5', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                    + Add Row
                  </button>
                </div>
                {(form.specifications || []).length === 0 ? (
                  <div style={{ padding: '18px', background: '#F8F9FA', borderRadius: 8, border: '1px dashed #e0e0e0', textAlign: 'center', fontSize: 12, color: '#9aa5b1' }}>
                    No specifications yet. Click "+ Add Row" to add product details like Model, Battery Life, Weight, etc.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', background: '#F8F9FA', padding: '7px 10px', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1' }}>PROPERTY</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1' }}>VALUE</span>
                    </div>
                    {(form.specifications || []).map((spec, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, padding: '6px 10px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
                        <input
                          value={spec.key} placeholder="e.g. Model"
                          onChange={e => setForm(f => { const s = [...f.specifications]; s[i] = { ...s[i], key: e.target.value }; return { ...f, specifications: s }; })}
                          style={{ padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor='#1E88E5'}
                          onBlur={e => e.target.style.borderColor='#e0e0e0'}
                        />
                        <input
                          value={spec.value} placeholder="e.g. ENCHEN Boost"
                          onChange={e => setForm(f => { const s = [...f.specifications]; s[i] = { ...s[i], value: e.target.value }; return { ...f, specifications: s }; })}
                          style={{ padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor='#1E88E5'}
                          onBlur={e => e.target.style.borderColor='#e0e0e0'}
                        />
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, specifications: f.specifications.filter((_, j) => j !== i) }))}
                          style={{ width: 28, height: 28, border: 'none', background: '#fce4e4', color: '#DC3545', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Variants */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', fontWeight: 600, marginBottom: 8 }}>VARIANTS (Size / Color / Warranty)</label>
                {[
                  { key: 'size',     label: 'SIZE' },
                  { key: 'color',    label: 'COLOR' },
                  { key: 'warranty', label: 'WARRANTY' },
                ].map(({ key, label }) => {
                  const v = form.variants?.[key] || { enabled: false, options: [] };
                  return (
                    <div key={key} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: v.enabled ? 10 : 0 }}>
                        <input type="checkbox" id={`v-${key}`} checked={v.enabled}
                          onChange={e => setForm(f => ({ ...f, variants: { ...f.variants, [key]: { ...v, enabled: e.target.checked } } }))} />
                        <label htmlFor={`v-${key}`} style={{ fontSize: 13, fontWeight: 700, color: '#212529', cursor: 'pointer' }}>{label}</label>
                      </div>
                      {v.enabled && (
                        <>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {v.options.map((opt, i) => (
                              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#E3F2FD', color: '#1565C0', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                {opt}
                                <button type="button" onClick={() => setForm(f => ({ ...f, variants: { ...f.variants, [key]: { ...v, options: v.options.filter((_, j) => j !== i) } } }))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1565C0', padding: 0, display: 'flex', lineHeight: 1 }}>×</button>
                              </span>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input value={variantInput[key]} onChange={e => setVariantInput(p => ({ ...p, [key]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && variantInput[key].trim()) {
                                  e.preventDefault();
                                  setForm(f => ({ ...f, variants: { ...f.variants, [key]: { ...v, options: [...v.options, variantInput[key].trim()] } } }));
                                  setVariantInput(p => ({ ...p, [key]: '' }));
                                }
                              }}
                              placeholder={`e.g. ${key === 'size' ? '36 Inch' : key === 'color' ? 'White and Golden' : '2 Years'}`}
                              style={{ flex: 1, padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13 }} />
                            <button type="button"
                              onClick={() => {
                                if (!variantInput[key].trim()) return;
                                setForm(f => ({ ...f, variants: { ...f.variants, [key]: { ...v, options: [...v.options, variantInput[key].trim()] } } }));
                                setVariantInput(p => ({ ...p, [key]: '' }));
                              }}
                              style={{ padding: '7px 14px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Add</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Image */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Image URL (or upload)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={form.image ?? ''} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="https://…"
                    style={{ flex: 1, padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14 }} />
                  <label style={{ padding: '9px 14px', background: '#f0f0f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {imgLoading ? 'Uploading…' : 'Upload'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} disabled={imgLoading} />
                  </label>
                </div>
                {form.image && <img src={form.image} alt="" style={{ marginTop: 8, height: 80, borderRadius: 8, objectFit: 'cover' }} />}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setForm(null)} style={{ padding: '9px 20px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Saving…' : form.id ? 'Update' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
