import { useEffect, useState } from 'react';
import { Zap, Package } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getProducts, updateProduct, getSettings, updateSettings, errMsg } from '../../api/adminApi';
import toast from 'react-hot-toast';

export default function AdminFlashSale() {
  const [products, setProducts]   = useState([]);
  const [settings, setSettings]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pRes, sRes] = await Promise.all([getProducts(), getSettings()]);
        setProducts((pRes.data.products || []).sort((a, b) => a.name.localeCompare(b.name)));
        const st = sRes.data.settings || {};
        setSettings({ flash_sale_active: st.flash_sale_active ?? false, flash_sale_ends: st.flash_sale_ends ?? '' });
      } catch (err) {
        toast.error(errMsg(err, 'Failed to load'));
        setSettings({ flash_sale_active: false, flash_sale_ends: '' });
      }
      setLoading(false);
    };
    load();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings({ flash_sale_active: settings.flash_sale_active, flash_sale_ends: settings.flash_sale_ends || null });
    } catch (err) { setSaving(false); toast.error(errMsg(err)); return; }
    setSaving(false);
    toast.success(settings.flash_sale_active ? 'Flash sale is now ACTIVE' : 'Flash sale turned off');
  };

  const toggleFlash = async (id, current) => {
    const newVal = !current;
    try { await updateProduct(id, { flash_sale: newVal }); }
    catch (err) { toast.error('Update failed: ' + errMsg(err)); return; }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, flash_sale: newVal } : p));
    toast.success(newVal ? 'Added to flash sale' : 'Removed from flash sale');
  };

  const updateFlashPrice = async (id, price) => {
    if (!price || isNaN(+price) || +price <= 0) { toast.error('Enter a valid price'); return; }
    try { await updateProduct(id, { flash_price: +price }); }
    catch (err) { toast.error('Update failed: ' + errMsg(err)); return; }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, flash_price: +price } : p));
    toast.success('Flash price saved');
  };

  const visible = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  // Local state for editing flash prices inline
  const [fpEdits, setFpEdits] = useState({});

  return (
    <AdminLayout title="Flash Sale">
      {/* Settings panel */}
      <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Flash Sale Settings</h3>
        {settings && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="fs_active" checked={settings.flash_sale_active}
                onChange={e => setSettings(s => ({ ...s, flash_sale_active: e.target.checked }))} />
              <label htmlFor="fs_active" style={{ fontWeight: 600, fontSize: 14 }}>Flash Sale Active</label>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', marginBottom: 4 }}>End Date & Time</label>
              <input type="datetime-local"
                value={settings.flash_sale_ends ? settings.flash_sale_ends.slice(0, 16) : ''}
                onChange={e => setSettings(s => ({ ...s, flash_sale_ends: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, fontSize: 14 }}
              />
            </div>
            <button onClick={saveSettings} disabled={saving} style={{ padding: '9px 20px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>

      {/* Products */}
      <div style={{ marginBottom: 16 }}>
        <input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 8, fontSize: 14, width: '100%', maxWidth: 360 }} />
      </div>

      <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-f8f9fa, #f8f9fa)' }}>
                {['Product', 'Regular Price', 'Flash Price', 'In Flash Sale'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: 'var(--tx-7f8c9a, #7f8c9a)', fontWeight: 600, borderBottom: '1px solid var(--bd-eee, #eee)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--bd-f8f9fa, #F8F9FA)', background: p.flash_sale ? 'var(--bg-fff8f0, #fff8f0)' : 'var(--bg-fff, #fff)' }}>
                  <td style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-f8f9fa, #F8F9FA)', backgroundImage: p.image ? `url(${p.image})` : 'none', backgroundSize: 'cover', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{!p.image && <Package size={18} color="#ccc" />}</div>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>৳{p.price}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number" min="1"
                        value={fpEdits[p.id] ?? (p.flash_price || '')}
                        onChange={e => setFpEdits(f => ({ ...f, [p.id]: e.target.value }))}
                        placeholder="৳ price"
                        style={{ width: 100, padding: '6px 10px', border: '1px solid var(--bd-e0e0e0, #e0e0e0)', borderRadius: 6, fontSize: 13 }}
                      />
                      <button onClick={() => updateFlashPrice(p.id, fpEdits[p.id] ?? p.flash_price)}
                        style={{ padding: '6px 10px', background: 'var(--bg-f0f0f0, #f0f0f0)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        Set
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => toggleFlash(p.id, p.flash_sale)} style={{
                      padding: '5px 16px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      background: p.flash_sale ? 'var(--bg-fff3cd, #fff3cd)' : 'var(--bg-f0f0f0, #f0f0f0)', color: p.flash_sale ? 'var(--tx-856404, #856404)' : 'var(--tx-555, #555)',
                    }}>
                      {p.flash_sale ? <><Zap size={12} fill="currentColor" /> Active</> : 'Add'}
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 60, textAlign: 'center', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>No products</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
