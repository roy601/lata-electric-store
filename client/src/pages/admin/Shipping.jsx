import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function AdminShipping() {
  const [s, setS]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('settings').select('shipping_inside, shipping_outside, free_delivery_threshold, delivery_time_inside, delivery_time_outside').eq('id', 1).maybeSingle()
      .then(({ data }) => { setS(data || { shipping_inside: 60, shipping_outside: 120, free_delivery_threshold: 1000, delivery_time_inside: 'Same Day / Next Day', delivery_time_outside: '2–4 Business Days' }); setLoading(false); });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').upsert({
      id:                        1,
      shipping_inside:           +s.shipping_inside,
      shipping_outside:          +s.shipping_outside,
      free_delivery_threshold:   +s.free_delivery_threshold,
      delivery_time_inside:      s.delivery_time_inside,
      delivery_time_outside:     s.delivery_time_outside,
    }, { onConflict: 'id' });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Shipping settings saved');
  };

  if (loading) return <AdminLayout title="Shipping"><div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div></AdminLayout>;

  const Field = ({ label, field, type = 'text', prefix, note }) => (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#212529', marginBottom: 4 }}>{label}</label>
      {note && <div style={{ fontSize: 12, color: '#9aa5b1', marginBottom: 6 }}>{note}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {prefix && <span style={{ padding: '9px 12px', background: '#F8F9FA', border: '1px solid #e0e0e0', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 14, color: '#555' }}>{prefix}</span>}
        <input type={type} value={s[field] || ''} onChange={e => setS(prev => ({ ...prev, [field]: e.target.value }))}
          style={{ flex: 1, padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: prefix ? '0 8px 8px 0' : 8, fontSize: 14 }} />
      </div>
    </div>
  );

  return (
    <AdminLayout title="Shipping">
      <div style={{ maxWidth: 560 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Delivery Rates</h3>
          <Field label="Inside Dhaka"  field="shipping_inside"  type="number" prefix="৳" />
          <Field label="Outside Dhaka" field="shipping_outside" type="number" prefix="৳" />
          <Field label="Free Delivery Threshold" field="free_delivery_threshold" type="number" prefix="৳"
            note="Orders above this amount get free delivery (set 0 to disable)" />
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Delivery Times</h3>
          <Field label="Inside Dhaka"  field="delivery_time_inside"  note='e.g. "Same Day / Next Day"' />
          <Field label="Outside Dhaka" field="delivery_time_outside" note='e.g. "2–4 Business Days"' />
        </div>

        {/* Live preview */}
        <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px dashed #dee2e6' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7f8c9a', marginBottom: 12 }}>Preview (what customer sees)</div>
          <div style={{ fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Inside Dhaka</span>
              <span style={{ fontWeight: 600 }}>৳{s.shipping_inside || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Outside Dhaka</span>
              <span style={{ fontWeight: 600 }}>৳{s.shipping_outside || 0}</span>
            </div>
            {+s.free_delivery_threshold > 0 && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#d1e7dd', borderRadius: 8, color: '#0f5132', fontSize: 13 }}>
                Free delivery on orders above ৳{s.free_delivery_threshold}
              </div>
            )}
          </div>
        </div>

        <button onClick={save} disabled={saving} style={{ padding: '10px 28px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>
          {saving ? 'Saving…' : 'Save Shipping Settings'}
        </button>
      </div>
    </AdminLayout>
  );
}
