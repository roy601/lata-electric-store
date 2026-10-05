const { crudRouter } = require('../utils/crudRouter');

// placement: 'slider' | 'side_wide' | 'side_small' (checked by the database, migration 06)
// link_url:  optional page path (/products?cat=13) or https:// link
module.exports = crudRouter({
  table:  'banners',
  fields: ['image', 'title', 'subtitle', 'product_id', 'sort_order', 'is_active', 'placement', 'link_url'],
});
