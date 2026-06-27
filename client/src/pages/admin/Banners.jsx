import { useEffect, useState, useRef } from 'react';
import { Image, Pencil, Eye, EyeOff, Trash2, FolderOpen, Clock } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import api from '../../api/axiosConfig';
import { compressImage } from '../../lib/compressImage';

const EMPTY = { image: '', title: '', subtitle: '', product_id: '', sort_order: 0, is_active: true };

export default function AdminBanners() {
  const [banners,  setBanners]  = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState(EMPTY);
  const [editId,   setEditId]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    const [bRes, pRes] = await Promise.all([
      supabase.from('banners').select('*').order('sort_order'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ]);
    setBanners(bRes.data || []);
    setProducts(pRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (b) => { setForm({ image: b.image, title: b.title||'', subtitle: b.subtitle||'', product_id: b.product_id||'', sort_order: b.sort_order, is_active: b.is_active }); setEditId(b.id); setModal(true); };
  const close    = () => { setModal(false); setForm(EMPTY); setEditId(null); };

  const uploadFile = async (file) => {
    setUploading(true);
    const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 500, quality: 0.85 });
    const fd = new FormData(); fd.append('image', compressed);
    try {
      const { data } = await api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, image: data.url }));
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const save = async () => {
    if (!form.image) { toast.error('Banner image is required'); return; }
    setSaving(true);
    const payload = { image: form.image, title: form.title||null, subtitle: form.subtitle||null, product_id: form.product_id ? +form.product_id : null, sort_order: +form.sort_order||0, is_active: form.is_active };
    const { error } = editId
      ? await supabase.from('banners').update(payload).eq('id', editId)
      : await supabase.from('banners').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? 'Banner updated' : 'Banner added');
    close(); load();
  };

  const del = async (id) => {
    if (!confirm('Delete this banner?')) return;
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Deleted'); load();
  };

  const toggleActive = async (id, current) => {
    const { error } = await supabase.from('banners').update({ is_active: !current }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setBanners(bs => bs.map(b => b.id === id ? { ...b, is_active: !current } : b));
  };

  return (
    <AdminLayout title="Banners">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#7f8c9a' }}>{banners.length} banner{banners.length !== 1 ? 's' : ''}</div>
        <button onClick={openAdd} style={{ padding: '9px 20px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ Add Banner</button>
      </div>

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div>
      ) : banners.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#9aa5b1' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Image size={56} color="#9aa5b1" /></div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No banners yet</div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>Add banners to display in the homepage carousel</div>
          <button onClick={openAdd} style={{ padding: '10px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Add First Banner</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {banners.map((b, i) => (
            <div key={b.id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', opacity: b.is_active ? 1 : .6 }}>
              <div style={{ aspectRatio: '16/5', background: '#212529', position: 'relative' }}>
                {b.image && <img src={b.image} alt={b.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                  <span style={{ background: b.is_active ? '#28A745' : '#7f8c9a', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10 }}>{b.is_active ? 'Active' : 'Hidden'}</span>
                  <span style={{ background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10 }}>#{i + 1}</span>
                </div>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: '#212529' }}>{b.title || <span style={{ color: '#9aa5b1' }}>No title</span>}</div>
                {b.subtitle && <div style={{ fontSize: 12, color: '#7f8c9a', marginBottom: 6 }}>{b.subtitle}</div>}
                {b.product_id && <div style={{ fontSize: 11, color: '#1E88E5', marginBottom: 6 }}>Links to: {products.find(p=>p.id===b.product_id)?.name || `Product #${b.product_id}`}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => openEdit(b)} style={{ flex: 1, padding: '7px 0', background: '#f0f0f0', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Pencil size={13} /> Edit</button>
                  <button onClick={() => toggleActive(b.id, b.is_active)} style={{ flex: 1, padding: '7px 0', background: b.is_active ? '#fff3cd' : '#d4edda', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: b.is_active ? '#856404' : '#155724' }}>
                    {b.is_active ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}
                  </button>
                  <button onClick={() => del(b.id)} style={{ padding: '7px 12px', background: '#fee', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={14} color="#DC3545" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && close()}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>{editId ? 'Edit Banner' : 'Add Banner'}</h3>

            {/* Image upload */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Banner Image *</label>
              {form.image && (
                <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', aspectRatio: '16/5', background: '#f0f0f0' }}>
                  <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                  placeholder="Paste image URL…"
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{ padding: '9px 14px', background: '#212529', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {uploading ? <Clock size={14} /> : <><FolderOpen size={14} /> Upload</>}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadFile(e.target.files[0])} />
              <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 4 }}>Recommended size: 1200×375px (16:5 ratio)</div>
            </div>

            {[
              { key: 'title',    label: 'Title',    placeholder: 'e.g. Summer Sale — Up to 30% Off' },
              { key: 'subtitle', label: 'Subtitle', placeholder: 'Optional tagline' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</label>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Link to Product (optional)</label>
              <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13 }}>
                <option value="">None — no link</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
                <input type="number" min="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  Active
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={close} style={{ flex: 1, padding: '11px', background: '#f0f0f0', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}>
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
