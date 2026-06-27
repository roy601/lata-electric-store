import { useEffect, useState } from 'react';
import { X, User, FolderOpen, Save, Plus, HardHat, Phone, Pencil, Trash2 } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { compressImage } from '../../lib/compressImage';

const ROLES = ['Senior Electrician','Electrician','AC Technician','Wiring Specialist','Solar Technician','Plumbing & Electrical','Apprentice'];

const empty = { name: '', role: 'Electrician', phone: '', image: '', bio: '', sort_order: 0, is_active: true };

function Modal({ data, onClose, onSave }) {
  const [form, setForm]       = useState(data);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.85 });
    const ext  = compressed.name.split('.').pop();
    const path = `staff_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('electricians').upload(path, compressed, { upsert: true });
    if (error) { toast.error('Upload failed: ' + error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from('electricians').getPublicUrl(path);
    set('image', pub.publicUrl);
    toast.success('Photo uploaded');
    setUploading(false);
  };

  const save = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    onSave(form);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 900 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 14, width: '90vw', maxWidth: 480, zIndex: 901, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#212529' }}>{data.id ? 'Edit Electrician' : 'Add Electrician'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', alignItems: 'center' }}><X size={22} /></button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F8F9FA', border: '2px dashed #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {form.image ? <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={32} color="#9aa5b1" />}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>PROFILE PHOTO</label>
              <label style={{ display: 'inline-block', padding: '7px 14px', background: '#E3F2FD', color: '#1E88E5', border: '1px solid #1E88E5', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {uploading ? 'Uploading…' : <><FolderOpen size={14} style={{ marginRight: 5 }} /> Upload Photo</>}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadImage(e.target.files[0])} />
              </label>
              <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 4 }}>Or paste URL below</div>
              <input value={form.image} onChange={e => set('image', e.target.value)} placeholder="https://..."
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: 7, fontSize: 12, marginTop: 5, boxSizing: 'border-box', outline: 'none' }} />
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>NAME *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mohammad Rahim"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => e.target.style.borderColor='#1E88E5'}
              onBlur={e => e.target.style.borderColor='#e0e0e0'} />
          </div>

          {/* Role */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>ROLE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={ROLES.includes(form.role) ? form.role : ''} onChange={e => { if (e.target.value) set('role', e.target.value); }}
                style={{ flex: 1, padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }}>
                <option value="">Choose or type below →</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={form.role} onChange={e => set('role', e.target.value)} placeholder="Custom role…"
                style={{ flex: 1, padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none' }}
                onFocus={e => e.target.style.borderColor='#1E88E5'}
                onBlur={e => e.target.style.borderColor='#e0e0e0'} />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>PHONE NUMBER</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="01700-000000"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => e.target.style.borderColor='#1E88E5'}
              onBlur={e => e.target.style.borderColor='#e0e0e0'} />
          </div>

          {/* Bio */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>SHORT BIO (optional)</label>
            <textarea value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="e.g. 8 years experience in industrial wiring…" rows={2}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor='#1E88E5'}
              onBlur={e => e.target.style.borderColor='#e0e0e0'} />
          </div>

          {/* Sort + Active */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>DISPLAY ORDER</label>
              <input type="number" value={form.sort_order} onChange={e => set('sort_order', +e.target.value)} min={0}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#444' }}>
                <div onClick={() => set('is_active', !form.is_active)}
                  style={{ width: 40, height: 22, borderRadius: 11, background: form.is_active ? '#1E88E5' : '#ccc', position: 'relative', transition: 'background .2s', cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', top: 2, left: form.is_active ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
                Active
              </label>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#F8F9FA', border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer', fontSize: 14, color: '#555' }}>Cancel</button>
          <button onClick={save} style={{ flex: 2, padding: '10px', background: '#1E88E5', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontSize: 14, color: '#fff' }}>
            {data.id ? <><Save size={14} style={{ marginRight: 6 }} /> Save Changes</> : <><Plus size={14} style={{ marginRight: 6 }} /> Add Electrician</>}
          </button>
        </div>
      </div>
    </>
  );
}

export default function Electricians() {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);

  const load = async () => {
    const { data } = await supabase.from('electricians').select('*').order('sort_order').order('id');
    setList(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (form) => {
    const payload = { name: form.name, role: form.role, phone: form.phone, image: form.image, bio: form.bio, sort_order: form.sort_order, is_active: form.is_active };
    let err;
    if (form.id) {
      ({ error: err } = await supabase.from('electricians').update(payload).eq('id', form.id));
    } else {
      ({ error: err } = await supabase.from('electricians').insert(payload));
    }
    if (err) { toast.error('Save failed: ' + err.message); return; }
    toast.success(form.id ? 'Electrician updated' : 'Electrician added');
    setModal(null);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this electrician?')) return;
    const { error } = await supabase.from('electricians').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Deleted');
    load();
  };

  const toggle = async (item) => {
    await supabase.from('electricians').update({ is_active: !item.is_active }).eq('id', item.id);
    load();
  };

  return (
    <AdminLayout title="Electricians">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#212529' }}>Our Electricians</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa5b1' }}>Manage the team shown on the website</p>
        </div>
        <button onClick={() => setModal({ ...empty })}
          style={{ padding: '10px 20px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Electrician
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, border: '4px solid #f0f0f0', borderTop: '4px solid #1E88E5', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, background: '#fff', borderRadius: 14, border: '2px dashed #e0e0e0' }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}><HardHat size={56} color="#9aa5b1" /></div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#212529', marginBottom: 8 }}>No electricians yet</div>
          <div style={{ fontSize: 13, color: '#9aa5b1', marginBottom: 20 }}>Add your team members so customers can see who they'll be working with.</div>
          <button onClick={() => setModal({ ...empty })}
            style={{ padding: '10px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            + Add First Electrician
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {list.map(item => (
            <div key={item.id} style={{ background: '#fff', borderRadius: 14, border: `2px solid ${item.is_active ? '#e8ecf0' : '#f0f0f0'}`, overflow: 'hidden', opacity: item.is_active ? 1 : .6, transition: 'all .2s', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
              {/* Photo */}
              <div style={{ height: 120, background: 'linear-gradient(135deg,#E3F2FD,#F8F9FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #fff', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,.15)', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={36} color="#9aa5b1" />}
                </div>
                {!item.is_active && (
                  <span style={{ position: 'absolute', top: 8, right: 8, background: '#f0f0f0', color: '#999', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12 }}>Inactive</span>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '14px 16px 12px', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#212529', marginBottom: 4 }}>{item.name}</div>
                <div style={{ display: 'inline-block', background: '#E3F2FD', color: '#1E88E5', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 16, marginBottom: 8 }}>{item.role}</div>
                {item.phone && <div style={{ fontSize: 13, color: '#555', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={12} /> {item.phone}</div>}
                {item.bio && <div style={{ fontSize: 11, color: '#9aa5b1', lineHeight: 1.5, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.bio}</div>}
              </div>

              {/* Actions */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid #F8F9FA', display: 'flex', gap: 6 }}>
                <button onClick={() => toggle(item)}
                  style={{ flex: 1, padding: '7px 0', background: item.is_active ? '#fff3cd' : '#e8f5e9', color: item.is_active ? '#856404' : '#28A745', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {item.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => setModal({ ...item })}
                  style={{ flex: 1, padding: '7px 0', background: '#E3F2FD', color: '#1E88E5', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  <Pencil size={12} style={{ marginRight: 4 }} /> Edit
                </button>
                <button onClick={() => remove(item.id)}
                  style={{ flex: 1, padding: '7px 0', background: '#fce4e4', color: '#DC3545', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  <Trash2 size={12} style={{ marginRight: 4 }} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <Modal data={modal} onClose={() => setModal(null)} onSave={save} />}
    </AdminLayout>
  );
}
