/**
 * Vercel function — serves product and category pages to search engines and
 * link-preview bots (Google, Facebook, WhatsApp, Telegram…) with the title,
 * description, photo, price and Google product data already in the HTML.
 * Those bots don't run the React app, so without this every shared link
 * would just say "Lata Electric". Normal visitors never reach this function
 * (see the user-agent rule in vercel.json).
 *
 *   /api/seo?type=product&id=12
 *   /api/seo?type=category&id=3
 */
const SITE = (process.env.VITE_SITE_URL || 'https://www.lataelectric.com').replace(/\/$/, '');
const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n = 158) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
};
const taka = (n) => `৳${Number(n).toLocaleString('en-BD')}`;

const sb = async (path) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  return r.json();
};

let template = null;   // the built index.html, cached per function instance
const getTemplate = async (host) => {
  if (template) return template;
  const r = await fetch(`https://${host}/index.html`);
  template = await r.text();
  return template;
};

function render(html, { title, description, url, image, type, jsonLd, body }) {
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="Lata Electric" />`,
    `<meta property="og:type" content="${esc(type)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
    jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n  ');
  return html
    // drop the generic tags of the template
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+(name|property)="(description|og:[^"]+|twitter:[^"]+)"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace('</head>', `  ${head}\n</head>`)
    // readable content for bots; the React app replaces it for real visitors
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

async function productPage(id) {
  const rows = await sb(`products?id=eq.${id}&is_active=eq.true&select=id,name,description,price,original_price,flash_sale,flash_price,image,extra_images,brand,sku,stock,category_id,categories(name)&limit=1`);
  const p = rows[0];
  if (!p) return null;
  p.name = String(p.name || '').trim();
  if (p.categories?.name) p.categories.name = p.categories.name.trim();
  const price = p.flash_sale && p.flash_price ? p.flash_price : p.price;
  const cat = p.categories?.name;
  const url = `${SITE}/products/${p.id}`;
  const inStock = p.stock > 0;
  return {
    title: `${p.name} | Lata Electric`,
    description: clip(`${p.name} — ${taka(price)}${inStock ? ', in stock' : ''}. ${p.description || 'Genuine product from Lata Electric, Dhaka.'} Cash on delivery across Bangladesh.`),
    url, image: p.image, type: 'product',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product', name: p.name,
          image: [p.image, ...(Array.isArray(p.extra_images) ? p.extra_images : [])].filter(Boolean),
          description: clip(p.description || p.name, 500),
          ...(p.sku ? { sku: p.sku } : {}),
          ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
          ...(cat ? { category: cat } : {}),
          offers: {
            '@type': 'Offer', url, priceCurrency: 'BDT', price: Number(price).toFixed(2),
            availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@type': 'Organization', name: 'Lata Electric' },
          },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
            ...(cat ? [{ '@type': 'ListItem', position: 2, name: cat, item: `${SITE}/products?cat=${p.category_id}` }] : []),
            { '@type': 'ListItem', position: cat ? 3 : 2, name: p.name, item: url },
          ],
        },
      ],
    },
    body: `<main><h1>${esc(p.name)}</h1>${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" width="400" />` : ''}`
      + `<p>Price: ${esc(taka(price))}${p.brand ? ` · Brand: ${esc(p.brand)}` : ''} · ${inStock ? 'In stock' : 'Out of stock'}</p>`
      + (p.description ? `<p>${esc(p.description)}</p>` : '')
      + (cat ? `<p>Category: <a href="${SITE}/products?cat=${p.category_id}">${esc(cat)}</a></p>` : '') + '</main>',
  };
}

async function categoryPage(id) {
  const [cats, products] = await Promise.all([
    sb(`categories?id=eq.${id}&is_active=eq.true&select=id,name&limit=1`),
    sb(`products?category_id=eq.${id}&is_active=eq.true&select=id,name,price,flash_sale,flash_price,image&order=top_sell.desc,created_at.desc&limit=40`),
  ]);
  const c = cats[0];
  if (!c) return null;
  c.name = String(c.name || '').trim();
  return {
    title: `${c.name} — Buy Online in Bangladesh | Lata Electric`,
    description: clip(`Shop ${c.name} at Lata Electric: ${products.slice(0, 4).map(p => p.name).join(', ')}${products.length > 4 ? ' and more' : ''}. Genuine products, cash on delivery across Bangladesh.`),
    url: `${SITE}/products?cat=${c.id}`, image: products.find(p => p.image)?.image, type: 'website',
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'ItemList', name: c.name,
      itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/products/${p.id}`, name: p.name })),
    },
    body: `<main><h1>${esc(c.name)}</h1><ul>${products.map(p =>
      `<li><a href="${SITE}/products/${p.id}">${esc(p.name)}</a> — ${esc(taka(p.flash_sale && p.flash_price ? p.flash_price : p.price))}</li>`).join('')}</ul></main>`,
  };
}

export default async function handler(req, res) {
  const { type, id } = req.query;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let html;
  try { html = await getTemplate(host); }
  catch { res.status(502).send('Unavailable'); return; }

  if (!/^\d+$/.test(String(id || '')) || !SB_URL || !SB_KEY) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
    return;
  }
  try {
    const page = type === 'category' ? await categoryPage(id) : await productPage(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!page) {
      res.setHeader('X-Robots-Tag', 'noindex');
      res.status(404).send(html);
      return;
    }
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
    res.status(200).send(render(html, page));
  } catch {
    // Never break the page for a bot because of a data hiccup — serve the plain app
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  }
}
