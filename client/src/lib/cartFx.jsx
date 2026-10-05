import toast from 'react-hot-toast';
import { addToCart } from '../store/cartStore';

/* Small feedback effects for the shop: the product photo flies into the cart,
   the cart icon bounces, phones give a short tap, and a quiet message offers
   "View cart" instead of throwing the cart drawer open every time. */

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A short vibration on phones that support it (Android). */
export const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

/** Quick scale "pop" on an element (cart icon, heart…). */
export function pop(el, scale = 1.25) {
  if (!el?.animate || reduceMotion()) return;
  el.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.3,1.6,.5,1)' });
}

// The visible cart icon (header on desktop, bottom bar or header on phones)
function cartTarget() {
  const els = [...document.querySelectorAll('[data-cart-target]')];
  return els.find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; });
}

/** Flies a copy of `img` into the cart icon. */
export function flyToCart(img) {
  const target = cartTarget();
  if (!target) return;
  if (!img || !img.getBoundingClientRect || reduceMotion()) { pop(target); return; }
  let from = img.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width) { pop(target); return; }
  // Photo scrolled off screen (e.g. tapped in the sticky bar): start just above the bottom of the screen
  if (from.bottom < 40 || from.top > window.innerHeight - 40) {
    const s = 140;
    from = { left: (window.innerWidth - s) / 2, top: window.innerHeight - s - 150, width: s, height: s };
  }

  const size = Math.min(from.width, from.height, 220);
  const ghost = document.createElement('img');
  ghost.src = img.currentSrc || img.src;
  ghost.alt = '';
  Object.assign(ghost.style, {
    position: 'fixed', zIndex: 3000, pointerEvents: 'none', margin: 0,
    left: `${from.left + (from.width - size) / 2}px`, top: `${from.top + (from.height - size) / 2}px`,
    width: `${size}px`, height: `${size}px`, objectFit: 'contain', padding: '8px', boxSizing: 'border-box',
    background: '#fff', borderRadius: '12px', boxShadow: '0 12px 30px rgba(15,23,42,.25)', transform: 'none', filter: 'none',
  });
  document.body.appendChild(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const end = 28 / size;
  ghost.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(${(1 + end) / 2})`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(${end})`, opacity: 0.4, offset: 1 },
  ], { duration: 720, easing: 'cubic-bezier(.45,.05,.55,.95)' }).onfinish = () => { ghost.remove(); pop(target, 1.35); };
}

/**
 * Add to cart with feedback. `sourceImg` is the product photo to fly from.
 * Returns how many were added.
 */
export function addWithFlair(product, opts = {}, sourceImg) {
  const added = addToCart(product, { ...opts, open: false });
  if (added > 0) {
    flyToCart(sourceImg);
    haptic(12);
    toast.success((t) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        Added to cart
        <button onClick={() => { toast.dismiss(t.id); window.dispatchEvent(new CustomEvent('lata:open-cart')); }}
          style={{ background: 'none', border: 'none', padding: 0, color: '#1E88E5', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
          View cart
        </button>
      </span>
    ), { id: 'added-to-cart', duration: 2600 });
  }
  return added;
}

/** The product photo inside the card that contains `el`. */
export const photoIn = (el) => el?.closest?.('[data-card]')?.querySelector('img') || null;
