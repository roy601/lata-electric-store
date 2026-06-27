import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loginAdmin, logoutAdmin, refreshToken, getMe } from '../api/authApi';

const AuthContext = createContext(null);

// Access token lives only in module memory — never in localStorage
let _accessToken = null;

export const getAccessToken  = ()       => _accessToken;
export const setAccessToken  = (token)  => { _accessToken = token; };
export const clearAccessToken = ()      => { _accessToken = null; };

export const AuthProvider = ({ children }) => {
  const [admin,    setAdmin]    = useState(null);
  const [loading,  setLoading]  = useState(true);  // true while restoring session
  const refreshTimerRef = useRef(null);

  /* ── Schedule silent refresh 1 min before the 15-min access token expires ── */
  const scheduleRefresh = useCallback((expiresInMs = 14 * 60 * 1000) => {
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(silentRefresh, expiresInMs);
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const { data } = await refreshToken();
      setAccessToken(data.accessToken);
      scheduleRefresh();
    } catch {
      clearAccessToken();
      setAdmin(null);
    }
  }, [scheduleRefresh]);

  /* ── Restore session on page load via refresh token cookie ── */
  useEffect(() => {
    const restore = async () => {
      try {
        const { data } = await refreshToken();
        setAccessToken(data.accessToken);
        const me = await getMe();
        setAdmin(me.data.admin);
        scheduleRefresh();
      } catch {
        // No valid refresh token — user is logged out
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, [scheduleRefresh]);

  /* ── Listen for forced logout events (e.g. 401 from interceptor) ── */
  useEffect(() => {
    const handler = () => { clearAccessToken(); setAdmin(null); };
    window.addEventListener('lata:logout', handler);
    return () => window.removeEventListener('lata:logout', handler);
  }, []);

  /* ── Cleanup timer on unmount ── */
  useEffect(() => () => clearTimeout(refreshTimerRef.current), []);

  /* ── Public API ── */
  const login = async (email, password) => {
    const { data } = await loginAdmin(email, password);
    setAccessToken(data.accessToken);
    setAdmin(data.admin);
    scheduleRefresh();
    return data.admin;
  };

  const logout = async () => {
    try { await logoutAdmin(); } catch { /* ignore */ }
    clearAccessToken();
    clearTimeout(refreshTimerRef.current);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
