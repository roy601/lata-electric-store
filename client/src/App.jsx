import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import AdminProtectedRoute from './components/layout/AdminProtectedRoute';
import { AdminShell } from './components/layout/AdminLayout';

// ── Lazy imports for code-splitting ──
import { lazy, Suspense } from 'react';

const AdminLogin     = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts  = lazy(() => import('./pages/admin/Products'));
const AdminOrders    = lazy(() => import('./pages/admin/Orders'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminSettings  = lazy(() => import('./pages/admin/Settings'));
const AdminPayments  = lazy(() => import('./pages/admin/Payments'));
const AdminShipping  = lazy(() => import('./pages/admin/Shipping'));
const AdminFeatured  = lazy(() => import('./pages/admin/Featured'));
const AdminFlashSale = lazy(() => import('./pages/admin/FlashSale'));
const AdminBanners        = lazy(() => import('./pages/admin/Banners'));
const AdminElectricians   = lazy(() => import('./pages/admin/Electricians'));
const AdminCoupons        = lazy(() => import('./pages/admin/Coupons'));
const AdminAssistant      = lazy(() => import('./pages/admin/Assistant'));

// Customer pages
const Home           = lazy(() => import('./pages/customer/Home'));
const AllProducts    = lazy(() => import('./pages/customer/AllProducts'));
const ProductDetail  = lazy(() => import('./pages/customer/ProductDetail'));
const CategoryPage   = lazy(() => import('./pages/customer/CategoryPage'));
const CartPage       = lazy(() => import('./pages/customer/Cart'));
const CheckoutPage   = lazy(() => import('./pages/customer/Checkout'));
const FlashSalePage  = lazy(() => import('./pages/customer/FlashSale'));
const WishlistPage   = lazy(() => import('./pages/customer/Wishlist'));
const AccountPage    = lazy(() => import('./pages/customer/Account'));
const TrackingPage   = lazy(() => import('./pages/customer/OrderTracking'));
const AboutPage      = lazy(() => import('./pages/customer/About'));
const ContactPage    = lazy(() => import('./pages/customer/Contact'));
const AuthPage          = lazy(() => import('./pages/customer/AuthPage'));
const ResetPassword     = lazy(() => import('./pages/customer/ResetPassword'));
const PolicyPage        = lazy(() => import('./pages/customer/Policy'));
const ElectriciansPage  = lazy(() => import('./pages/customer/Electricians'));

// While a page's code downloads: grey blocks shaped like a page, not a spinner
const PageLoader = () => (
  <div aria-busy="true" aria-label="Loading" style={{ minHeight: '100vh' }}>
    <div className="skel" style={{ height: 64, borderRadius: 0 }} />
    <div style={{ maxWidth: 1260, margin: '0 auto', padding: '20px 14px' }}>
      <div className="skel" style={{ height: 22, width: 220, marginBottom: 18 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
        {Array.from({ length: 10 }, (_, i) => <div key={i} className="skel" style={{ aspectRatio: '3 / 4', borderRadius: 'var(--r-md)' }} />)}
      </div>
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CustomerAuthProvider>
        <Toaster position="bottom-center" containerClassName="toasts" toastOptions={{ duration: 3000, style: { borderRadius: 10, fontSize: 14, padding: '10px 14px' } }} />
        <Suspense fallback={<PageLoader />}>
          <Routes>

            {/* ── Customer routes ── */}
            <Route path="/"                   element={<Home />} />
            <Route path="/products"           element={<AllProducts />} />
            <Route path="/products/:id"       element={<ProductDetail />} />
            <Route path="/category/:id"       element={<CategoryPage />} />
            <Route path="/cart"               element={<CartPage />} />
            <Route path="/checkout"           element={<CheckoutPage />} />
            <Route path="/flash-sale"         element={<FlashSalePage />} />
            <Route path="/wishlist"           element={<WishlistPage />} />
            <Route path="/account"            element={<AccountPage />} />
            <Route path="/track/:orderId?"    element={<TrackingPage />} />
            <Route path="/about"              element={<AboutPage />} />
            <Route path="/contact"            element={<ContactPage />} />
            <Route path="/electricians"       element={<ElectriciansPage />} />
            <Route path="/login"              element={<AuthPage />} />
            <Route path="/reset-password"     element={<ResetPassword />} />
            <Route path="/policies/:slug"     element={<PolicyPage />} />
            <Route path="/policies"           element={<Navigate to="/policies/returns" replace />} />

            {/* ── Admin login (public) ── */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* ── Admin protected routes ── */}
            <Route element={<AdminProtectedRoute allowedRoles={['admin','super_admin']} />}>
            <Route element={<AdminShell />}>
              <Route path="/admin"            element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard"  element={<AdminDashboard />} />
              <Route path="/admin/products"   element={<AdminProducts />} />
              <Route path="/admin/categories" element={<Navigate to="/admin/products" replace />} />
              <Route path="/admin/orders"     element={<AdminOrders />} />
              <Route path="/admin/customers"  element={<AdminCustomers />} />
              <Route path="/admin/banners"        element={<AdminBanners />} />
              <Route path="/admin/subcategories"  element={<Navigate to="/admin/products" replace />} />
              <Route path="/admin/featured"   element={<AdminFeatured />} />
              <Route path="/admin/flash-sale" element={<AdminFlashSale />} />
              <Route path="/admin/payments"   element={<AdminPayments />} />
              <Route path="/admin/shipping"   element={<AdminShipping />} />
              <Route path="/admin/settings"       element={<AdminSettings />} />
              <Route path="/admin/electricians"   element={<AdminElectricians />} />
              <Route path="/admin/coupons"        element={<AdminCoupons />} />
              <Route path="/admin/assistant"      element={<AdminAssistant />} />
            </Route>
            </Route>

            {/* ── 404 ── */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </Suspense>
        </CustomerAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
