import { Navigate, useParams } from 'react-router-dom';

// Old category links (/category/:id) now open the products page filtered to
// that category, which loads products page by page from the database.
export default function CategoryPage() {
  const { id } = useParams();
  return <Navigate to={/^\d+$/.test(id) ? `/products?cat=${id}` : '/products'} replace />;
}
