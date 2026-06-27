import { useEffect, useState } from 'react';
import { Palette, Store, Home as HomeIcon, MapPin, Smartphone, Lock, Zap, FolderOpen, CheckCircle2 } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { changePassword as apiChangePassword } from '../../api/authApi';
import toast from 'react-hot-toast';
import { compressImage } from '../../lib/compressImage';

export default function AdminSettings() {
  const { admin } = useAuth();
  const [s, setS]               = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [tab, setTab]           = useState('brand');
  const [pwForm, setPwForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => { setS(data || {}); setLoading(false); });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').upsert({
      id:               1,
      logo_url:         s.logo_url,
      logo_bg_color:    s.logo_bg_color || '#1E88E5',
      store_name_bn:    s.store_name_bn,
      store_tagline:    s.store_tagline,
      site_name:        s.site_name,
      phone:            s.phone,
      email:            s.email,
      address:          s.address,
      hours:            s.hours,
      hero_title:       s.hero_title,
      hero_subtitle:    s.hero_subtitle,
      announcement_bar: s.announcement_bar,
      facebook:         s.facebook,
      whatsapp:         s.whatsapp,
      youtube:          s.youtube,
      map_url:          s.map_url,
      map_embed_src:    s.map_embed_src,
    }, { onConflict: 'id' });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Settings saved');
  };

  const changePw = async () => {
    if (pwForm.newPassword !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setPwSaving(true);
    try {
      await apiChangePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed — please log in again');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setPwSaving(false); }
  };

  const f = (key, label, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>{label}</label>
      <input type={type} value={s?.[key] || ''} onChange={e => setS(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
    </div>
  );

  const [logoUploading, setLogoUploading] = useState(false);

  const uploadLogo = async (file) => {
    if (!file) return;
    setLogoUploading(true);
    const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.9 });
    const ext  = compressed.name.split('.').pop();
    const path = `logo_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('logos').upload(path, compressed, { upsert: true });
    if (upErr) { toast.error('Upload failed: ' + upErr.message); setLogoUploading(false); return; }
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    setS(p => ({ ...p, logo_url: data.publicUrl }));
    toast.success('Logo uploaded');
    setLogoUploading(false);
  };

  const TABS = [
    { id: 'brand',    Icon: Palette,     label: 'Brand & Logo' },
    { id: 'store',    Icon: Store,       label: 'Store Info' },
    { id: 'homepage', Icon: HomeIcon,    label: 'Homepage' },
    { id: 'location', Icon: MapPin,      label: 'Location' },
    { id: 'social',   Icon: Smartphone,  label: 'Social' },
    { id: 'password', Icon: Lock,        label: 'Password' },
  ];

  if (loading) return <AdminLayout title="Settings"><div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div></AdminLayout>;

  return (
    <AdminLayout title="Settings">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#fff', padding: 6, borderRadius: 10, width: 'fit-content', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t.id ? '#1E88E5' : 'transparent',
            color:      tab === t.id ? '#fff'    : '#555',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 560 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>

          {tab === 'brand' && <>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Brand & Logo</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9aa5b1' }}>Controls the logo shown in the store header.</p>

            {/* Live preview */}
            <div style={{ marginBottom: 22, padding: '14px 18px', background: '#F8F9FA', borderRadius: 10, border: '1px solid #e8ecf0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Live Preview</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', padding: '10px 16px', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                {/* Logo box */}
                <div style={{ width: 44, height: 44, background: s?.logo_bg_color || '#1E88E5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {s?.logo_url
                    ? <img src={s.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                    : <Zap size={22} color="#fff" fill="#fff" />}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#212529', lineHeight: 1.1 }}>{s?.store_name_bn || 'লতা ইলেকট্রিক'}</div>
                  <div style={{ fontSize: 11, color: '#9aa5b1' }}>{s?.store_tagline || 'Lata Electric'}</div>
                </div>
              </div>
            </div>

            {/* Logo upload */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8 }}>LOGO IMAGE</label>

              {s?.logo_url && (
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 60, height: 60, background: s?.logo_bg_color || '#1E88E5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={s.logo_url} alt="Current logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#28A745', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Logo set</div>
                    <button onClick={() => setS(p => ({ ...p, logo_url: '' }))}
                      style={{ fontSize: 11, color: '#1E88E5', background: 'none', border: '1px solid #1E88E5', borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }}>
                      Remove Logo
                    </button>
                  </div>
                </div>
              )}

              {/* File upload */}
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #e0e0e0', borderRadius: 10, padding: '20px', cursor: 'pointer', background: '#fafafa', transition: 'border-color .2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='#1E88E5'}
                onMouseLeave={e => e.currentTarget.style.borderColor='#e0e0e0'}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadLogo(e.target.files[0])} />
                {logoUploading
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9aa5b1', fontSize: 13 }}><span>Uploading…</span></div>
                  : <>
                    <FolderOpen size={28} color="#9aa5b1" style={{ marginBottom: 6 }} />
                    <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Click to upload logo</span>
                    <span style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>PNG, JPG, SVG — max 2MB. Transparent PNG works best.</span>
                  </>}
              </label>

              {/* Or URL input */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginBottom: 6 }}>— or paste image URL —</div>
                <input value={s?.logo_url || ''} onChange={e => setS(p => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor='#1E88E5'}
                  onBlur={e => e.target.style.borderColor='#e0e0e0'}
                />
              </div>
            </div>

            {/* Logo background color */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8 }}>LOGO BACKGROUND COLOR</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={s?.logo_bg_color || '#1E88E5'} onChange={e => setS(p => ({ ...p, logo_bg_color: e.target.value }))}
                  style={{ width: 44, height: 44, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                <input value={s?.logo_bg_color || '#1E88E5'} onChange={e => setS(p => ({ ...p, logo_bg_color: e.target.value }))}
                  placeholder="#1E88E5"
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                <button onClick={() => setS(p => ({ ...p, logo_bg_color: '#1E88E5' }))}
                  style={{ padding: '8px 12px', background: '#F8F9FA', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#555' }}>
                  Reset
                </button>
              </div>
            </div>

            {/* Store name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>STORE NAME (BENGALI)</label>
              <input value={s?.store_name_bn || ''} onChange={e => setS(p => ({ ...p, store_name_bn: e.target.value }))}
                placeholder="লতা ইলেকট্রিক"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => e.target.style.borderColor='#1E88E5'}
                onBlur={e => e.target.style.borderColor='#e0e0e0'}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>STORE TAGLINE (ENGLISH)</label>
              <input value={s?.store_tagline || ''} onChange={e => setS(p => ({ ...p, store_tagline: e.target.value }))}
                placeholder="Lata Electric"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => e.target.style.borderColor='#1E88E5'}
                onBlur={e => e.target.style.borderColor='#e0e0e0'}
              />
            </div>
          </>}

          {tab === 'store' && <>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Store Information</h3>
            {f('site_name', 'Store Name')}
            {f('phone', 'Phone Number', 'tel', '01700-000000')}
            {f('email', 'Email', 'email', 'info@lataelectric.com')}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>Address</label>
              <textarea rows={2} value={s.address || ''} onChange={e => setS(p => ({ ...p, address: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            {f('hours', 'Business Hours', 'text', 'Sat–Thu: 9am – 8pm')}
          </>}

          {tab === 'homepage' && <>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Homepage Content</h3>
            {f('hero_title', 'Hero Title', 'text', 'Your Trusted Electrical Store')}
            {f('hero_subtitle', 'Hero Subtitle')}
            {f('announcement_bar', 'Announcement Bar', 'text', 'Free delivery on orders above ৳1000!')}
          </>}

          {tab === 'location' && <>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Shop Location</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9aa5b1' }}>Shown on the homepage so customers can find your shop.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>GOOGLE MAPS LINK</label>
              <input value={s?.map_url || ''} onChange={e => setS(p => ({ ...p, map_url: e.target.value }))}
                placeholder="https://maps.app.goo.gl/... or https://www.google.com/maps/place/..."
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => e.target.style.borderColor='#1E88E5'}
                onBlur={e => e.target.style.borderColor='#e0e0e0'}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>GOOGLE MAPS EMBED URL (optional — for live map preview)</label>
              <input value={s?.map_embed_src || ''} onChange={e => setS(p => ({ ...p, map_embed_src: e.target.value }))}
                placeholder="https://www.google.com/maps/embed?pb=..."
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => e.target.style.borderColor='#1E88E5'}
                onBlur={e => e.target.style.borderColor='#e0e0e0'}
              />
            </div>

            {s?.map_embed_src && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8 }}>MAP PREVIEW</div>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e0e0e0', height: 200 }}>
                  <iframe src={s.map_embed_src} width="100%" height="200" style={{ border: 0, display: 'block' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
              </div>
            )}

            {!s?.map_url && !s?.map_embed_src && (
              <div style={{ padding: '16px', background: '#fff3cd', borderRadius: 10, border: '1px solid #ffc107', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#856404', fontWeight: 600, marginBottom: 4 }}>How to get the links</div>
                <ol style={{ fontSize: 12, color: '#856404', margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                  <li>Open <strong>Google Maps</strong> on your phone or computer</li>
                  <li>Search for your shop name or address</li>
                  <li>Tap <strong>Share</strong> → copy the short link for "Google Maps Link"</li>
                  <li>Tap <strong>Share</strong> → <strong>Embed a map</strong> → copy the iframe <code>src</code> for "Embed URL"</li>
                </ol>
              </div>
            )}
          </>}

          {tab === 'social' && <>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Social Media</h3>
            {f('facebook', 'Facebook Page URL')}
            {f('whatsapp', 'WhatsApp Number', 'tel', '01700-000000')}
            {f('youtube', 'YouTube Channel URL')}
          </>}

          {tab === 'password' && <>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Change Password</h3>
            <div style={{ fontSize: 13, color: '#7f8c9a', marginBottom: 20 }}>Logged in as: {admin?.email}</div>
            {[
              { key: 'currentPassword', label: 'Current Password' },
              { key: 'newPassword',     label: 'New Password (min 8 chars)' },
              { key: 'confirm',         label: 'Confirm New Password' },
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#7f8c9a', marginBottom: 4 }}>{label}</label>
                <input type="password" value={pwForm[key]} onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <button onClick={changePw} disabled={pwSaving} style={{ padding: '9px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              {pwSaving ? 'Changing…' : 'Change Password'}
            </button>
            <p style={{ fontSize: 12, color: '#9aa5b1', marginTop: 8 }}>You will be logged out after changing the password.</p>
          </>}

          {tab !== 'password' && (
            <button onClick={save} disabled={saving} style={{ marginTop: 8, padding: '9px 24px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
