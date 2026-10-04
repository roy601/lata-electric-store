import { useEffect, useState } from 'react';
import { X, Plus, Pencil, ChevronUp, ChevronDown, EyeOff, Trash2, Layers } from 'lucide-react';
import {
  createCategory, updateCategory, deleteCategory,
  getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory, bulkProducts, errMsg,
} from '../../api/adminApi';
import toast from 'react-hot-toast';

export const toSlug = (s) => s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
/** Detach products (ids) by patching fields, 100 at a time. */
async function patchProducts(ids, patch) {
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await bulkProducts(ids.slice(i, i + 100).map(id => ({ id, ...patch })));
    const bad = data.results.find(r => !r.ok);
    if (bad) throw new Error(bad.error);
  }
}

const COLORS = ['#1E88E5', '#43A047', '#E53935', '#FB8C00', '#8E24AA', '#00897B', '#F4B400', '#546E7A'];

/** Creates a category at the end of the list. Returns the new row or null. */
export async function quickCreateCategory(name, categories) {
  const clean = name.trim();
  if (!clean) return null;
  if (categories.some(c => c.name.trim().toLowerCase() === clean.toLowerCase())) {
    toast.error(`"${clean}" already exists`);
    return null;
  }
  try {
    const { data } = await createCategory({
      name: clean, slug: toSlug(clean) || `cat-${Date.now()}`, icon: 'bi-grid', color: '#1E88E5', is_active: true,
      sort_order: Math.max(0, ...categories.map(c => +c.sort_order || 0)) + 1,
    });
    toast.success(`Category "${clean}" created`);
    return data.item;
  } catch (err) { toast.error(errMsg(err, 'Could not create category')); return null; }
}

/* ── Small inline "type a name + Enter" box ── */
function NewCategoryInput({ categories, onCreated, compact = false }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    const cat = await quickCreateCategory(name, categories);
    setBusy(false);
    if (cat) { setName(''); onCreated(cat); }
  };
  return (
    <div style={{ display: 'flex', gap: 6, padding: compact ? 0 : '10px 12px', borderTop: compact ? 'none' : '1px solid #f0f2f5' }}>
      <input value={name} onChange={e => setName(e.target.value)} disabled={busy}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="New category name…"
        style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13 }} />
      <button onClick={submit} disabled={busy || !name.trim()} title="Add category"
        style={{ padding: '0 12px', background: name.trim() ? '#1E88E5' : '#e9edf2', color: name.trim() ? '#fff' : '#9aa5b1', border: 'none', borderRadius: 8, cursor: name.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/* ── Desktop: category list on the left ── */
export function CategorySidebar({ categories, counts, total, uncategorised, selected, onSelect, onEdit, onCreated }) {
  const row = (key, label, count, extra = {}) => {
    const active = selected === key;
    return (
      <div key={key} onClick={() => onSelect(key)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', borderLeft: `3px solid ${active ? '#1E88E5' : 'transparent'}`, background: active ? '#EEF6FF' : 'transparent' }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.querySelector('[data-edit]')?.style.setProperty('opacity', '1'); }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelector('[data-edit]')?.style.setProperty('opacity', active ? '1' : '0'); }}>
        {extra.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: extra.color, flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: active ? '#1565C0' : '#2d3748', fontWeight: active ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: extra.italic ? 'italic' : 'normal' }}>{label}</span>
        {extra.hidden && <EyeOff size={13} color="#b0bac5" title="Hidden in shop" />}
        <span style={{ fontSize: 11, color: active ? '#1565C0' : '#9aa5b1', fontWeight: 600 }}>{count}</span>
        {extra.onEdit && (
          <button data-edit onClick={e => { e.stopPropagation(); extra.onEdit(); }} title="Edit category"
            style={{ opacity: active ? 1 : 0, transition: 'opacity .12s', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Pencil size={12} color="#555" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden', position: 'sticky', top: 16 }}>
      <div style={{ padding: '12px 12px 8px', fontSize: 11, fontWeight: 800, color: '#7f8c9a', letterSpacing: .6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Layers size={13} /> Categories
      </div>
      <div style={{ maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' }}>
        {row('all', 'All products', total)}
        {categories.map(c => row(String(c.id), c.name, counts[c.id] || 0, { color: c.color || '#1E88E5', hidden: !c.is_active, onEdit: () => onEdit(c) }))}
        {uncategorised > 0 && row('none', 'No category', uncategorised, { italic: true })}
        {categories.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: '#9aa5b1' }}>No categories yet — add your first one below.</div>}
      </div>
      <NewCategoryInput categories={categories} onCreated={onCreated} />
    </div>
  );
}

/* ── Phone / tablet: categories as a scrollable row of chips ── */
export function CategoryChips({ categories, counts, total, uncategorised, selected, onSelect, onCreated }) {
  const [adding, setAdding] = useState(false);
  const chip = (key, label, count, color) => {
    const active = selected === key;
    return (
      <button key={key} onClick={() => onSelect(key)}
        style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 20, border: `1px solid ${active ? '#1E88E5' : '#e2e8f0'}`, background: active ? '#1E88E5' : '#fff', color: active ? '#fff' : '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        {color && !active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
        {label} <span style={{ opacity: .7, fontWeight: 500 }}>{count}</span>
      </button>
    );
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {chip('all', 'All', total)}
        {categories.map(c => chip(String(c.id), c.name, counts[c.id] || 0, c.color))}
        {uncategorised > 0 && chip('none', 'No category', uncategorised)}
        <button onClick={() => setAdding(a => !a)} title="New category"
          style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 20, border: '1px dashed #90CAF9', background: '#fff', color: '#1565C0', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={14} /> Category
        </button>
      </div>
      {adding && (
        <div style={{ marginTop: 8 }}>
          <NewCategoryInput compact categories={categories} onCreated={c => { setAdding(false); onCreated(c); }} />
        </div>
      )}
    </div>
  );
}

/* ── Tag input for subcategory items ── */
function TagInput({ items, onChange }) {
  const [input, setInput] = useState('');
  const add = () => { const v = input.trim(); if (v && !items.includes(v)) onChange([...items, v]); setInput(''); };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, border: '1px solid #e0e0e0', borderRadius: 8, padding: 6, background: '#fff' }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#E3F2FD', color: '#1565C0', fontSize: 12, fontWeight: 600, padding: '3px 8px 3px 10px', borderRadius: 20 }}>
          {item}
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1565C0', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } if (e.key === 'Backspace' && !input && items.length) onChange(items.slice(0, -1)); }}
        onBlur={add}
        placeholder={items.length ? 'add more…' : 'Type an item, press Enter (e.g. 1.5mm)'}
        style={{ flex: 1, minWidth: 140, border: 'none', outline: 'none', fontSize: 13, padding: '3px 4px' }} />
    </div>
  );
}

/* ── One subcategory group, editable in place ── */
function GroupRow({ group, index, last, onChange, onDelete, onMove }) {
  const [draft, setDraft] = useState({ header: group.header, items: group.items || [] });
  useEffect(() => { setDraft({ header: group.header, items: group.items || [] }); }, [group.id, group.header, group.items]);
  const dirty = draft.header !== group.header || JSON.stringify(draft.items) !== JSON.stringify(group.items || []);
  return (
    <div style={{ border: '1px solid #e8ecf0', borderRadius: 10, padding: 10, background: '#FAFBFC' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <input value={draft.header} onChange={e => setDraft(d => ({ ...d, header: e.target.value }))} placeholder="Group heading, e.g. House Wire"
          style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: 7, fontSize: 13, fontWeight: 700 }} />
        <button onClick={() => onMove(-1)} disabled={index === 0} title="Move up" style={iconBtn(index === 0)}><ChevronUp size={14} /></button>
        <button onClick={() => onMove(1)} disabled={last} title="Move down" style={iconBtn(last)}><ChevronDown size={14} /></button>
        <button onClick={onDelete} title="Delete group" style={{ ...iconBtn(false), color: '#DC3545', background: '#fdecea', borderColor: '#f5c2c7' }}><Trash2 size={13} /></button>
      </div>
      <TagInput items={draft.items} onChange={items => setDraft(d => ({ ...d, items }))} />
      {dirty && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={() => setDraft({ header: group.header, items: group.items || [] })} style={{ padding: '5px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Undo</button>
          <button onClick={() => { if (!draft.header.trim()) { toast.error('Group heading is required'); return; } onChange({ header: draft.header.trim(), items: draft.items }); }}
            style={{ padding: '5px 14px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Save group</button>
        </div>
      )}
    </div>
  );
}
const iconBtn = (disabled) => ({ width: 28, height: 28, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 6, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });

/* ── Edit a category: details, position, visibility, subcategory groups ── */
export function CategoryEditor({ category, categories, productCount, loadRefs, isMobile, onClose, onSaved, onDeleted, onMove }) {
  const [form, setForm]       = useState({ name: category.name, color: category.color || '#1E88E5', is_active: category.is_active !== false });
  const [saving, setSaving]   = useState(false);
  const [groups, setGroups]   = useState([]);
  const [gLoading, setGLoading] = useState(true);
  const [newGroup, setNewGroup] = useState(null);

  const ordered  = categories;
  const position = ordered.findIndex(c => c.id === category.id);

  useEffect(() => {
    setGLoading(true);
    getSubcategories({ category_id: category.id })
      .then(({ data }) => setGroups((data.subcategories || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))))
      .catch(() => setGroups([]))
      .finally(() => setGLoading(false));
  }, [category.id]);

  const dirty = form.name !== category.name || form.color !== (category.color || '#1E88E5') || form.is_active !== (category.is_active !== false);

  const save = async () => {
    const name = form.name.trim();
    if (!name) { toast.error('Category name is required'); return; }
    if (categories.some(c => c.id !== category.id && c.name.trim().toLowerCase() === name.toLowerCase())) { toast.error(`"${name}" already exists`); return; }
    setSaving(true);
    try {
      const { data } = await updateCategory(category.id, { name, color: form.color, is_active: form.is_active });
      toast.success('Category saved');
      onSaved(data.item);
    } catch (err) { toast.error(errMsg(err, 'Save failed')); }
    setSaving(false);
  };

  const remove = async () => {
    const msg = productCount > 0
      ? `Delete "${category.name}"?\n\nIts ${productCount} product(s) will NOT be deleted — they will move to "No category".`
      : `Delete "${category.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      // Move the products out first, so deleting never fails or removes them
      const refs = productCount ? await loadRefs() : [];
      if (refs.length) await patchProducts(refs.map(p => p.id), { category_id: null, subcategory_id: null });
      await deleteCategory(category.id);
    }
    catch (err) { toast.error(errMsg(err, 'Delete failed')); return; }
    toast.success('Category deleted');
    onDeleted(category.id);
  };

  /* subcategory groups */
  const saveGroup = async (g, patch) => {
    try { await updateSubcategory(g.id, patch); }
    catch (err) { toast.error(errMsg(err, 'Save failed')); return; }
    setGroups(gs => gs.map(x => x.id === g.id ? { ...x, ...patch } : x));
    toast.success('Group saved');
  };
  const addGroup = async () => {
    if (!newGroup.header.trim()) { toast.error('Group heading is required'); return; }
    try {
      const { data } = await createSubcategory({ category_id: category.id, header: newGroup.header.trim(), items: newGroup.items, sort_order: groups.length });
      setGroups(gs => [...gs, data.item]);
      setNewGroup(null);
      toast.success('Group added');
    } catch (err) { toast.error(errMsg(err, 'Could not add group')); }
  };
  const delGroup = async (g) => {
    if (!window.confirm(`Delete group "${g.header}"? Products in it stay in this category.`)) return;
    try {
      const inGroup = productCount ? (await loadRefs()).filter(p => String(p.subcategory_id) === String(g.id)).map(p => p.id) : [];
      if (inGroup.length) await patchProducts(inGroup, { subcategory_id: null });
      await deleteSubcategory(g.id);
    } catch (err) { toast.error(errMsg(err, 'Delete failed')); return; }
    setGroups(gs => gs.filter(x => x.id !== g.id));
  };
  const moveGroup = async (i, dir) => {
    const next = [...groups];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setGroups(next);
    try { await Promise.all(next.map((g, k) => (g.sort_order !== k ? updateSubcategory(g.id, { sort_order: k }) : null))); }
    catch { toast.error('Could not save the new order'); }
    setGroups(next.map((g, k) => ({ ...g, sort_order: k })));
  };

  const label = { display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 5, fontWeight: 600 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 105, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', width: '100%', maxWidth: isMobile ? '100%' : 460, height: '100%', overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: form.color }} />
          <div style={{ flex: 1, fontWeight: 800, fontSize: 16 }}>Edit category</div>
          <button onClick={onClose} aria-label="Close" style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, flex: 1 }}>
          {/* Details */}
          <label style={label}>Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && dirty && save()}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', marginBottom: 14 }} />

          <label style={label}>Colour</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} aria-label={c}
                style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: form.color.toLowerCase() === c.toLowerCase() ? '3px solid #fff' : 'none', boxShadow: form.color.toLowerCase() === c.toLowerCase() ? `0 0 0 2px ${c}` : 'none', cursor: 'pointer' }} />
            ))}
            <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} title="Other colour"
              style={{ width: 30, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #e8ecf0', borderRadius: 8, cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <span style={{ fontSize: 14 }}>
              Show in shop
              <span style={{ display: 'block', fontSize: 12, color: '#9aa5b1' }}>{form.is_active ? 'Customers can see this category in the menu' : 'Hidden from the shop menu'}</span>
            </span>
          </label>

          {dirty && (
            <button onClick={save} disabled={saving}
              style={{ width: '100%', padding: '10px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', marginBottom: 14 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}

          {/* Position */}
          <label style={label}>Position in shop menu</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <button onClick={() => onMove(category, -1)} disabled={position <= 0} style={{ ...iconBtn(position <= 0), width: 'auto', padding: '0 10px', gap: 4, fontSize: 12 }}><ChevronUp size={14} /> Up</button>
            <button onClick={() => onMove(category, 1)} disabled={position >= ordered.length - 1} style={{ ...iconBtn(position >= ordered.length - 1), width: 'auto', padding: '0 10px', gap: 4, fontSize: 12 }}><ChevronDown size={14} /> Down</button>
            <span style={{ fontSize: 13, color: '#555' }}>{position + 1} of {ordered.length}</span>
          </div>

          {/* Subcategory groups */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>Subcategory groups</span>
              {!newGroup && <button onClick={() => setNewGroup({ header: '', items: [] })} style={{ padding: '5px 12px', background: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Add group</button>}
            </div>
            <div style={{ fontSize: 12, color: '#9aa5b1', marginBottom: 12 }}>Optional. Shown in the shop's menu under this category — e.g. "House Wire" with 1.5mm, 2.5mm… Products can be put in a group from the product form.</div>

            {gLoading ? <div style={{ fontSize: 13, color: '#9aa5b1' }}>Loading…</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map((g, i) => (
                  <GroupRow key={g.id} group={g} index={i} last={i === groups.length - 1}
                    onChange={patch => saveGroup(g, patch)} onDelete={() => delGroup(g)} onMove={dir => moveGroup(i, dir)} />
                ))}
                {groups.length === 0 && !newGroup && <div style={{ fontSize: 13, color: '#9aa5b1', background: '#FAFBFC', borderRadius: 8, padding: 12, textAlign: 'center' }}>No groups yet.</div>}
                {newGroup && (
                  <div style={{ border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: 10, padding: 10 }}>
                    <input autoFocus value={newGroup.header} onChange={e => setNewGroup(g => ({ ...g, header: e.target.value }))} placeholder="Group heading, e.g. House Wire"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #BFDBFE', borderRadius: 7, fontSize: 13, fontWeight: 700, boxSizing: 'border-box', marginBottom: 8 }} />
                    <TagInput items={newGroup.items} onChange={items => setNewGroup(g => ({ ...g, items }))} />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button onClick={() => setNewGroup(null)} style={{ padding: '5px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                      <button onClick={addGroup} style={{ padding: '5px 14px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Add group</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ padding: 18, borderTop: '1px solid #f0f0f0' }}>
          <button onClick={remove} style={{ width: '100%', padding: '9px', background: '#fff', color: '#C62828', border: '1px solid #f5c2c7', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Trash2 size={14} /> Delete category{productCount > 0 ? ` (${productCount} products move to "No category")` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
