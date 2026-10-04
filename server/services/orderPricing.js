/**
 * Server-side order pricing.
 *
 * Mirrors the storefront's rules exactly (Checkout.jsx, ProductCard.jsx,
 * ProductDetail.jsx, couponsController.validateCoupon) so a legitimate
 * checkout always matches, while a tampered price or total is rejected.
 * Pure function — no DB access — so it can be unit-tested.
 */

const INSIDE_DHAKA = ['Dhaka', 'Gazipur', 'Narayanganj', 'Narsingdi', 'Manikganj', 'Munshiganj'];

class PricingError extends Error {
  constructor(message, code) {
    super(message);
    this.code       = code;
    this.statusCode = 409;
  }
}

/** Every price a cart line may legitimately carry for this product. */
const allowedPrices = (p) => {
  const prices = [+p.price];
  if (p.flash_sale && p.flash_price) prices.push(+p.flash_price);
  (Array.isArray(p.variants) ? p.variants : []).forEach(v =>
    (v.options || []).forEach(o => {
      if (o && typeof o === 'object' && o.price != null && o.price !== '' && !isNaN(+o.price)) prices.push(+o.price);
    })
  );
  return prices;
};

/** Same maths as validateCoupon; throws PricingError when not applicable. */
const couponDiscount = (coupon, subtotal, now = new Date()) => {
  if (!coupon || !coupon.is_active)                              throw new PricingError('Invalid or expired coupon code.', 'COUPON_INVALID');
  if (coupon.expires_at && new Date(coupon.expires_at) < now)    throw new PricingError('This coupon has expired.', 'COUPON_EXPIRED');
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) throw new PricingError('This coupon has reached its usage limit.', 'COUPON_USED_UP');
  if (coupon.min_order && subtotal < coupon.min_order)           throw new PricingError(`Minimum order amount of ৳${coupon.min_order} required.`, 'COUPON_MIN_ORDER');

  let discount = coupon.discount_type === 'percent'
    ? Math.round(subtotal * coupon.discount_value / 100)
    : +coupon.discount_value;
  if (coupon.max_discount) discount = Math.min(discount, +coupon.max_discount);
  return discount;
};

/**
 * @param {object}   input
 * @param {Array}    input.items      cart lines from the client: { id, price, qty, image, variant? }
 * @param {Map}      input.products   id → product row
 * @param {object}   input.settings   settings row (id = 1)
 * @param {object}   [input.coupon]   coupons row, if a code was sent
 * @param {string}   input.district
 * @param {number}   input.clientTotal total the customer saw
 */
const priceOrder = ({ items, products, settings, coupon, district, clientTotal }) => {
  if (!Array.isArray(items) || items.length === 0) throw new PricingError('No items in order', 'NO_ITEMS');

  const ordered = new Map(); // product id → total qty across lines (variants share stock)
  const lines = items.map(i => {
    const p   = products.get(+i.id);
    const qty = +i.qty;
    if (!p || p.is_active === false)                  throw new PricingError('A product in your cart is no longer available. Please refresh your cart.', 'UNAVAILABLE');
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new PricingError('Invalid quantity.', 'BAD_QTY');
    const price = +i.price;
    if (!allowedPrices(p).includes(price))            throw new PricingError(`The price of "${p.name}" has changed. Please refresh your cart.`, 'PRICE_CHANGED');
    const variant = typeof i.variant === 'string' ? i.variant.trim().slice(0, 200) : '';
    ordered.set(p.id, (ordered.get(p.id) || 0) + qty);
    return { id: p.id, name: variant ? `${p.name} (${variant})` : p.name, price, qty, image: i.image || p.image || null };
  });

  // Never accept more than is in stock (only when the stock column was loaded)
  for (const [id, qty] of ordered) {
    const p = products.get(id);
    if (p.stock === undefined) continue;
    const stock = Math.max(0, +p.stock || 0);
    if (qty > stock) {
      throw new PricingError(
        stock === 0 ? `Sorry, "${p.name}" is out of stock. Please remove it from your cart.`
                    : `Only ${stock} of "${p.name}" left in stock. Please reduce the quantity.`,
        'OUT_OF_STOCK');
    }
  }

  const subtotal      = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const inside        = INSIDE_DHAKA.includes(district);
  const deliveryBase  = inside ? (+settings?.shipping_inside || 60) : (+settings?.shipping_outside || 120);
  const freeThreshold = +settings?.free_delivery_threshold || 0;
  const delivery      = freeThreshold && subtotal >= freeThreshold ? 0 : deliveryBase;
  const discount      = coupon !== undefined ? couponDiscount(coupon, subtotal) : 0;
  const total         = Math.max(0, subtotal + delivery - discount);

  if (clientTotal != null && Math.abs(+clientTotal - total) > 0.5) {
    throw new PricingError('Your order total has changed. Please refresh the page and try again.', 'TOTAL_MISMATCH');
  }

  return { lines, subtotal, delivery, discount, total };
};

module.exports = { priceOrder, allowedPrices, couponDiscount, PricingError, INSIDE_DHAKA };
