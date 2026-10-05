import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Clock, DollarSign, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getDashboardStats } from '../../api/adminApi';

const STATUS_COLOR = {
  pending:   { bg: '#fff3cd', color: 'var(--tx-856404, #856404)' },
  confirmed: { bg: '#cfe2ff', color: 'var(--tx-084298, #084298)' },
  shipped:   { bg: '#d1ecf1', color: 'var(--tx-0c5460, #0c5460)' },
  delivered: { bg: '#d1e7dd', color: 'var(--tx-0f5132, #0f5132)' },
  cancelled: { bg: '#f8d7da', color: 'var(--tx-842029, #842029)' },
};

function StatCard({ label, value, sub, Icon, color, to }) {
  const inner = (
    <div style={{
      background: 'var(--bg-fff, #fff)', borderRadius: 12, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'}
    >
      <div style={{ width: 52, height: 52, borderRadius: 12, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {Icon && <Icon size={24} color={color} />}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--tx-212529, #212529)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--tx-7f8c9a, #7f8c9a)', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
  return to
    ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
    : inner;
}

export default function Dashboard() {
  const [stats, setStats]         = useState(null);
  const [recentOrders, setRecent] = useState([]);
  const [lowStock, setLowStock]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Figures are computed on the server
        const { data } = await getDashboardStats();
        setStats(data.stats);
        setRecent(data.recentOrders || []);
        setLowStock(data.lowStock || []);
      } catch {
        setStats({ totalOrders: 0, todayOrders: 0, revenue: 0, totalProducts: 0, pendingOrders: 0 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fmt = (n) => '৳' + Number(n || 0).toLocaleString('en-BD');

  if (loading) return (
    <AdminLayout title="Dashboard">
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <div style={{ width: 40, height: 40, border: '4px solid var(--bd-f0f0f0, #f0f0f0)', borderTop: '4px solid #1E88E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Dashboard">

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Orders"   value={stats?.totalOrders}   sub={`+${stats?.todayOrders} today`} Icon={ShoppingCart}  color="#1E88E5" to="/admin/orders" />
        <StatCard label="Pending"        value={stats?.pendingOrders} sub="Need action"                    Icon={Clock}         color="#f39c12" to="/admin/orders" />
        <StatCard label="Revenue"        value={fmt(stats?.revenue)}  sub="From delivered orders"          Icon={DollarSign}    color="#28A745" />
        <StatCard label="Products"       value={stats?.totalProducts} sub={`${lowStock.length} low stock`} Icon={Package}       color="#2980b9" to="/admin/products" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* Recent orders table */}
        <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--tx-212529, #212529)' }}>Recent Orders</h2>
            <Link to="/admin/orders" style={{ fontSize: 13, color: '#1E88E5', textDecoration: 'none' }}>View all →</Link>
          </div>

          {recentOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--tx-9aa5b1, #9aa5b1)', fontSize: 14 }}>No orders yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Order ID', 'Customer', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--tx-7f8c9a, #7f8c9a)', fontWeight: 600, borderBottom: '2px solid var(--bd-f0f0f0, #f0f0f0)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => {
                  const sc = STATUS_COLOR[o.status] || STATUS_COLOR.pending;
                  return (
                    <tr key={o.order_id} style={{ borderBottom: '1px solid var(--bd-f8f9fa, #F8F9FA)' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--tx-212529, #212529)' }}>#{o.order_id}</td>
                      <td style={{ padding: '10px', color: 'var(--tx-4a5568, #4a5568)' }}>{o.customer_name}</td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{fmt(o.total)}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: 'var(--tx-7f8c9a, #7f8c9a)', whiteSpace: 'nowrap' }}>
                        {new Date(o.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Low stock panel */}
        <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--tx-212529, #212529)', display: 'flex', alignItems: 'center', gap: 7 }}>Low Stock <AlertTriangle size={15} color="#f39c12" /></h2>
            <Link to="/admin/products" style={{ fontSize: 13, color: '#1E88E5', textDecoration: 'none' }}>Manage →</Link>
          </div>

          {lowStock.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#28A745', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><CheckCircle2 size={16} /> All products in stock</div>
          ) : lowStock.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bd-f8f9fa, #F8F9FA)' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, background: 'var(--bg-f8f9fa, #F8F9FA)', flexShrink: 0,
                backgroundImage: p.image ? `url(${p.image})` : 'none',
                backgroundSize: 'cover', backgroundPosition: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!p.image && <Package size={18} color="#ccc" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-212529, #212529)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)' }}>৳{p.price}</div>
              </div>
              <span style={{
                background: p.stock === 0 ? 'var(--bg-f8d7da, #f8d7da)' : 'var(--bg-fff3cd, #fff3cd)',
                color:      p.stock === 0 ? 'var(--tx-842029, #842029)' : 'var(--tx-856404, #856404)',
                padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {p.stock === 0 ? 'Out' : `${p.stock} left`}
              </span>
            </div>
          ))}
        </div>

      </div>
    </AdminLayout>
  );
}
