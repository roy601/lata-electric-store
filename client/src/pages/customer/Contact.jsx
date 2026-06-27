import { useState } from 'react';
import { MapPin, Phone, Clock, Calendar, MessageCircle, CheckCircle2 } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import toast from 'react-hot-toast';

export default function Contact() {
  const [form, setForm]   = useState({ name: '', phone: '', message: '' });
  const [sent, setSent]   = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.message) { toast.error('Please fill all fields'); return; }
    // In production this would send to an API or WhatsApp
    setSent(true);
    toast.success('Message sent! We will contact you shortly.');
  };

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#212529', marginBottom: 32 }}>Contact Us</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Info */}
          <div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 20px', fontWeight: 700 }}>Get in Touch</h3>
              {[
                { Icon: MapPin,   label: 'Address', value: 'Ka/6 Nadda, Gulshan, Dhaka-1212' },
                { Icon: Phone,    label: 'Phone',   value: '01700-000000' },
                { Icon: Clock,    label: 'Hours',   value: 'Sat–Thu: 9am – 8pm' },
                { Icon: Calendar, label: 'Closed',  value: 'Friday' },
              ].map(({ Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, marginTop: 2 }}><Icon size={20} color="#1E88E5" /></span>
                  <div>
                    <div style={{ fontSize: 12, color: '#9aa5b1', marginBottom: 2 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#212529', borderRadius: 12, padding: 24, color: '#fff' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Quick Contact via WhatsApp</div>
              <a
                href="https://wa.me/8801700000000"
                target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#25d366', color: '#fff', textDecoration: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
              >
                <MessageCircle size={16} /> Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Form */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 700 }}>Send a Message</h3>

            {sent ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={48} color="#28A745" /></div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Message Sent!</div>
                <div style={{ color: '#9aa5b1', fontSize: 14 }}>We'll get back to you on your phone number.</div>
                <button onClick={() => { setSent(false); setForm({ name: '', phone: '', message: '' }); }}
                  style={{ marginTop: 20, padding: '9px 20px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {[
                  { key: 'name',  label: 'Your Name *',     placeholder: 'Full name' },
                  { key: 'phone', label: 'Phone Number *',  placeholder: '01XXXXXXXXX', type: 'tel' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</label>
                    <input type={type || 'text'} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Message *</label>
                  <textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="How can we help you?"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" style={{ width: '100%', padding: '12px', background: '#1E88E5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
