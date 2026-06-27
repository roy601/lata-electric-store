import { Zap, CheckCircle2, Truck, CreditCard, Wrench } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';

export default function About() {
  return (
    <CustomerLayout>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#212529', marginBottom: 8 }}>About লতা ইলেকট্রিক</h1>
        <p style={{ color: '#9aa5b1', marginBottom: 36, fontSize: 15 }}>Your trusted electrical & hardware store in Gulshan, Dhaka</p>

        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(135deg, #212529, #1565C0)', padding: '40px 32px', color: '#fff' }}>
            <div style={{ marginBottom: 16 }}><Zap size={60} fill="currentColor" /></div>
            <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700 }}>লতা ইলেকট্রিক</h2>
            <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.7 }}>
              We are a dedicated electrical and hardware shop located in Ka/6 Nadda, Gulshan, Dhaka. We provide quality electrical products including cables, switches, fans, lights, and hardware accessories to homes and businesses across Dhaka.
            </p>
          </div>
          <div style={{ padding: '28px 32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { Icon: CheckCircle2, title: 'Genuine Products',   body: 'All products are 100% authentic from verified suppliers and brands.' },
                { Icon: Truck,        title: 'Fast Delivery',      body: 'Same day delivery inside Dhaka, 2–4 days outside Dhaka.' },
                { Icon: CreditCard,   title: 'Multiple Payments',  body: 'Pay with Cash on Delivery, bKash, or Nagad for your convenience.' },
                { Icon: Wrench,       title: 'Expert Assistance',  body: 'Our knowledgeable staff can help you find the right product.' },
              ].map(({ Icon, title, body }) => (
                <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, marginTop: 2 }}><Icon size={28} color="#1E88E5" /></span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#212529', marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: 700 }}>Visit Us</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
            <div>
              <div style={{ color: '#9aa5b1', fontSize: 12, marginBottom: 4 }}>ADDRESS</div>
              <div>Ka/6 Nadda, Gulshan<br />Dhaka-1212, Bangladesh</div>
            </div>
            <div>
              <div style={{ color: '#9aa5b1', fontSize: 12, marginBottom: 4 }}>PHONE</div>
              <div>01700-000000</div>
            </div>
            <div>
              <div style={{ color: '#9aa5b1', fontSize: 12, marginBottom: 4 }}>HOURS</div>
              <div>Saturday – Thursday<br />9:00 AM – 8:00 PM</div>
            </div>
            <div>
              <div style={{ color: '#9aa5b1', fontSize: 12, marginBottom: 4 }}>CLOSED</div>
              <div>Friday</div>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
