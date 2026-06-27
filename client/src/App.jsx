import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import AdminProtectedRoute from './components/layout/AdminProtectedRoute';

// ── Lazy imports for code-splitting ──
import { lazy, Suspense } from 'react';

const AdminLogin     = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts  = lazy(() => import('./pages/admin/Products'));
const AdminCategories= lazy(() => import('./pages/admin/Categories'));
const AdminOrders    = lazy(() => import('./pages/admin/Orders'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminSettings  = lazy(() => import('./pages/admin/Settings'));
const AdminPayments  = lazy(() => import('./pages/admin/Payments'));
const AdminShipping  = lazy(() => import('./pages/admin/Shipping'));
const AdminFeatured  = lazy(() => import('./pages/admin/Featured'));
const AdminFlashSale = lazy(() => import('./pages/admin/FlashSale'));
const AdminBanners        = lazy(() => import('./pages/admin/Banners'));
const AdminSubcategories  = lazy(() => import('./pages/admin/Subcategories'));
const AdminElectricians   = lazy(() => import('./pages/admin/Electricians'));
const AdminCoupons        = lazy(() => import('./pages/admin/Coupons'));

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
const ElectriciansPage  = lazy(() => import('./pages/customer/Electricians'));

const PageLoader = () => (
  <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
    <div style={{ width:36,height:36,border:'4px solid #f0f0f0',borderTop:'4px solid #1E88E5',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CustomerAuthProvider>
        <Toaster position="bottom-right" toastOptions={{ duration: 3000 }} />
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

            {/* ── Admin login (public) ── */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* ── Admin protected routes ── */}
            <Route element={<AdminProtectedRoute allowedRoles={['admin','super_admin']} />}>
              <Route path="/admin"            element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard"  element={<AdminDashboard />} />
              <Route path="/admin/products"   element={<AdminProducts />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/orders"     element={<AdminOrders />} />
              <Route path="/admin/customers"  element={<AdminCustomers />} />
              <Route path="/admin/banners"        element={<AdminBanners />} />
              <Route path="/admin/subcategories"  element={<AdminSubcategories />} />
              <Route path="/admin/featured"   element={<AdminFeatured />} />
              <Route path="/admin/flash-sale" element={<AdminFlashSale />} />
              <Route path="/admin/payments"   element={<AdminPayments />} />
              <Route path="/admin/shipping"   element={<AdminShipping />} />
              <Route path="/admin/settings"       element={<AdminSettings />} />
              <Route path="/admin/electricians"   element={<AdminElectricians />} />
              <Route path="/admin/coupons"        element={<AdminCoupons />} />
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
