import { useEffect } from 'react';

/** The public address of the shop (used for canonical links, previews and Google data). */
export const SITE_URL  = (import.meta.env.VITE_SITE_URL || 'https://www.lataelectric.com').replace(/\/$/, '');
export const SITE_NAME = 'Lata Electric';
const DEFAULT_DESC  = 'Lata Electric — trusted electrical & hardware shop in Dhaka. Fans, lights, wires, switches, kitchen appliances and more, with delivery across Bangladesh and cash on delivery.';
const DEFAULT_IMAGE = `${SITE_URL}/images/logo.jpg`;

const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (content == null || content === '') { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
};
const setLink = (rel, href) => {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) { el?.remove(); return; }
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
  el.setAttribute('href', href);
};
const setJsonLd = (data) => {
  let el = document.getElementById('page-jsonld');
  if (!data) { el?.remove(); return; }
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'page-jsonld'; document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
};

/** Plain text, one line, cut at a word boundary — for descriptions. */
export const clip = (s, n = 158) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n - 1) > 60 ? t.lastIndexOf(' ', n - 1) : n - 1) + '…';
};

/**
 * Sets the page title, description, canonical link, social-share preview and
 * Google structured data while the page is shown.
 *   noindex – keep private/utility pages (cart, account…) out of Google
 */
export function useSeo({ title, description, image, path, type = 'website', jsonLd, noindex = false } = {}) {
  const key = JSON.stringify([title, description, image, path, type, jsonLd, noindex]);
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Electrical & Hardware Shop in Dhaka`;
    const desc = clip(description || DEFAULT_DESC);
    const url  = `${SITE_URL}${path ?? window.location.pathname + window.location.search}`;
    const img  = image || DEFAULT_IMAGE;

    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setLink('canonical', noindex ? null : url);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', img);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', img);
    setJsonLd(noindex ? null : jsonLd);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Google "Store" data for the shop (home, contact pages). */
export const storeJsonLd = (s = {}) => ({
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: s.site_name || SITE_NAME,
  url: SITE_URL,
  image: s.logo_url || DEFAULT_IMAGE,
  logo: s.logo_url || DEFAULT_IMAGE,
  ...(s.phone && !/0{6}/.test(String(s.phone).replace(/\D/g, '')) ? { telephone: s.phone } : {}),
  ...(s.address ? { address: { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: 'Dhaka', addressCountry: 'BD' } } : {}),
  ...(s.map_url ? { hasMap: s.map_url } : {}),
  sameAs: [s.facebook].filter(Boolean),
  priceRange: '৳',
  currenciesAccepted: 'BDT',
  paymentAccepted: 'Cash, bKash, Nagad',
});

/** Google product data: name, photos, brand, price and stock. */
export const productJsonLd = (p, category) => {
  const price = p.flash_sale && p.flash_price ? p.flash_price : p.price;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: p.name,
        image: [p.image, ...(Array.isArray(p.extra_images) ? p.extra_images : [])].filter(Boolean),
        description: clip(p.description || p.name, 500),
        ...(p.sku ? { sku: p.sku } : {}),
        ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
        ...(category ? { category } : {}),
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/products/${p.id}`,
          priceCurrency: 'BDT',
          price: Number(price).toFixed(2),
          availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@type': 'Organization', name: SITE_NAME },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
          ...(category && p.category_id ? [{ '@type': 'ListItem', position: 2, name: category, item: `${SITE_URL}/products?cat=${p.category_id}` }] : []),
          { '@type': 'ListItem', position: category ? 3 : 2, name: p.name, item: `${SITE_URL}/products/${p.id}` },
        ],
      },
    ],
  };
};
