import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { Tag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Check, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = '/api/coupons';

const EMPTY = {
  code: '', discount_type: 'percent', discount_value: '',
  min_order: '', max_discount: '', usage_limit: '', expires_at: '', is_active: true,
};

const inp = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0',
  borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none',
  fontFamily: 'inherit', background: '#fff',
};
const lb = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const fd = { marginBottom: 14 };

function Badge({ active }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: active ? '#DCFCE7' : '#F3F4F6',
      color: active ? '#16A34A' : '#6B7280',
    }}>
      {active ? <Check size={10} /> : <X size={10} />}
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function AdminCoupons() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [delId,   setDelId]   = useState(null);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(API, { headers });
      setCoupons(data.coupons || []);
    } catch { toast.error('Failed to load coupons'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (c) => {
    setEditing(c.id);
    setForm({
      code: c.code, discount_type: c.discount_type, discount_value: c.discount_value,
      min_order: c.min_order || '', max_discount: c.max_discount || '',
      usage_limit: c.usage_limit || '', expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '',
      is_active: c.is_active,
    });
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.code.trim())         { toast.error('Coupon code is required'); return; }
    if (!form.discount_value)      { toast.error('Discount value is required'); return; }
    if (+form.discount_value <= 0) { toast.error('Discount value must be greater than 0'); return; }
    if (form.discount_type === 'percent' && +form.discount_value > 100) {
      toast.error('Percent discount cannot exceed 100%'); return;
    }
    setSaving(true);
    try {
      const payload = {
        code:           form.code.toUpperCase().trim(),
        discount_type:  form.discount_type,
        discount_value: +form.discount_value,
        min_order:      form.min_order    ? +form.min_order    : null,
        max_discount:   form.max_discount ? +form.max_discount : null,
        usage_limit:    form.usage_limit  ? +form.usage_limit  : null,
        expires_at:     form.expires_at   || null,
        is_active:      form.is_active,
      };
      if (editing) {
        await axios.put(`${API}/${editing}`, payload, { headers });
        toast.success('Coupon updated');
      } else {
        await axios.post(API, payload, { headers });
        toast.success('Coupon created');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const toggleActive = async (c) => {
    try {
      await axios.put(`${API}/${c.id}`, { is_active: !c.is_active }, { headers });
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
      toast.success(`Coupon ${!c.is_active ? 'activated' : 'deactivated'}`);
    } catch { toast.error('Failed to update coupon'); }
  };

  const deleteCoupon = async (id) => {
    try {
      await axios.delete(`${API}/${id}`, { headers });
      setCoupons(prev => prev.filter(c => c.id !== id));
      toast.success('Coupon deleted');
    } catch { toast.error('Failed to delete coupon'); }
    finally { setDelId(null); }
  };

  const active   = coupons.filter(c => c.is_active).length;
  const inactive = coupons.length - active;

  return (
    <AdminLayout title="Coupons & Gift Vouchers">
      <div style={{ maxWidth: 960 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Total',    value: coupons.length, bg: '#EFF6FF', color: '#1E88E5' },
              { label: 'Active',   value: active,         bg: '#DCFCE7', color: '#16A34A' },
              { label: 'Inactive', value: inactive,       bg: '#F3F4F6', color: '#6B7280' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={15} /> New Coupon
          </button>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div>
          ) : coupons.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Tag size={40} color="#e0e0e0" style={{ marginBottom: 12 }} />
              <div style={{ color: '#9aa5b1', fontSize: 14 }}>No coupons yet — create your first one</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E5E7EB' }}>
                  {['Code', 'Discount', 'Min Order', 'Usage', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((c, i) => {
                  const expired = c.expires_at && new Date(c.expires_at) < new Date();
                  const limitHit = c.usage_limit && c.used_count >= c.usage_limit;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: '#0F172A', background: '#F3F4F6', padding: '3px 8px', borderRadius: 5, letterSpacing: 1 }}>
                            {c.code}
                          </span>
                          {(expired || limitHit) && (
                            <span title={expired ? 'Expired' : 'Usage limit reached'}>
                              <AlertTriangle size={13} color="#F59E0B" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 700, color: '#1E88E5' }}>
                        {c.discount_type === 'percent'
                          ? `${c.discount_value}% off`
                          : `৳${c.discount_value} off`}
                        {c.max_discount && c.discount_type === 'percent' && (
                          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>max ৳{c.max_discount}</div>
                        )}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151' }}>
                        {c.min_order ? `৳${c.min_order}` : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151' }}>
                        {c.usage_limit
                          ? <span style={{ color: limitHit ? '#DC2626' : '#374151' }}>{c.used_count} / {c.usage_limit}</span>
                          : <span>{c.used_count} / <span style={{ color: '#D1D5DB' }}>∞</span></span>}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 12, color: expired ? '#DC2626' : '#374151' }}>
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-GB') : <span style={{ color: '#D1D5DB' }}>Never</span>}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <Badge active={c.is_active && !expired && !limitHit} />
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={() => toggleActive(c)} title={c.is_active ? 'Deactivate' : 'Activate'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.is_active ? '#16A34A' : '#9CA3AF', padding: 4, display: 'flex' }}>
                            {c.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                          <button onClick={() => openEdit(c)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4, display: 'flex' }}>
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDelId(c.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, display: 'flex' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={16} color="#1E88E5" />
                {editing ? 'Edit Coupon' : 'New Coupon'}
              </h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={save} style={{ padding: 24 }}>
              {/* Code */}
              <div style={fd}>
                <label style={lb}>Coupon Code <span style={{ color: '#EF4444' }}>*</span></label>
                <input value={form.code} onChange={e => upd('code', e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE20"
                  style={{ ...inp, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }} />
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Customers enter this code at checkout</div>
              </div>

              {/* Discount type + value */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lb}>Discount Type <span style={{ color: '#EF4444' }}>*</span></label>
                  <select value={form.discount_type} onChange={e => upd('discount_type', e.target.value)}
                    style={{ ...inp, cursor: 'pointer' }}>
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat Amount (৳)</option>
                  </select>
                </div>
                <div>
                  <label style={lb}>
                    {form.discount_type === 'percent' ? 'Percentage (%)' : 'Amount (৳)'}{' '}
                    <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input type="number" min="1" max={form.discount_type === 'percent' ? 100 : undefined}
                    value={form.discount_value} onChange={e => upd('discount_value', e.target.value)}
                    placeholder={form.discount_type === 'percent' ? '10' : '100'}
                    style={inp} />
                </div>
              </div>

              {/* Max discount (for percent only) */}
              {form.discount_type === 'percent' && (
                <div style={fd}>
                  <label style={lb}>Maximum Discount (৳) <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
                  <input type="number" min="1" value={form.max_discount} onChange={e => upd('max_discount', e.target.value)}
                    placeholder="e.g. 500 — caps a 20% coupon at ৳500"
                    style={inp} />
                </div>
              )}

              {/* Min order */}
              <div style={fd}>
                <label style={lb}>Minimum Order Amount (৳) <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
                <input type="number" min="0" value={form.min_order} onChange={e => upd('min_order', e.target.value)}
                  placeholder="e.g. 500"
                  style={inp} />
              </div>

              {/* Usage limit + expiry */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lb}>Usage Limit <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
                  <input type="number" min="1" value={form.usage_limit} onChange={e => upd('usage_limit', e.target.value)}
                    placeholder="Unlimited"
                    style={inp} />
                </div>
                <div>
                  <label style={lb}>Expiry Date <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
                  <input type="date" value={form.expires_at} onChange={e => upd('expires_at', e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    style={inp} />
                </div>
              </div>

              {/* Active toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '12px 14px', background: '#F8F9FA', borderRadius: 8 }}>
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#1E88E5', cursor: 'pointer' }} />
                <label htmlFor="is_active" style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                  Active — customers can use this coupon
                </label>
              </div>

              {/* Summary preview */}
              {form.discount_value > 0 && (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#1E40AF' }}>
                  <strong>{form.code || 'CODE'}</strong> gives{' '}
                  {form.discount_type === 'percent'
                    ? `${form.discount_value}% off${form.max_discount ? ` (max ৳${form.max_discount})` : ''}`
                    : `৳${form.discount_value} off`}
                  {form.min_order ? ` on orders above ৳${form.min_order}` : ''}
                  {form.usage_limit ? ` · limit ${form.usage_limit} uses` : ''}
                  {form.expires_at ? ` · expires ${new Date(form.expires_at).toLocaleDateString('en-GB')}` : ''}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setModal(false)}
                  style={{ flex: 1, padding: '11px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex: 2, padding: '11px', background: saving ? '#93C5FD' : '#1E88E5', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {delId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 16px 48px rgba(0,0,0,.18)' }}>
            <div style={{ width: 52, height: 52, background: '#FEF2F2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} color="#EF4444" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Delete Coupon?</h3>
            <p style={{ margin: '0 0 22px', fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
              This coupon will be permanently deleted and can no longer be used by customers.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDelId(null)} style={{ flex: 1, padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                Cancel
              </button>
              <button onClick={() => deleteCoupon(delId)} style={{ flex: 1, padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
