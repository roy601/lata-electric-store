import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function AdminPayments() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      setSettings(data || {});
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').upsert({
      id:                 1,
      payment_methods:    settings.payment_methods,
      bkash_number:       settings.bkash_number    || null,
      nagad_number:       settings.nagad_number    || null,
      bkash_instructions: settings.bkash_instructions || null,
      nagad_instructions: settings.nagad_instructions || null,
    }, { onConflict: 'id' });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Payment settings saved');
  };

  const toggleMethod = (method) => {
    const current = settings.payment_methods || [];
    const updated = current.includes(method)
      ? current.filter(m => m !== method)
      : [...current, method];
    setSettings(s => ({ ...s, payment_methods: updated }));
  };

  if (loading) return <AdminLayout title="Payments"><div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div></AdminLayout>;

  const methods = settings.payment_methods || [];

  return (
    <AdminLayout title="Payments">
      <div style={{ maxWidth: 600 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Payment Methods</h3>

          {['Cash on Delivery', 'bKash', 'Nagad'].map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F8F9FA' }}>
              <input type="checkbox" id={m} checked={methods.includes(m)} onChange={() => toggleMethod(m)} />
              <label htmlFor={m} style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{m}</label>
              <span style={{ background: methods.includes(m) ? '#d1e7dd' : '#f0f0f0', color: methods.includes(m) ? '#0f5132' : '#999', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {methods.includes(m) ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>

        {methods.includes('bKash') && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#d63031' }}>bKash Settings</h3>
            <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Merchant Number</label>
            <input value={settings.bkash_number || ''} onChange={e => setSettings(s => ({ ...s, bkash_number: e.target.value }))}
              placeholder="01XXXXXXXXX"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
            <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Payment Instructions</label>
            <textarea rows={3} value={settings.bkash_instructions || ''} onChange={e => setSettings(s => ({ ...s, bkash_instructions: e.target.value }))}
              placeholder="Send money to above number and enter transaction ID at checkout…"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        )}

        {methods.includes('Nagad') && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#f39c12' }}>Nagad Settings</h3>
            <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Merchant Number</label>
            <input value={settings.nagad_number || ''} onChange={e => setSettings(s => ({ ...s, nagad_number: e.target.value }))}
              placeholder="01XXXXXXXXX"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
            <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Payment Instructions</label>
            <textarea rows={3} value={settings.nagad_instructions || ''} onChange={e => setSettings(s => ({ ...s, nagad_instructions: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        )}

        <button onClick={save} disabled={saving} style={{ padding: '10px 28px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>
          {saving ? 'Saving…' : 'Save Payment Settings'}
        </button>
      </div>
    </AdminLayout>
  );
}
