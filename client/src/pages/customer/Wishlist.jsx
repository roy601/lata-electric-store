import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductCard from '../../components/ProductCard';
import { useWishlistStore } from '../../store/cartStore';
import { supabase } from '../../lib/supabase';

export default function Wishlist() {
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

  if (loading) return <CustomerLayout><div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div></CustomerLayout>;

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#212529', marginBottom: 24 }}>My Wishlist ({products.length})</h1>

        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9aa5b1' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><Heart size={80} color="#bbb" /></div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Your wishlist is empty</div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>Save products you like to find them later.</div>
            <Link to="/products" style={{ padding: '12px 28px', background: '#1E88E5', color: '#fff', textDecoration: 'none', borderRadius: 8, fontWeight: 700 }}>Browse Products</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
