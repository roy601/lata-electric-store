const { crudRouter } = require('../utils/crudRouter');

module.exports = crudRouter({
  table:  'banners',
  fields: ['image', 'title', 'subtitle', 'product_id', 'sort_order', 'is_active'],
});
