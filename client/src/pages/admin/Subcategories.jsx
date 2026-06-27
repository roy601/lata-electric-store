import { useEffect, useState } from 'react';
import { Lightbulb, FolderOpen } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const EMPTY_GROUP = { header: '', items: [] };

/* ─── Item tag input ─────────────────────────────────────────── */
function TagInput({ items, onChange }) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) { onChange([...items, v]); }
    setInput('');
  };

  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36, border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 8px', background: '#fafafa', marginBottom: 6 }}>
        {items.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E3F2FD', color: '#1E88E5', fontSize: 12, fontWeight: 500, padding: '3px 9px 3px 10px', borderRadius: 20, border: '1px solid #f5c6c0' }}>
            {item}
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E88E5', fontSize: 14, lineHeight: 1, padding: 0, opacity: .7 }}>×</button>
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12, color: '#bbb', lineHeight: '28px' }}>No items yet — type below to add</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === ',') { e.preventDefault(); add(); } }}
          placeholder="Type item name + Enter"
          style={{ flex: 1, padding: '7px 11px', border: '1px solid #e0e0e0', borderRadius: 7, fontSize: 13, outline: 'none' }}
          onFocus={e => e.target.style.borderColor='#1E88E5'}
          onBlur={e => e.target.style.borderColor='#e0e0e0'}
        />
        <button onClick={add} style={{ padding: '7px 14px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ Add</button>
      </div>
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Press Enter or comma to add. Click × to remove.</div>
    </div>
  );
}

/* ─── Group editor modal ─────────────────────────────────────── */
function GroupModal({ group, onSave, onClose }) {
  const [form, setForm] = useState({ header: group?.header || '', items: group?.items || [], sort_order: group?.sort_order || 0 });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 520, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#212529', marginBottom: 20 }}>
          {group?.id ? 'Edit Subcategory Group' : 'Add Subcategory Group'}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>GROUP HEADER *</label>
          <input value={form.header} onChange={e => setForm(f => ({ ...f, header: e.target.value }))}
            placeholder="e.g. House & Building Wire"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor='#1E88E5'}
            onBlur={e => e.target.style.borderColor='#e0e0e0'}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>SUBCATEGORY ITEMS</label>
          <TagInput items={form.items} onChange={items => setForm(f => ({ ...f, items }))} />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>SORT ORDER</label>
          <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))}
            style={{ width: 100, padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: '#F8F9FA', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={() => { if (!form.header.trim()) { toast.error('Group header is required'); return; } onSave(form); }}
            style={{ padding: '9px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            {group?.id ? 'Save Changes' : 'Add Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function AdminSubcategories() {
  const [categories, setCategories]   = useState([]);
  const [subcats,    setSubcats]      = useState([]);
  const [selCatId,   setSelCatId]     = useState(null);
  const [loading,    setLoading]      = useState(true);
  const [modal,      setModal]        = useState(null); // null | { group } for edit | {} for new
  const [saving,     setSaving]       = useState(false);

  useEffect(() => {
    const load = async () => {
      const [cRes, sRes] = await Promise.all([
        supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
        supabase.from('subcategories').select('*').order('sort_order'),
      ]);
      const cats = cRes.data || [];
      setCategories(cats);
      setSubcats(sRes.data || []);
      if (cats.length > 0) setSelCatId(cats[0].id);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = subcats.filter(s => s.category_id === selCatId);
  const selCat   = categories.find(c => c.id === selCatId);

  const handleSave = async (form) => {
    setSaving(true);
    if (modal?.id) {
      // Update
      const { error } = await supabase.from('subcategories').update({ header: form.header, items: form.items, sort_order: form.sort_order }).eq('id', modal.id);
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      setSubcats(s => s.map(g => g.id === modal.id ? { ...g, ...form } : g));
      toast.success('Group updated');
    } else {
      // Insert
      const { data, error } = await supabase.from('subcategories').insert({ category_id: selCatId, header: form.header, items: form.items, sort_order: form.sort_order }).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      setSubcats(s => [...s, data]);
      toast.success('Group added');
    }
    setSaving(false);
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subcategory group?')) return;
    const { error } = await supabase.from('subcategories').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    setSubcats(s => s.filter(g => g.id !== id));
    toast.success('Group deleted');
  };

  const moveOrder = async (group, dir) => {
    const newOrder = group.sort_order + dir;
    const { error } = await supabase.from('subcategories').update({ sort_order: newOrder }).eq('id', group.id);
    if (!error) setSubcats(s => s.map(g => g.id === group.id ? { ...g, sort_order: newOrder } : g).sort((a, b) => a.sort_order - b.sort_order));
  };

  return (
    <AdminLayout title="Subcategories / Mega Menu">
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Category selector ── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ecf0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 13, color: '#555', textTransform: 'uppercase', letterSpacing: .5 }}>
            Parent Categories
          </div>
          {loading ? (
            <div style={{ padding: 20, color: '#aaa', fontSize: 13 }}>Loading…</div>
          ) : (
            categories.map(c => {
              const count = subcats.filter(s => s.category_id === c.id).length;
              const active = selCatId === c.id;
              return (
                <div key={c.id} onClick={() => setSelCatId(c.id)}
                  style={{ padding: '10px 16px', cursor: 'pointer', background: active ? '#E3F2FD' : 'transparent', borderLeft: `3px solid ${active ? '#1E88E5' : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .1s' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background='#fafafa'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}>
                  <span style={{ fontSize: 13, color: active ? '#1E88E5' : '#333', fontWeight: active ? 700 : 400 }}>{c.name}</span>
                  <span style={{ fontSize: 11, background: count > 0 ? '#E3F2FD' : '#F8F9FA', color: count > 0 ? '#1E88E5' : '#aaa', padding: '2px 7px', borderRadius: 12, fontWeight: 600 }}>{count}</span>
                </div>
              );
            })
          )}
        </div>

        {/* ── Subcategory groups editor ── */}
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#212529' }}>{selCat?.name || 'Select a category'}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa5b1' }}>
                {filtered.length} subcategory group{filtered.length !== 1 ? 's' : ''} — these appear in the mega menu flyout panel
              </p>
            </div>
            <button onClick={() => setModal({})}
              style={{ padding: '9px 20px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              + Add Group
            </button>
          </div>

          {/* Info banner */}
          <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 10, padding: '10px 16px', marginBottom: 18, fontSize: 12, color: '#856404' }}>
            <Lightbulb size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Each group = a bold header in the mega menu (e.g., "House & Building Wire") with subcategory links listed below it. Changes appear instantly on the storefront.
          </div>

          {/* Groups list */}
          {loading ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', color: '#aaa' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '2px dashed #e0e0e0', padding: '60px 0', textAlign: 'center', color: '#aaa' }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><FolderOpen size={40} color="#ccc" /></div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#555' }}>No subcategory groups yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Add groups to make the mega menu appear for this category.</div>
              <button onClick={() => setModal({})}
                style={{ padding: '9px 22px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                + Add First Group
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {[...filtered].sort((a,b) => a.sort_order - b.sort_order).map((group, idx) => (
                <div key={group.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ecf0', overflow: 'hidden' }}>
                  {/* Group header row */}
                  <div style={{ padding: '12px 18px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 10 }}>
                      <span style={{ background: '#1E88E5', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#212529' }}>{group.header}</span>
                      <span style={{ fontSize: 12, color: '#9aa5b1' }}>{group.items?.length || 0} items</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => moveOrder(group, -1)} title="Move up"
                        style={{ width: 30, height: 30, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 7, cursor: 'pointer', fontSize: 14 }}>↑</button>
                      <button onClick={() => moveOrder(group, 1)} title="Move down"
                        style={{ width: 30, height: 30, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 7, cursor: 'pointer', fontSize: 14 }}>↓</button>
                      <button onClick={() => setModal(group)}
                        style={{ padding: '5px 14px', background: '#212529', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit</button>
                      <button onClick={() => handleDelete(group.id)}
                        style={{ padding: '5px 14px', background: '#fff', color: '#1E88E5', border: '1px solid #1E88E5', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Delete</button>
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(group.items || []).length === 0 ? (
                      <span style={{ fontSize: 12, color: '#bbb' }}>No items — click Edit to add</span>
                    ) : (
                      (group.items || []).map((item, i) => (
                        <span key={i} style={{ background: '#F8F9FA', color: '#444', fontSize: 12, padding: '3px 10px', borderRadius: 14 }}>{item}</span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal !== null && (
        <GroupModal group={modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </AdminLayout>
  );
}
