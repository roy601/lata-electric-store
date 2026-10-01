const { crudRouter } = require('../utils/crudRouter');

module.exports = crudRouter({
  table:  'categories',
  select: '*, products(count)',
  fields: ['name', 'slug', 'icon', 'color', 'is_active', 'sort_order'],
});
