import axios from 'axios';

const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,           // send the httpOnly refresh-token cookie
  timeout:         15_000,
  headers: { 'Content-Type': 'application/json' },
});

/* ── Access token injector ── */
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('lata_at'); // stored in-memory via sessionStorage
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ── Silent token refresh ── */
let isRefreshing  = false;
let refreshQueue  = [];            // queued requests while refresh is in-flight

const processQueue = (err, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(token)
  );
  refreshQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          })
          .catch(Promise.reject);
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        );
        const newToken = data.accessToken;
        sessionStorage.setItem('lata_at', newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        sessionStorage.removeItem('lata_at');
        window.dispatchEvent(new Event('lata:logout'));   // AuthContext listens
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
