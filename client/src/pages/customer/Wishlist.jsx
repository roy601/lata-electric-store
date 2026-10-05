import { useEffect, useState } from 'react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/common/EmptyState';
import { useWishlistStore } from '../../store/cartStore';
import { supabase } from '../../lib/supabase';
import { useSeo } from '../../lib/seo';

export default function Wishlist() {
  useSeo({ title: 'My Wishlist', noindex: true });
  const { ids } = useWishlistStore();
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (ids.length === 0) { setProducts([]); setLoading(false); return; }
      const { data } = await supabase.from('products').select('*').in('id', ids).eq('is_active', true);
      setProducts(data || []);
      setLoading(false);
    };
    load();
  }, [ids]);

  if (loading) return <CustomerLayout><div style={{ padding: 60, textAlign: 'center', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>Loading…</div></CustomerLayout>;

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-212529, #212529)', marginBottom: 24 }}>My Wishlist ({products.length})</h1>

        {products.length === 0 ? (
          <EmptyState title="Nothing saved yet" text="Tap the heart on any product to keep it here for later." action="Browse products" to="/products" style={{ padding: '24px 0 56px' }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
