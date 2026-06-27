import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const EMPTY = { name: '', slug: '', icon: 'bi-grid', color: '#1E88E5', is_active: true, sort_order: 0 };
const EMPTY_GROUP = { header: '', items: [] };

const toSlug = (s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

/* ── Inline tag input for subcategory items ─────────────────── */
function TagInput({ items, onChange }) {
  const [input, setInput] = useState('');
  const add = () => { const v = input.trim(); if (v && !items.includes(v)) onChange([...items, v]); setInput(''); };
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, minHeight:34, border:'1px solid #e0e0e0', borderRadius:7, padding:'5px 8px', background:'#fafafa', marginBottom:5 }}>
        {items.map((item, i) => (
          <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:3, background:'#E3F2FD', color:'#1E88E5', fontSize:12, fontWeight:500, padding:'2px 8px 2px 9px', borderRadius:20 }}>
            {item}
            <button onClick={() => onChange(items.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'#1E88E5', fontSize:14, lineHeight:1, padding:0, opacity:.7 }}>×</button>
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize:12, color:'#bbb', lineHeight:'26px' }}>No items yet</span>}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'||e.key===','){e.preventDefault();add();} }}
          placeholder="Type item + Enter"
          style={{ flex:1, padding:'6px 10px', border:'1px solid #e0e0e0', borderRadius:6, fontSize:13, outline:'none' }}
          onFocus={e=>e.target.style.borderColor='#1E88E5'} onBlur={e=>e.target.style.borderColor='#e0e0e0'}
        />
        <button onClick={add} style={{ padding:'6px 12px', background:'#1E88E5', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:700 }}>+</button>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const [cats, setCats]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [form, setForm]             = useState(null);
  const [saving, setSaving]         = useState(false);
  const [subcats, setSubcats]       = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [groupDraft, setGroupDraft] = useState(null); // null = closed
  const [groupSaving, setGroupSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*, products(count)').order('sort_order');
    setCats(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Fetch subcategory groups whenever an existing category is opened
  useEffect(() => {
    if (!form?.id) { setSubcats([]); return; }
    setSubLoading(true);
    supabase.from('subcategories').select('*').eq('category_id', form.id).order('sort_order')
      .then(({ data }) => { setSubcats(data || []); setSubLoading(false); });
  }, [form?.id]);

  const openForm = (cat) => { setForm(cat ? { ...cat } : { ...EMPTY }); setGroupDraft(null); };
  const closeForm = () => { setForm(null); setGroupDraft(null); };

  const save = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    const { products: _p, ...rest } = form;
    const payload = { ...rest, slug: form.slug || toSlug(form.name) };

    if (form.id) {
      const { error } = await supabase.from('categories').update(payload).eq('id', form.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Updated');
      load();
    } else {
      const { data, error } = await supabase.from('categories').insert(payload).select('*, products(count)').single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Category saved — you can now add subcategories below (optional)');
      setCats(prev => [data, ...prev]);
      setForm({ ...data }); // switch to edit mode to show subcategory section
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? Products in this category will be uncategorised.`)) return;
    await supabase.from('categories').delete().eq('id', id);
    toast.success('Deleted');
    setCats(prev => prev.filter(c => c.id !== id));
  };

  const saveGroup = async () => {
    if (!groupDraft.header.trim()) { toast.error('Group header is required'); return; }
    setGroupSaving(true);
    const { data, error } = await supabase.from('subcategories')
      .insert({ category_id: form.id, header: groupDraft.header.trim(), items: groupDraft.items, sort_order: subcats.length })
      .select().single();
    setGroupSaving(false);
    if (error) { toast.error('Failed: ' + error.message); return; }
    setSubcats(s => [...s, data]);
    setGroupDraft(null);
    toast.success('Subcategory group added');
  };

  const deleteGroup = async (id) => {
    if (!window.confirm('Delete this subcategory group?')) return;
    const { error } = await supabase.from('subcategories').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    setSubcats(s => s.filter(g => g.id !== id));
    toast.success('Deleted');
  };

  return (
    <AdminLayout title="Categories">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={() => openForm(null)} style={{ padding: '9px 20px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          + Add Category
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div>
        ) : cats.map(c => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                <i className={c.icon} style={{ color: c.color }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#212529' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#9aa5b1' }}>{c.products?.[0]?.count || 0} products</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ flex: 1, background: c.is_active ? '#d1e7dd' : '#f8d7da', color: c.is_active ? '#0f5132' : '#842029', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {c.is_active ? 'Active' : 'Hidden'}
              </span>
              <button onClick={() => openForm(c)} style={{ padding: '5px 12px', background: '#212529', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Edit</button>
              <button onClick={() => remove(c.id, c.name)} style={{ padding: '5px 12px', background: '#f8d7da', color: '#842029', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Del</button>
            </div>
          </div>
        ))}
        {!loading && cats.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 60, textAlign: 'center', color: '#9aa5b1' }}>No categories yet</div>
        )}
      </div>

      {/* ── Modal ── */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 520, marginBottom: 32 }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{form.id ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa5b1', padding: 4 }}><X size={20} /></button>
            </div>

            {/* ── Category fields ── */}
            {[
              { key: 'name',       label: 'Name *' },
              { key: 'slug',       label: 'Slug (auto-generated)' },
              { key: 'sort_order', label: 'Sort Order', type: 'number' },
            ].map(({ key, label, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>{label}</label>
                <input type={type || 'text'} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  onBlur={key === 'name' && !form.slug ? () => setForm(f => ({ ...f, slug: toSlug(f.name) })) : undefined}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Color</label>
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 60, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <input type="checkbox" id="cat_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <label htmlFor="cat_active" style={{ fontSize: 14 }}>Active</label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: form.id ? 24 : 0 }}>
              <button onClick={closeForm} style={{ padding: '9px 20px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Saving…' : form.id ? 'Update Category' : 'Save & Continue'}
              </button>
            </div>

            {/* ── Subcategory Groups (only shown for saved categories) ── */}
            {form.id && (
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#212529' }}>
                      Subcategory Groups
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#9aa5b1', fontWeight: 400 }}>— optional</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 2 }}>Shown in the mega menu flyout for this category</div>
                  </div>
                  {groupDraft === null && (
                    <button onClick={() => setGroupDraft({ ...EMPTY_GROUP })}
                      style={{ padding: '7px 14px', background: '#E3F2FD', color: '#1E88E5', border: '1px solid #1E88E5', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      + Add Group
                    </button>
                  )}
                </div>

                {/* Existing groups list */}
                {subLoading ? (
                  <div style={{ padding: '12px 0', color: '#9aa5b1', fontSize: 13 }}>Loading…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: subcats.length > 0 ? 12 : 0 }}>
                    {subcats.map(g => (
                      <div key={g.id} style={{ background: '#F8F9FA', borderRadius: 8, border: '1px solid #e8ecf0', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#212529' }}>{g.header}</span>
                          <button onClick={() => deleteGroup(g.id)}
                            style={{ padding: '3px 10px', background: '#fee2e2', color: '#DC2626', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Delete
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(g.items || []).length === 0
                            ? <span style={{ fontSize: 12, color: '#bbb' }}>No items</span>
                            : (g.items || []).map((item, i) => (
                                <span key={i} style={{ background: '#fff', border: '1px solid #e0e0e0', color: '#555', fontSize: 11, padding: '2px 8px', borderRadius: 12 }}>{item}</span>
                              ))
                          }
                        </div>
                      </div>
                    ))}
                    {subcats.length === 0 && groupDraft === null && (
                      <div style={{ background: '#F8F9FA', borderRadius: 8, padding: '14px', textAlign: 'center', fontSize: 13, color: '#9aa5b1' }}>
                        No subcategory groups yet — click "+ Add Group" to create one
                      </div>
                    )}
                  </div>
                )}

                {/* New group inline form */}
                {groupDraft !== null && (
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1E40AF', marginBottom: 12 }}>New Subcategory Group</div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: 600, marginBottom: 4 }}>GROUP HEADER *</label>
                      <input value={groupDraft.header} onChange={e => setGroupDraft(d => ({ ...d, header: e.target.value }))}
                        placeholder="e.g. House & Building Wire"
                        style={{ width: '100%', padding: '8px 11px', border: '1px solid #BFDBFE', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                        onFocus={e=>e.target.style.borderColor='#1E88E5'} onBlur={e=>e.target.style.borderColor='#BFDBFE'}
                      />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: 600, marginBottom: 4 }}>ITEMS</label>
                      <TagInput items={groupDraft.items} onChange={items => setGroupDraft(d => ({ ...d, items }))} />
                      <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 3 }}>Press Enter or comma to add each item. Example: 1.5mm, 2.5mm, 4mm</div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setGroupDraft(null)} style={{ padding: '7px 16px', background: '#fff', color: '#555', border: '1px solid #e0e0e0', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                      <button onClick={saveGroup} disabled={groupSaving} style={{ padding: '7px 18px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        {groupSaving ? 'Saving…' : 'Save Group'}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      )}
    </AdminLayout>
  );
}
