/**
 * Storefront product queries. Everything is filtered, sorted and paged in the
 * database, so the shop never downloads the whole catalogue (and isn't capped
 * by Supabase's 1000-rows-per-request limit).
 * Needs migration 04 (effective_price column + read functions).
 */
import { supabase } from './supabase';

// Plain text only inside a PostgREST or() filter
export const cleanSearch = (s) => String(s || '').slice(0, 80).replace(/[%_,()"\\*:.]/g, ' ').replace(/\s+/g, ' ').trim();

const SORTS = {
  newest:     [['created_at', false], ['id', false]],
  popular:    [['top_sell', false], ['created_at', false], ['id', false]],
  price_asc:  [['effective_price', true], ['id', true]],
  price_desc: [['effective_price', false], ['id', true]],
  name_asc:   [['name', true], ['id', true]],
};

/**
 * One page of active products.
 * @returns {Promise<{ products: object[], total: number }>}
 */
export async function fetchProductPage({ cat, sub, brand, minPrice, maxPrice, q, sort = 'newest', page = 1, perPage = 20, columns = '*' } = {}) {
  let query = supabase.from('products').select(columns, { count: 'exact' }).eq('is_active', true);
  if (cat && cat !== 'all') query = query.eq('category_id', +cat);
  if (sub)                  query = query.eq('subcategory_id', +sub);
  if (brand && brand !== 'all') query = query.eq('brand', brand);
  if (minPrice > 0)         query = query.gte('effective_price', minPrice);
  if (Number.isFinite(maxPrice)) query = query.lt('effective_price', maxPrice);
  const text = cleanSearch(q);
  if (text) query = query.or(`name.ilike.%${text}%,brand.ilike.%${text}%,sku.ilike.%${text}%,description.ilike.%${text}%`);
  (SORTS[sort] || SORTS.newest).forEach(([col, ascending]) => { query = query.order(col, { ascending }); });
  const from = (page - 1) * perPage;
  const { data, count, error } = await query.range(from, from + perPage - 1);
  if (error) throw error;
  return { products: data || [], total: count || 0 };
}

/** { categoryId: activeProductCount } */
export async function fetchCategoryCounts() {
  const { data } = await supabase.rpc('category_product_counts', { p_active_only: true });
  return Object.fromEntries((data || []).map(r => [r.category_id, Number(r.total)]));
}

export async function fetchBrands() {
  const { data } = await supabase.rpc('product_brands');
  return (data || []).map(r => r.brand);
}

/** Small list for the header search box. */
export async function fetchSuggestions(q, limit = 6) {
  const text = cleanSearch(q);
  if (!text) return [];
  const { data } = await supabase.from('products')
    .select('id, name, price, image, flash_sale, flash_price, effective_price')
    .eq('is_active', true)
    .or(`name.ilike.%${text}%,brand.ilike.%${text}%,sku.ilike.%${text}%`)
    .order('top_sell', { ascending: false }).order('name')
    .limit(limit);
  return data || [];
}
