import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ShieldCheck, RotateCcw, Truck, FileText, Lock } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { supabase } from '../../lib/supabase';
import { buildPolicies, POLICY_LINKS, PROMISES } from '../../content/policies';
import { useSeo } from '../../lib/seo';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const ICONS = { returns: RotateCcw, delivery: Truck, privacy: Lock, terms: FileText };
let settingsCache = null;

export default function Policy() {
  const { slug } = useParams();
  const { isMobile } = useBreakpoint();
  const [s, setS] = useState(settingsCache || {});

  useEffect(() => {
    if (settingsCache) return;
    supabase.from('settings')
      .select('site_name, phone, whatsapp, email, address, shipping_inside, shipping_outside, free_delivery_threshold')
      .eq('id', 1).maybeSingle()
      .then(({ data }) => { settingsCache = data || {}; setS(settingsCache); });
  }, []);

  const policies = buildPolicies(s);
  const policy = policies[slug];
  useSeo({ title: policy?.title, description: policy?.summary, path: `/policies/${slug}` });
  if (!policy) return <Navigate to="/policies/returns" replace />;
  const Icon = ICONS[slug] || ShieldCheck;

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: isMobile ? '18px 12px 32px' : '32px 16px 48px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '220px minmax(0, 1fr)', gap: isMobile ? 14 : 28, alignItems: 'start' }}>

        {/* Other policies */}
        <nav aria-label="Policies" style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 4, overflowX: isMobile ? 'auto' : 'visible', position: isMobile ? 'static' : 'sticky', top: 90, scrollbarWidth: 'none' }}>
          {POLICY_LINKS.map(([key, label]) => {
            const I = ICONS[key]; const active = key === slug;
            return (
              <Link key={key} to={`/policies/${key}`}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap', fontSize: 14, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--tx-1565c0, #1565C0)' : 'var(--tx-475569, #475569)', background: active ? 'var(--bg-eef6ff, #EEF6FF)' : 'transparent' }}>
                <I size={16} /> {label}
              </Link>
            );
          })}
        </nav>

        {/* Policy */}
        <article style={{ background: 'var(--bg-fff, #fff)', borderRadius: 16, border: '1px solid var(--bd-edf0f3, #EDF0F3)', padding: isMobile ? '22px 18px' : '34px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg-eef6ff, #EEF6FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color="#1E88E5" /></span>
            <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 27, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)', letterSpacing: -.3 }}>{policy.title}</h1>
          </div>
          <p style={{ fontSize: 15.5, color: 'var(--tx-334155, #334155)', lineHeight: 1.7, margin: '0 0 6px' }}>{policy.summary}</p>
          <p style={{ fontSize: 12.5, color: 'var(--tx-94a3b8, #94A3B8)', margin: '0 0 26px' }}>Last updated: {PROMISES.lastUpdated}</p>

          {policy.sections.map(sec => (
            <section key={sec.heading} style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx-0f172a, #0F172A)', margin: '0 0 8px' }}>{sec.heading}</h2>
              {sec.body.map((b, i) => Array.isArray(b)
                ? <ul key={i} style={{ margin: '0 0 10px', paddingLeft: 20, color: 'var(--tx-334155, #334155)', fontSize: 14.5, lineHeight: 1.8 }}>{b.map(li => <li key={li}>{li}</li>)}</ul>
                : <p key={i} style={{ margin: '0 0 10px', color: 'var(--tx-334155, #334155)', fontSize: 14.5, lineHeight: 1.75 }}>{b}</p>)}
            </section>
          ))}

          <div style={{ marginTop: 10, padding: '14px 16px', background: 'var(--bg-f8fafc, #F8FAFC)', borderRadius: 12, fontSize: 14, color: 'var(--tx-334155, #334155)' }}>
            Questions? <Link to="/contact" style={{ color: '#1E88E5', fontWeight: 700, textDecoration: 'none' }}>Contact us</Link> — we're happy to help.
          </div>
        </article>
      </div>
    </CustomerLayout>
  );
}
