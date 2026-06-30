import { useEffect, useState } from 'react';
import { TrendingUp, Package, Star, Flame } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function AdminFeatured() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('products').select('id, name, price, image, featured, top_sell, trending, stock').order('name');
      setProducts(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const toggle = async (id, field, current) => {
    const { error } = await supabase.from('products').update({ [field]: !current }).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: !current } : p));
    toast.success('Updated');
  };

  const visible = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const featured = visible.filter(p => p.featured);
  const topSell  = visible.filter(p => p.top_sell);

  return (
    <AdminLayout title="Featured, Top Sells & Trending">

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff3cd', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, color: '#856404', display: 'flex', alignItems: 'center', gap: 5 }}><Star size={14} /> Featured Products</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#212529', marginTop: 4 }}>{products.filter(p => p.featured).length}</div>
        </div>
        <div style={{ background: '#d1ecf1', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, color: '#0c5460', display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={14} /> Top Sells</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#212529', marginTop: 4 }}>{products.filter(p => p.top_sell).length}</div>
        </div>
        <div style={{ background: '#fde8d8', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, color: '#923b00', display: 'flex', alignItems: 'center', gap: 5 }}><Flame size={14} /> Trending</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#212529', marginTop: 4 }}>{products.filter(p => p.trending).length}</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, width: '100%', maxWidth: 360 }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                {['Product', 'Price', 'Stock', 'Featured', 'Top Sell', 'Trending'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#7f8c9a', fontWeight: 600, borderBottom: '1px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F8F9FA' }}>
                  <td style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F8F9FA', backgroundImage: p.image ? `url(${p.image})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{!p.image && <Package size={18} color="#ccc" />}</div>
                    <span style={{ fontWeight: 600, color: '#212529' }}>{p.name}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>৳{p.price}</td>
                  <td style={{ padding: '10px 14px' }}>{p.stock}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => toggle(p.id, 'featured', p.featured)} style={{
                      padding: '5px 16px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      background: p.featured ? '#fff3cd' : '#f0f0f0', color: p.featured ? '#856404' : '#555',
                    }}>
                      {p.featured ? <><Star size={12} /> On</> : 'Off'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => toggle(p.id, 'top_sell', p.top_sell)} style={{
                      padding: '5px 16px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      background: p.top_sell ? '#d1ecf1' : '#f0f0f0', color: p.top_sell ? '#0c5460' : '#555',
                    }}>
                      {p.top_sell ? <><TrendingUp size={12} /> On</> : 'Off'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => toggle(p.id, 'trending', p.trending)} style={{
                      padding: '5px 16px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      background: p.trending ? '#fde8d8' : '#f0f0f0', color: p.trending ? '#923b00' : '#555',
                    }}>
                      {p.trending ? <><Flame size={12} /> On</> : 'Off'}
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>No products</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
