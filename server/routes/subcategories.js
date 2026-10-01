const { crudRouter } = require('../utils/crudRouter');

module.exports = crudRouter({
  table:   'subcategories',
  filters: ['category_id'],
  fields:  ['category_id', 'header', 'items', 'sort_order'],
});
