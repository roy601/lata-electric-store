import axios from 'axios';
import { supabase } from '../lib/supabase';

// Separate client for storefront customers: no admin token, no admin refresh logic.
const customerApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15_000,
});

export const trackOrder = (orderId, phone) =>
  customerApi.get(`/orders/track/${encodeURIComponent(orderId)}`, { params: { phone } });

const authHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
};

/** Place an order. When signed in, the server links it to the account. */
export const placeOrder = async (body) => customerApi.post('/orders', body, { headers: await authHeader() });

export const validateCoupon = (code, subtotal) => customerApi.post('/coupons/validate', { code, subtotal });

/** Orders for the signed-in customer (verified server-side from their Supabase session). */
export const getMyOrders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  return customerApi.get('/orders/mine', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
};

/** Add an earlier guest order to the signed-in account (needs order ID + phone used). */
export const claimOrder = async (orderId, phone) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  return customerApi.post('/orders/claim', { order_id: orderId, phone }, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
};
