import api from './axiosConfig';

// ── Dashboard ──────────────────────────────────────────────
export const getDashboardStats = () => api.get('/admin/dashboard');

// ── Products ───────────────────────────────────────────────
export const getProducts    = (params) => api.get('/admin/products', { params });
export const getProduct     = (id)     => api.get(`/admin/products/${id}`);
export const createProduct  = (data)   => api.post('/admin/products', data);
export const updateProduct  = (id, d)  => api.put(`/admin/products/${id}`, d);
export const deleteProduct  = (id)     => api.delete(`/admin/products/${id}`);

// ── Categories ─────────────────────────────────────────────
export const getCategories   = ()      => api.get('/admin/categories');
export const createCategory  = (data)  => api.post('/admin/categories', data);
export const updateCategory  = (id, d) => api.put(`/admin/categories/${id}`, d);
export const deleteCategory  = (id)    => api.delete(`/admin/categories/${id}`);

// ── Orders ─────────────────────────────────────────────────
export const getOrders   = (params)  => api.get('/admin/orders', { params });
export const getOrder    = (id)      => api.get(`/admin/orders/${id}`);
export const updateOrder = (id, d)   => api.put(`/admin/orders/${id}`, d);

// ── Settings ───────────────────────────────────────────────
export const getSettings    = ()     => api.get('/admin/settings');
export const updateSettings = (data) => api.put('/admin/settings', data);

// ── Image upload ───────────────────────────────────────────
export const uploadImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
