import api from './axiosConfig';

// All admin data goes through the Express API (admin JWT) — never the anon Supabase key.

// ── Dashboard ──────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard');

// ── Products ───────────────────────────────────────────────
export const getProducts    = (params) => api.get('/products', { params });
export const createProduct  = (data)   => api.post('/products', data);
export const updateProduct  = (id, d)  => api.patch(`/products/${id}`, d);
export const deleteProduct  = (id)     => api.delete(`/products/${id}`);

// ── Categories & subcategories ─────────────────────────────
export const getCategories      = ()       => api.get('/categories');
export const createCategory     = (data)   => api.post('/categories', data);
export const updateCategory     = (id, d)  => api.patch(`/categories/${id}`, d);
export const deleteCategory     = (id)     => api.delete(`/categories/${id}`);
export const getSubcategories   = (params) => api.get('/subcategories', { params });
export const createSubcategory  = (data)   => api.post('/subcategories', data);
export const updateSubcategory  = (id, d)  => api.patch(`/subcategories/${id}`, d);
export const deleteSubcategory  = (id)     => api.delete(`/subcategories/${id}`);

// ── Banners & electricians ─────────────────────────────────
export const getBanners         = ()       => api.get('/banners');
export const createBanner       = (data)   => api.post('/banners', data);
export const updateBanner       = (id, d)  => api.patch(`/banners/${id}`, d);
export const deleteBanner       = (id)     => api.delete(`/banners/${id}`);
export const getElectricians    = ()       => api.get('/electricians');
export const createElectrician  = (data)   => api.post('/electricians', data);
export const updateElectrician  = (id, d)  => api.patch(`/electricians/${id}`, d);
export const deleteElectrician  = (id)     => api.delete(`/electricians/${id}`);

// ── Orders & customers ─────────────────────────────────────
export const getOrders         = (params)       => api.get('/orders', { params });
export const updateOrderStatus = (id, status)   => api.patch(`/orders/${id}/status`, { status });
export const markOrderPaid     = (id)           => api.patch(`/orders/${id}/paid`);
export const returnOrder       = (id, reason)   => api.patch(`/orders/${id}/return`, { return_reason: reason });
export const getCustomers      = ()             => api.get('/customers');
export const deleteCustomer    = (phone)        => api.delete(`/customers/${encodeURIComponent(phone)}`);

// ── Settings (single row; send only the fields you change) ─
export const getSettings    = ()     => api.get('/settings');
export const updateSettings = (data) => api.patch('/settings', data);

// ── Image upload (bucket: product-images | logos | electricians) ─
export const uploadImage = (file, bucket) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/uploads/image', fd, {
    params:  bucket ? { bucket } : undefined,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ── AI assistant ───────────────────────────────────────────
export const aiStatus             = ()       => api.get('/ai/status');
export const aiConversations      = ()       => api.get('/ai/conversations');
export const aiConversation       = (id)     => api.get(`/ai/conversations/${id}`);
export const aiDeleteConversation = (id)     => api.delete(`/ai/conversations/${id}`);
// Answers can take a while (several tool calls), so allow up to 2 minutes
export const aiChat = (conversationId, message) =>
  api.post('/ai/chat', { conversation_id: conversationId, message }, { timeout: 120_000 });

/** Pull a readable message out of an axios error. */
export const errMsg = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback;
