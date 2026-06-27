import { useEffect, useState } from 'react';
import { Phone, HardHat, Inbox } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { supabase } from '../../lib/supabase';

export default function Electricians() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('electricians')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { setList(data || []); setLoading(false); });
  }, []);

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: '#E3F2FD', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <HardHat size={28} color="#1E88E5" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#212529', margin: '0 0 8px' }}>Our Electricians</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>
            Certified professionals ready to help with your electrical needs.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5b1' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #f0f0f0', borderTop: '3px solid #1E88E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Loading…
          </div>
        )}

        {/* Empty */}
        {!loading && list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5b1' }}>
            <Inbox size={52} color="#ccc" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 17, fontWeight: 600, color: '#374151' }}>No electricians listed yet</div>
          </div>
        )}

        {/* Grid */}
        {list.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 20 }}>
            {list.map(e => (
              <div key={e.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow .2s, transform .2s' }}
                onMouseEnter={ev => { ev.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,.13)'; ev.currentTarget.style.transform='translateY(-3px)'; }}
                onMouseLeave={ev => { ev.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,.07)'; ev.currentTarget.style.transform='none'; }}>

                {/* Photo */}
                <div style={{ background: '#EFF6FF', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {e.image
                    ? <img src={e.image} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HardHat size={36} color="#1E88E5" />
                      </div>
                  }
                </div>

                {/* Info */}
                <div style={{ padding: '16px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{e.name}</div>
                  <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#E3F2FD', color: '#1565C0', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                    {e.role}
                  </div>
                  {e.bio && (
                    <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0', lineHeight: 1.6 }}>{e.bio}</p>
                  )}
                  {e.phone && (
                    <a href={`tel:${e.phone.replace(/[^+\d]/g, '')}`}
                      style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8, background: '#1E88E5', color: '#fff', borderRadius: 10, padding: '10px 14px', textDecoration: 'none', fontWeight: 700, fontSize: 13, transition: 'background .15s' }}
                      onMouseEnter={ev => ev.currentTarget.style.background='#1565C0'}
                      onMouseLeave={ev => ev.currentTarget.style.background='#1E88E5'}>
                      <Phone size={14} /> {e.phone}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </CustomerLayout>
  );
}
