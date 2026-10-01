import axios from 'axios';
import { supabase } from '../lib/supabase';

// Separate client for storefront customers: no admin token, no admin refresh logic.
const customerApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15_000,
});

export const trackOrder = (orderId, phone) =>
  customerApi.get(`/orders/track/${encodeURIComponent(orderId)}`, { params: { phone } });

/** Orders for the signed-in customer (verified server-side from their Supabase session). */
export const getMyOrders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  return customerApi.get('/orders/mine', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
};
