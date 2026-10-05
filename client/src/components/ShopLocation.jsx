import { useState } from 'react';
import { MapPin, Phone, Clock, Navigation, MessageCircle, Copy, Check, ExternalLink } from 'lucide-react';

const BLUE = '#1E88E5';
const WA   = '#25D366';
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const digits = (s) => String(s || '').replace(/\D/g, '');
const fmtTime = (m) => {
  const h = Math.floor(m / 60), min = m % 60, h12 = ((h + 11) % 12) + 1;
  return `${h12}${min ? ':' + String(min).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`;
};

/**
 * "Open now" from the hours text in Settings, e.g. "Sat–Thu: 9am – 8pm".
 * Uses Bangladesh time. Returns null when the text isn't in that shape,
 * so we never show a wrong status.
 */
function openStatus(hours) {
  const m = String(hours || '').toLowerCase().match(
    /(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*[–—-]\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*:?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!m) return null;
  const toMin = (h, mm, ap) => ((+h % 12) + (ap === 'pm' ? 12 : 0)) * 60 + (+mm || 0);
  const from = DAYS.indexOf(m[1]), to = DAYS.indexOf(m[2]);
  const openAt = toMin(m[3], m[4], m[5]), closeAt = toMin(m[6], m[7], m[8]);
  const openDays = new Set();
  for (let d = from; ; d = (d + 1) % 7) { openDays.add(d); if (d === to) break; }

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  const day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
  if (openDays.has(day) && mins >= openAt && mins < closeAt) {
    return { open: true, text: `Open now · closes ${fmtTime(closeAt)}` };
  }
  // Next opening
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    if (!openDays.has(d) || (i === 0 && mins >= openAt)) continue;
    const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAYS[d][0].toUpperCase() + DAYS[d].slice(1);
    return { open: false, text: `Closed · opens ${when} ${fmtTime(openAt)}` };
  }
  return { open: false, text: 'Closed now' };
}

function InfoRow({ Icon, label, children, action }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid var(--bd-eef1f4, #EEF1F4)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--bg-eef6ff, #EEF6FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={BLUE} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-94a3b8, #94A3B8)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--tx-1f2937, #1F2937)', lineHeight: 1.5 }}>{children}</div>
      </div>
      {action}
    </div>
  );
}

export default function ShopLocation({ settings: s, isMobile }) {
  const [copied, setCopied] = useState(false);
  const name     = s?.site_name || 'Lata Electric';
  const status   = openStatus(s?.hours);
  const phone    = digits(s?.phone);
  const wa       = digits(s?.whatsapp);
  const waLink   = wa ? `https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}?text=${encodeURIComponent(`Hello ${name}, I have a question.`)}` : null;
  const directions = s?.map_url || (s?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${s.address}`)}` : null);

  const copyAddress = () => {
    navigator.clipboard?.writeText(`${name}, ${s.address}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  const btn = (bg, fg, border) => ({
    flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '11px 12px', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 13, textDecoration: 'none',
    background: bg, color: fg, border: `1.5px solid ${border || bg}`, whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(300px, 360px) 1fr', gap: isMobile ? 14 : 20, alignItems: 'stretch' }}>

      {/* ── Shop card ── */}
      <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: 'var(--r-md)', border: '1px solid var(--bd-e8ecf1, #E8ECF1)', padding: isMobile ? 16 : 20, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {s?.logo_url
            ? <img src={s.logo_url} alt={name} style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 'var(--r-md)', background: s.logo_bg_color || 'var(--bg-f8fafc, #F8FAFC)', border: '1px solid var(--bd-eef1f4, #EEF1F4)', padding: 4, boxSizing: 'border-box' }} />
            : <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: BLUE, color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{name[0]}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--tx-0f172a, #0F172A)', lineHeight: 1.2 }}>{name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--tx-64748b, #64748B)', marginTop: 2 }}>Electrical & hardware shop</div>
          </div>
        </div>

        {status && (
          <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 'var(--r-md)', marginBottom: 6,
            background: status.open ? 'var(--bg-ecfdf3, #ECFDF3)' : 'var(--bg-fef2f2, #FEF2F2)', color: status.open ? 'var(--tx-067647, #067647)' : 'var(--tx-b42318, #B42318)', fontSize: 12.5, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.open ? '#12B76A' : '#F04438', boxShadow: status.open ? '0 0 0 3px rgba(18,183,106,.18)' : 'none' }} />
            {status.text}
          </div>
        )}

        {s?.address && (
          <InfoRow Icon={MapPin} label="Address"
            action={navigator.clipboard && (
              <button onClick={copyAddress} title="Copy address" aria-label="Copy address"
                style={{ background: 'none', border: '1px solid var(--bd-e2e8f0, #E2E8F0)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copied ? '#16A34A' : 'var(--tx-64748b, #64748B)', flexShrink: 0 }}>
                {copied ? <Check size={15} /> : <Copy size={14} />}
              </button>
            )}>
            {s.address}
          </InfoRow>
        )}
        {phone && (
          <InfoRow Icon={Phone} label="Phone">
            <a href={`tel:${phone}`} style={{ color: 'var(--tx-1f2937, #1F2937)', fontWeight: 600, textDecoration: 'none' }}>{s.phone}</a>
          </InfoRow>
        )}
        {s?.hours && (
          <InfoRow Icon={Clock} label="Opening hours">{s.hours}</InfoRow>
        )}

        {/* Actions */}
        <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {directions && (
            <a href={directions} target="_blank" rel="noopener noreferrer" style={btn(BLUE, '#fff')}
              onMouseEnter={e => e.currentTarget.style.background = '#1565C0'} onMouseLeave={e => e.currentTarget.style.background = BLUE}>
              <Navigation size={15} /> Get directions
            </a>
          )}
          {(phone || waLink) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {phone && <a href={`tel:${phone}`} style={btn('#fff', '#1F2937', '#E2E8F0')}><Phone size={15} color={BLUE} /> Call</a>}
              {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" style={btn('#fff', '#1F2937', '#E2E8F0')}><MessageCircle size={15} color={WA} /> WhatsApp</a>}
            </div>
          )}
        </div>
      </div>

      {/* ── Map ── */}
      {s?.map_embed_src ? (
        <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--bd-e8ecf1, #E8ECF1)', minHeight: isMobile ? 260 : 380, background: 'var(--bg-eef2f6, #EEF2F6)' }}>
          <iframe
            title={`${name} on Google Maps`}
            src={s.map_embed_src}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : directions ? (
        <a href={directions} target="_blank" rel="noopener noreferrer"
          style={{ minHeight: isMobile ? 200 : 380, borderRadius: 'var(--r-md)', border: '1px solid var(--bd-e8ecf1, #E8ECF1)', background: 'linear-gradient(135deg,var(--bg-eef6ff, #EEF6FF),var(--bg-dcebfb, #DCEBFB))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }}>
          <MapPin size={44} color={BLUE} />
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)' }}>See us on Google Maps</span>
          <span style={{ fontSize: 12.5, color: 'var(--tx-475569, #475569)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>Opens in a new tab <ExternalLink size={12} /></span>
        </a>
      ) : null}
    </div>
  );
}
