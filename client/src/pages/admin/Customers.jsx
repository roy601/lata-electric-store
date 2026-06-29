import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('orders')
        .select('customer_name, customer_phone, customer_address, customer_city, customer_district, total, created_at')
        .order('created_at', { ascending: false });

      // Group by phone to deduplicate
      const map = new Map();
      (data || []).forEach(o => {
        const key = o.customer_phone;
        if (!map.has(key)) {
          map.set(key, { name: o.customer_name, phone: o.customer_phone, city: o.customer_city, orderCount: 0, totalSpent: 0, lastOrder: o.created_at });
        }
        const c = map.get(key);
        c.orderCount++;
        c.totalSpent += +o.total || 0;
      });
      setCustomers([...map.values()]);
      setLoading(false);
    };
    load();
  }, []);

  const fmt = (n) => '৳' + Number(n).toLocaleString('en-BD');

  const deleteCustomer = async (phone, name) => {
    if (!window.confirm(`Delete all data for "${name}" (${phone})? This will delete their orders too.`)) return;
    await supabase.from('orders').delete().eq('customer_phone', phone);
    setCustomers(prev => prev.filter(c => c.phone !== phone));
  };

  const visible = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  return (
    <AdminLayout title="Customers">
      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Search by name or phone…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 360, padding: '9px 14px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14 }}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                {['Name', 'Phone', 'City', 'Orders', 'Total Spent', 'Last Order', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#7f8c9a', fontWeight: 600, borderBottom: '1px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(c => (
                <tr key={c.phone} style={{ borderBottom: '1px solid #F8F9FA' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#212529' }}>{c.name}</td>
                  <td style={{ padding: '11px 14px', color: '#4a5568' }}>{c.phone}</td>
                  <td style={{ padding: '11px 14px', color: '#555' }}>{c.city || '—'}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600 }}>{c.orderCount}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#28A745' }}>{fmt(c.totalSpent)}</td>
                  <td style={{ padding: '11px 14px', color: '#9aa5b1', whiteSpace: 'nowrap' }}>
                    {new Date(c.lastOrder).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => deleteCustomer(c.phone, c.name)}
                      style={{ padding: '4px 12px', background: '#fce4e4', color: '#DC3545', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>No customers yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
