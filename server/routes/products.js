const { crudRouter } = require('../utils/crudRouter');

// Admin-only. The storefront reads products directly (public read via RLS).
module.exports = crudRouter({
  table:  'products',
  select: '*, categories(name)',
  order:  [['id', false]],
  fields: [
    'name', 'slug', 'brand', 'sku', 'price', 'original_price', 'stock', 'description',
    'image', 'extra_images', 'category_id', 'subcategory_id', 'is_active',
    'specifications', 'variants',
    'featured', 'top_sell', 'trending', 'flash_sale', 'flash_price',
  ],
});
