/**
 * Vercel function — /sitemap.xml (see vercel.json), built live from the
 * database so every active product and category is listed for Google.
 */
const SITE = (process.env.VITE_SITE_URL || 'https://www.lataelectric.com').replace(/\/$/, '');
const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Supabase returns at most 1000 rows per request — page through
async function all(table, select, filter = '') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?select=${select}${filter}&order=id`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: `${from}-${from + 999}` },
    });
    if (!r.ok) throw new Error(`supabase ${r.status}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const url = (loc, lastmod, priority, changefreq) =>
  `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;

export default async function handler(req, res) {
  try {
    const [products, categories] = await Promise.all([
      all('products', 'id,created_at', '&is_active=eq.true'),
      all('categories', 'id', '&is_active=eq.true'),
    ]);
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      url(`${SITE}/`, null, '1.0', 'daily'),
      url(`${SITE}/products`, null, '0.9', 'daily'),
      url(`${SITE}/flash-sale`, null, '0.7', 'daily'),
      ...categories.map(c => url(`${SITE}/products?cat=${c.id}`, null, '0.8', 'weekly')),
      ...products.map(p => url(`${SITE}/products/${p.id}`, day(p.created_at), '0.7', 'weekly')),
      ...['/about', '/contact', '/electricians', '/policies/returns', '/policies/delivery', '/policies/privacy', '/policies/terms']
        .map(pth => url(`${SITE}${pth}`, null, '0.4', 'monthly')),
      '</urlset>',
    ].join('\n');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch {
    res.status(503).send('Sitemap temporarily unavailable');
  }
}
