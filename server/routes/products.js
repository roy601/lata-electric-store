const { crudRouter, pick, dbMessage } = require('../utils/crudRouter');
const { supabase } = require('../config/db');
const { fetchAll } = require('../utils/fetchAll');
const logger       = require('../utils/logger');

const FIELDS = [
  'name', 'slug', 'brand', 'sku', 'price', 'original_price', 'stock', 'description',
  'image', 'extra_images', 'category_id', 'subcategory_id', 'is_active',
  'specifications', 'variants',
  'featured', 'top_sell', 'trending', 'flash_sale', 'flash_price',
];
const SELECT = '*, categories(name)';

const toInt = (v, def, min, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
// Plain text only inside PostgREST or() filters
const safeSearch = (s) => String(s || '').slice(0, 80).replace(/[%_,()"\\*:.]/g, ' ').trim();

/* ── GET /api/products ───────────────────────────────────────────────
   Without ?page → every product (paged internally past the 1000-row limit).
   With ?page    → one page: { products, total, page, pages, stats: { out, low } }
     q, category ('none' | id), stock ('out' | 'low'), sort, limit */
const SORTS = {
  newest:     [['id', false]],
  name:       [['name', true], ['id', true]],
  price_asc:  [['price', true], ['id', true]],
  price_desc: [['price', false], ['id', true]],
  stock_asc:  [['stock', true], ['id', true]],
};
async function listProducts(req, res) {
  try {
    if (req.query.page === undefined) {
      // ?fields=refs&category=… → just ids (used before deleting a category)
      const refs = req.query.fields === 'refs';
      const cat = String(req.query.category || '');
      const products = await fetchAll(() => {
        let q = supabase.from('products').select(refs ? 'id, category_id, subcategory_id' : SELECT);
        if (/^\d+$/.test(cat)) q = q.eq('category_id', +cat);
        return q.order('id', { ascending: false });
      });
      return res.json({ success: true, products });
    }
    const page  = toInt(req.query.page, 1, 1, 1e6);
    const limit = toInt(req.query.limit, 50, 1, 100);
    const q     = safeSearch(req.query.q);
    const cat   = String(req.query.category || '');
    const scope = (query) => {
      if (cat === 'none') query = query.is('category_id', null);
      else if (/^\d+$/.test(cat)) query = query.eq('category_id', +cat);
      if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%,sku.ilike.%${q}%`);
      return query;
    };
    let main = scope(supabase.from('products').select(SELECT, { count: 'exact' }));
    if (req.query.stock === 'out') main = main.lte('stock', 0);
    if (req.query.stock === 'low') main = main.gt('stock', 0).lte('stock', 5);
    (SORTS[req.query.sort] || SORTS.newest).forEach(([col, ascending]) => { main = main.order(col, { ascending }); });
    main = main.range((page - 1) * limit, page * limit - 1);

    const [list, out, low] = await Promise.all([
      main,
      scope(supabase.from('products').select('id', { count: 'exact', head: true })).lte('stock', 0),
      scope(supabase.from('products').select('id', { count: 'exact', head: true })).gt('stock', 0).lte('stock', 5),
    ]);
    const err = list.error || out.error || low.error;
    if (err) return res.status(400).json({ success: false, message: err.message });
    const total = list.count || 0;
    res.json({ success: true, products: list.data, total, page, pages: Math.max(1, Math.ceil(total / limit)), stats: { out: out.count || 0, low: low.count || 0 } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// Admin-only. The storefront reads products directly (public read via RLS).
const router = crudRouter({ table: 'products', select: SELECT, order: [['id', false]], fields: FIELDS, list: listProducts });

/* ── GET /api/products/movements — stock history (inventory_movements, migration 03) ──
   ?product_id=… for one product, otherwise the latest changes across the shop. */
router.get('/movements', async (req, res) => {
  const limit = toInt(req.query.limit, 200, 1, 500);
  let q = supabase.from('inventory_movements').select('id, product_id, change, stock_after, reason, created_at, products(name, image)')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  if (/^\d+$/.test(String(req.query.product_id || ''))) q = q.eq('product_id', +req.query.product_id);
  const { data, error } = await q;
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, movements: data || [] });
});

/* ── GET /api/products/meta — numbers and suggestions for the admin page ──
   { total, uncategorised, counts: {categoryId: n}, brands: [...], specKeys: {categoryId: [...]}, allSpecKeys: [...] } */
router.get('/meta', async (req, res) => {
  try {
    const rows = await fetchAll(() => supabase.from('products').select('id, category_id, brand, specifications').order('id'));
    const counts = {}, specCount = {}, brands = new Set(), allKeys = new Set();
    let uncategorised = 0;
    rows.forEach(p => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1; else uncategorised++;
      if (p.brand?.trim()) brands.add(p.brand.trim());
      (Array.isArray(p.specifications) ? p.specifications : []).forEach(s => {
        const k = s?.key?.trim();
        if (!k) return;
        allKeys.add(k);
        if (p.category_id) {
          const m = (specCount[p.category_id] ||= {});
          m[k] = (m[k] || 0) + 1;
        }
      });
    });
    const specKeys = Object.fromEntries(Object.entries(specCount).map(([cat, m]) =>
      [cat, Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)]));
    res.json({ success: true, total: rows.length, uncategorised, counts, brands: [...brands].sort(), specKeys, allSpecKeys: [...allKeys].sort() });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

/* ── POST /api/products/lookup — find existing products for an Excel import ──
   Body { ids: [], skus: [], names: [] } → { products: [...], skuIndex: {sku: id}, nameIndex: {name: id} }
   (matching is case-insensitive; only matched products are returned in full) */
router.post('/lookup', async (req, res) => {
  try {
    const lc = (v) => String(v ?? '').trim().toLowerCase();
    const wantIds   = new Set((req.body?.ids   || []).map(Number).filter(Number.isInteger));
    const wantSkus  = new Set((req.body?.skus  || []).map(lc).filter(Boolean));
    const wantNames = new Set((req.body?.names || []).map(lc).filter(Boolean));
    const index = await fetchAll(() => supabase.from('products').select('id, name, sku').order('id'));
    const skuIndex = {}, nameIndex = {};
    const matched = new Set();
    index.forEach(p => {
      if (wantIds.has(p.id)) matched.add(p.id);
      const s = lc(p.sku), n = lc(p.name);
      if (s && wantSkus.has(s))  { skuIndex[s] = p.id; matched.add(p.id); }
      if (n && wantNames.has(n)) { nameIndex[n] = p.id; }
    });
    const ids = [...matched], products = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('products')
        .select('id, name, sku, price, stock, category_id, specifications, variants').in('id', ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      products.push(...data);
    }
    res.json({ success: true, products, skuIndex, nameIndex });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

/* ── Row checks shared by /bulk and imports ── */
const rowError = (p) => {
  if (p.id !== undefined && !Number.isInteger(+p.id))                         return 'Invalid product id';
  if (p.id === undefined && !String(p.name || '').trim())                       return 'Name is required';
  if (p.name !== undefined && !String(p.name).trim())                           return 'Name cannot be empty';
  if (p.id === undefined && !(+p.price > 0))                                    return 'Price must be more than 0';
  if (p.price !== undefined && !(+p.price > 0))                                 return 'Price must be more than 0';
  if (p.stock !== undefined && (!Number.isInteger(+p.stock) || +p.stock < 0))   return 'Stock must be a whole number';
  return null;
};

/**
 * Writes one batch (≤100 rows). Inserts rows without an id, updates rows with one.
 * Returns a result per row: { ok, action, id, before?, error? } — `before` holds the
 * replaced values of updated rows so an import can be undone.
 */
async function writeBatch(rows) {
  const results = new Array(rows.length);
  const inserts = [], updates = [];
  rows.forEach((row, i) => {
    const err = rowError(row || {});
    if (err) results[i] = { ok: false, error: err };
    else if (row.id === undefined) inserts.push({ i, payload: pick(row, FIELDS) });
    else updates.push({ i, id: +row.id, payload: pick(row, FIELDS) });
  });

  if (inserts.length) {
    const { data, error } = await supabase.from('products').insert(inserts.map(r => r.payload)).select('id');
    if (!error) inserts.forEach((r, k) => { results[r.i] = { ok: true, action: 'added', id: data[k]?.id }; });
    else {
      for (const r of inserts) {   // find the bad row(s)
        const one = await supabase.from('products').insert(r.payload).select('id').single();
        results[r.i] = one.error ? { ok: false, error: dbMessage(one.error) } : { ok: true, action: 'added', id: one.data.id };
      }
    }
  }

  if (updates.length) {
    const { data: current, error } = await supabase.from('products').select('*').in('id', updates.map(u => u.id));
    if (error) throw new Error(error.message);
    const byId = new Map(current.map(p => [p.id, p]));
    for (let k = 0; k < updates.length; k += 10) {
      await Promise.all(updates.slice(k, k + 10).map(async u => {
        const now = byId.get(u.id);
        if (!now) { results[u.i] = { ok: false, error: 'Product not found' }; return; }
        if (!Object.keys(u.payload).length) { results[u.i] = { ok: true, action: 'unchanged', id: u.id }; return; }
        // Snapshot the old values first — this is what Undo puts back
        const before = JSON.parse(JSON.stringify(Object.fromEntries(Object.keys(u.payload).map(f => [f, now[f] ?? null]))));
        const { error: e } = await supabase.from('products').update(u.payload).eq('id', u.id);
        results[u.i] = e ? { ok: false, error: dbMessage(e) } : { ok: true, action: 'updated', id: u.id, before };
      }));
    }
  }
  return results;
}

/* ── POST /api/products/bulk — up to 100 rows, answered right away ── */
router.post('/bulk', async (req, res) => {
  const rows = req.body?.products;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ success: false, message: 'No products sent.' });
  if (rows.length > 100) return res.status(400).json({ success: false, message: 'Send at most 100 products per request.' });
  try {
    const results = (await writeBatch(rows)).map(({ before, ...r }) => r);
    res.json({ success: true, results });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

/* ── Excel imports: run on the server, keep history, can be undone ── */
const MAX_IMPORT_ROWS = 20000;
const STALE_MS = 3 * 60 * 1000;   // a "running" import that hasn't moved for 3 min was cut off (server restart)

const touchImport = (id, patch) =>
  supabase.from('product_imports').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);

async function runImport(importId, rows) {
  const stats = { processed: 0, added: 0, updated: 0, failed: 0 };
  const errors = [];
  try {
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const results = await writeBatch(chunk.map(r => r.data));
      const items = [];
      results.forEach((r, k) => {
        const src = chunk[k];
        if (!r.ok) { stats.failed++; if (errors.length < 1000) errors.push({ row: src.row, name: src.name, error: r.error }); }
        else if (r.action === 'added')   { stats.added++;   items.push({ import_id: importId, product_id: r.id, action: 'added' }); }
        else if (r.action === 'updated') { stats.updated++; items.push({ import_id: importId, product_id: r.id, action: 'updated', before: r.before }); }
      });
      if (items.length) {
        const { error } = await supabase.from('product_import_items').insert(items);
        if (error) logger.error(`import ${importId}: could not record history: ${error.message}`);
      }
      stats.processed += chunk.length;
      await touchImport(importId, { ...stats, errors });
    }
    await touchImport(importId, { status: 'done', finished_at: new Date().toISOString() });
  } catch (err) {
    logger.error(`import ${importId} failed: ${err.message}`);
    await touchImport(importId, { ...stats, errors: [...errors, { row: null, name: '', error: `Import stopped: ${err.message}` }], status: 'failed', finished_at: new Date().toISOString() });
  }
}

const withStale = (imp) =>
  imp && imp.status === 'running' && Date.now() - new Date(imp.updated_at).getTime() > STALE_MS
    ? { ...imp, status: 'interrupted' } : imp;

// Start: { file_name, rows: [{ row, name, data }] } → { id } (work continues in the background)
router.post('/imports', async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ success: false, message: 'No rows to import.' });
  if (rows.length > MAX_IMPORT_ROWS) return res.status(400).json({ success: false, message: `At most ${MAX_IMPORT_ROWS} rows per import. Split the file.` });
  if (rows.some(r => !r || typeof r.data !== 'object' || r.data === null)) return res.status(400).json({ success: false, message: 'Invalid rows.' });

  const { data: imp, error } = await supabase.from('product_imports')
    .insert({ admin_id: req.admin?.id || null, file_name: String(req.body.file_name || '').slice(0, 200) || null, total: rows.length })
    .select('id').single();
  if (error) return res.status(400).json({ success: false, message: `Could not start the import: ${error.message}` });

  res.status(202).json({ success: true, id: imp.id });
  runImport(imp.id, rows.map(r => ({ row: r.row ?? null, name: String(r.name || '').slice(0, 200), data: r.data })));
});

router.get('/imports', async (req, res) => {
  const { data, error } = await supabase.from('product_imports')
    .select('id, file_name, status, total, processed, added, updated, failed, created_at, finished_at, undone_at')
    .order('created_at', { ascending: false }).limit(30);
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, imports: data.map(withStale) });
});

router.get('/imports/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
  const { data, error } = await supabase.from('product_imports').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(400).json({ success: false, message: error.message });
  if (!data)  return res.status(404).json({ success: false, message: 'Import not found.' });
  res.json({ success: true, import: withStale(data) });
});

// Undo: delete the products it added, put back the values it changed
router.post('/imports/:id/undo', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
  const id = +req.params.id;
  const { data: raw } = await supabase.from('product_imports').select('*').eq('id', id).maybeSingle();
  const imp = withStale(raw);
  if (!imp) return res.status(404).json({ success: false, message: 'Import not found.' });
  if (imp.status === 'running') return res.status(409).json({ success: false, message: 'This import is still running.' });
  if (imp.status === 'undone')  return res.status(409).json({ success: false, message: 'This import was already undone.' });

  // Claim it, so two clicks can't undo twice
  const { data: claimed } = await supabase.from('product_imports')
    .update({ status: 'undone', undone_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).neq('status', 'undone').select('id');
  if (!claimed?.length) return res.status(409).json({ success: false, message: 'This import was already undone.' });

  try {
    const items = await fetchAll(() => supabase.from('product_import_items').select('product_id, action, before').eq('import_id', id).order('id'));
    const added = items.filter(i => i.action === 'added').map(i => i.product_id);
    const updated = items.filter(i => i.action === 'updated' && i.before && Object.keys(i.before).length);
    for (let i = 0; i < added.length; i += 200) {
      const { error } = await supabase.from('products').delete().in('id', added.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
    let restoreFailed = 0;
    for (let i = 0; i < updated.length; i += 10) {
      await Promise.all(updated.slice(i, i + 10).map(async it => {
        const { error } = await supabase.from('products').update(pick(it.before, FIELDS)).eq('id', it.product_id);
        if (error) restoreFailed++;
      }));
    }
    res.json({ success: true, removed: added.length, restored: updated.length - restoreFailed, restoreFailed });
  } catch (err) {
    logger.error(`undo import ${id} failed: ${err.message}`);
    res.status(500).json({ success: false, message: `Undo stopped part-way: ${err.message}` });
  }
});

module.exports = router;
