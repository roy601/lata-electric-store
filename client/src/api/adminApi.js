import api from './axiosConfig';

// ── Dashboard ──────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard');

// ── Products ───────────────────────────────────────────────
export const getProducts    = (params) => api.get('/products', { params });
export const getProduct     = (id)     => api.get(`/products/${id}`);
export const createProduct  = (data)   => api.post('/products', data);
export const updateProduct  = (id, d)  => api.put(`/products/${id}`, d);
export const deleteProduct  = (id)     => api.delete(`/products/${id}`);

// ── Categories ─────────────────────────────────────────────
export const getCategories   = ()      => api.get('/categories');
export const createCategory  = (data)  => api.post('/categories', data);
export const updateCategory  = (id, d) => api.put(`/categories/${id}`, d);
export const deleteCategory  = (id)    => api.delete(`/categories/${id}`);

// ── Orders ─────────────────────────────────────────────────
export const getOrders   = (params)  => api.get('/orders', { params });
export const getOrder    = (id)      => api.get(`/orders/${id}`);
export const updateOrder = (id, d)   => api.put(`/orders/${id}`, d);

// ── Settings ───────────────────────────────────────────────
export const getSettings    = ()     => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);

// ── Image upload ───────────────────────────────────────────
export const uploadImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
