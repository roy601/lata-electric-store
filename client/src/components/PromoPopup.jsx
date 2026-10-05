import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* Pop-up banner (Admin → Banners → Pop-up offer). Shown once to each visitor,
   after the intro animation. A cookie remembers which pop-up they saw, so a
   new pop-up is shown again once. */
const seenId = () => (document.cookie.match(/(?:^|;\s*)lata_popup=([^;]+)/) || [])[1];
const remember = (id) => {
  document.cookie = `lata_popup=${id}; max-age=${60 * 60 * 24 * 180}; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
};
// Don't interrupt someone paying or signing in
const QUIET = /^\/(checkout|cart|login|register|reset-password|track)/;

export default function PromoPopup() {
  const [banner, setBanner] = useState(null);
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (QUIET.test(window.location.pathname)) return;
    if (/bot|crawler|spider|lighthouse/i.test(navigator.userAgent)) return;
    let alive = true, timer;
    supabase.from('banners').select('id,image,title,product_id,link_url')
      .eq('placement', 'popup').eq('is_active', true).order('sort_order').order('id').limit(1)
      .then(({ data }) => {
        const b = data?.[0];
        if (!alive || !b || String(b.id) === seenId()) return;
        const img = new window.Image();
        img.src = b.image;
        // wait for the intro animation to finish and the picture to load
        const wait = () => {
          if (!alive) return;
          if (document.getElementById('lata-intro') || !img.complete) { timer = setTimeout(wait, 300); return; }
          if (!img.naturalWidth) return; // picture failed to load
          timer = setTimeout(() => { if (alive) { setBanner(b); setShow(true); remember(b.id); } }, 900);
        };
        wait();
      });
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  // Close with Esc; no page scrolling behind it
  useEffect(() => {
    if (!show) return;
    const onKey = (e) => e.key === 'Escape' && setShow(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [show]);

  // Moving to another page closes it
  useEffect(() => { setShow(false); }, [pathname]);

  if (!show || !banner) return null;
  const target = banner.link_url || (banner.product_id ? `/products/${banner.product_id}` : null);
  const open = () => {
    if (!target) return;
    setShow(false);
    if (target.startsWith('/')) navigate(target);
    else window.open(target, '_blank', 'noopener');
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={banner.title || 'Special offer'} onClick={() => setShow(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'popupFade .25s ease' }}>
      <style>{`
        @keyframes popupFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popupIn { from { opacity: 0; transform: scale(.92) translateY(10px) } to { opacity: 1; transform: none } }
      `}</style>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', animation: 'popupIn .35s cubic-bezier(.2,.9,.3,1.2)' }}>
        <img src={banner.image} alt={banner.title || 'Special offer'} onClick={open}
          style={{ display: 'block', maxWidth: 'min(92vw, 680px)', maxHeight: '78vh', width: 'auto', height: 'auto', borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,.4)', cursor: target ? 'pointer' : 'default', filter: 'none' }} />
        <button onClick={() => setShow(false)} aria-label="Close"
          style={{ position: 'absolute', top: -14, right: -14, width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#fff', color: '#0F172A', boxShadow: '0 4px 14px rgba(0,0,0,.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
