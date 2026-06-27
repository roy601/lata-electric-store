import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps admin routes. Redirects to login if not authenticated.
 * While session is being restored (loading=true), shows a spinner
 * so the user doesn't get a flash redirect on page refresh.
 */
export default function AdminProtectedRoute({ allowedRoles }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={spinnerStyles.page}>
        <div style={spinnerStyles.spinner} />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(admin.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}

const spinnerStyles = {
  page: {
    minHeight:      '100vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     '#f8f9fa',
  },
  spinner: {
    width:        '40px',
    height:       '40px',
    border:       '4px solid #f0f0f0',
    borderTop:    '4px solid #1E88E5',
    borderRadius: '50%',
    animation:    'spin 0.8s linear infinite',
  },
};
