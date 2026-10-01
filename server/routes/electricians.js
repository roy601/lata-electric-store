const { crudRouter } = require('../utils/crudRouter');

module.exports = crudRouter({
  table:  'electricians',
  order:  [['sort_order', true], ['id', true]],
  fields: ['name', 'role', 'phone', 'image', 'bio', 'sort_order', 'is_active'],
});
