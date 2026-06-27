import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import ProductCard from '../../components/ProductCard';
import { supabase } from '../../lib/supabase';

export default function CategoryPage() {
  const { id } = useParams();
  const [category,  setCategory]  = useState(null);
  const [products,  setProducts]  = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [sort,      setSort]      = useState('newest');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [cRes, pRes, allCRes] = await Promise.all([
        supabase.from('categories').select('*').eq('id', id).single(),
        supabase.from('products').select('*').eq('category_id', id).eq('is_active', true),
        supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
      ]);
      setCategory(cRes.data);
      setProducts(pRes.data || []);
      setCategories(allCRes.data || []);
      setLoading(false);
    };
    load();
    setSearch('');
  }, [id]);

  const filtered = products
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'price_asc')  return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      return new Date(b.created_at) - new Date(a.created_at);
    });

  return (
    <CustomerLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: '#9aa5b1', marginBottom: 20 }}>
          <Link to="/" style={{ color: '#9aa5b1', textDecoration: 'none' }}>Home</Link> &rsaquo;&nbsp;
          <Link to="/products" style={{ color: '#9aa5b1', textDecoration: 'none' }}>Products</Link> &rsaquo;&nbsp;
          <span style={{ color: '#212529' }}>{category?.name || 'Category'}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Sidebar */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)', position: 'sticky', top: 80 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#212529', fontSize: 14 }}>Categories</div>
            {categories.map(c => (
              <Link key={c.id} to={`/category/${c.id}`} style={{
                display: 'block', padding: '8px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 13, marginBottom: 2,
                background: String(c.id) === id ? '#1E88E5' : 'transparent',
                color:      String(c.id) === id ? '#fff'    : '#555',
                fontWeight: String(c.id) === id ? 600       : 400,
              }}>
                {c.name}
              </Link>
            ))}
          </div>

          {/* Products */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#212529' }}>
                {category?.name || 'Category'} <span style={{ fontSize: 15, fontWeight: 400, color: '#9aa5b1' }}>({filtered.length})</span>
              </h1>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, width: 160 }} />
                <select value={sort} onChange={e => setSort(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13 }}>
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#9aa5b1' }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#9aa5b1' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Package size={48} color="#ccc" /></div>
                No products in this category yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                {filtered.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
