import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, LayoutGrid, List,
  Users, Image, Star, Zap, CreditCard, Truck, HardHat, Settings, LogOut, Tag,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/admin/dashboard',    Icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/orders',       Icon: ShoppingCart,    label: 'Orders' },
  { to: '/admin/products',     Icon: Package,         label: 'Products' },
  { to: '/admin/categories',   Icon: LayoutGrid,      label: 'Categories' },

  { to: '/admin/customers',    Icon: Users,           label: 'Customers' },
  { to: '/admin/banners',      Icon: Image,           label: 'Banners' },
  { to: '/admin/featured',     Icon: Star,            label: 'Featured' },
  { to: '/admin/flash-sale',   Icon: Zap,             label: 'Flash Sale' },
  { to: '/admin/payments',     Icon: CreditCard,      label: 'Payments' },
  { to: '/admin/shipping',     Icon: Truck,           label: 'Shipping' },
  { to: '/admin/coupons',      Icon: Tag,             label: 'Coupons' },
  { to: '/admin/electricians', Icon: HardHat,         label: 'Electricians' },
  { to: '/admin/settings',     Icon: Settings,        label: 'Settings' },
];

export default function AdminLayout({ children, title }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { if (isMobile) setSidebarOpen(false); }, [isMobile]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/admin/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FA', fontFamily: "'Hind Siliguri', 'Segoe UI', sans-serif" }}>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 99 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 240, background: '#212529', display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: isMobile ? 'fixed' : 'sticky', top: 0, left: 0,
        bottom: isMobile ? 0 : 'auto', height: '100vh', overflowY: 'auto',
        zIndex: isMobile ? 100 : 'auto',
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #343A40' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#1E88E5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="#fff" fill="#fff" />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>লতা ইলেকট্রিক</div>
              <div style={{ color: '#7f8c9a', fontSize: 11 }}>Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV.map(({ to, Icon, label }) => (
            <NavLink key={to} to={to}
              onClick={() => isMobile && setSidebarOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                color: isActive ? '#fff' : '#9aa5b1',
                background: isActive ? '#1E88E5' : 'transparent',
                textDecoration: 'none', fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive ? '3px solid rgba(255,255,255,.4)' : '3px solid transparent',
                transition: 'all 0.15s',
              })}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Admin info */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #343A40' }}>
          <div style={{ color: '#9aa5b1', fontSize: 12, marginBottom: 4 }}>Logged in as</div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{admin?.name || 'Admin'}</div>
          <button onClick={handleLogout}
            style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #1E88E5', color: '#1E88E5', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ background: '#fff', padding: isMobile ? '0 14px' : '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8ecf0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <List size={24} />
              </button>
            )}
            <h1 style={{ margin: 0, fontSize: isMobile ? 15 : 18, fontWeight: 700, color: '#212529' }}>{title}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, background: '#1E88E5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
              {admin?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#212529' }}>{admin?.name}</div>
              <div style={{ fontSize: 11, color: '#7f8c9a', textTransform: 'capitalize' }}>{admin?.role?.replace('_', ' ')}</div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: isMobile ? '14px 10px' : 24, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
