const express      = require('express');
const { supabase } = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');

/** Keep only whitelisted keys that were actually sent. */
const pick = (obj = {}, keys) =>
  Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

/** Readable message for database errors (e.g. a duplicate SKU). */
const dbMessage = (error) => {
  if (error?.code === '23505') {
    return /sku/i.test(`${error.message} ${error.details || ''}`)
      ? 'This SKU is already used by another product. Each product needs its own SKU.'
      : 'This value already exists.';
  }
  return error?.message || 'Database error';
};

const validId = (req, res, next) =>
  /^\d+$/.test(req.params.id) ? next() : res.status(400).json({ success: false, message: 'Invalid id.' });

/**
 * Admin-only CRUD router for a simple table.
 *   table    – table name
 *   fields   – columns the admin may write (everything else is ignored)
 *   select   – select() expression for reads
 *   order    – [[column, ascending], …]
 *   filters  – query-string params allowed as equality filters (e.g. category_id)
 *   key      – response key for lists (defaults to table name)
 *   list     – optional handler that replaces the default GET / (e.g. paging)
 */
const crudRouter = ({ table, fields, select = '*', order = [['sort_order', true]], filters = [], key = table, list }) => {
  const router = express.Router();
  router.use(protect, authorize('admin', 'super_admin'));

  router.get('/', list || (async (req, res) => {
    let q = supabase.from(table).select(select);
    filters.forEach(f => { if (req.query[f] !== undefined) q = q.eq(f, req.query[f]); });
    order.forEach(([col, ascending]) => { q = q.order(col, { ascending }); });
    const { data, error } = await q;
    if (error) return res.status(400).json({ success: false, message: dbMessage(error) });
    res.json({ success: true, [key]: data });
  }));

  router.post('/', async (req, res) => {
    const { data, error } = await supabase.from(table).insert(pick(req.body, fields)).select(select).single();
    if (error) return res.status(400).json({ success: false, message: dbMessage(error) });
    res.status(201).json({ success: true, item: data });
  });

  // PUT and PATCH both do a partial update of whitelisted fields
  const update = async (req, res) => {
    const payload = pick(req.body, fields);
    if (!Object.keys(payload).length) return res.status(400).json({ success: false, message: 'Nothing to update.' });
    const { data, error } = await supabase.from(table).update(payload).eq('id', req.params.id).select(select).maybeSingle();
    if (error) return res.status(400).json({ success: false, message: dbMessage(error) });
    if (!data)  return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, item: data });
  };
  router.put('/:id',   validId, update);
  router.patch('/:id', validId, update);

  router.delete('/:id', validId, async (req, res) => {
    const { error } = await supabase.from(table).delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, message: dbMessage(error) });
    res.json({ success: true });
  });

  return router;
};

module.exports = { crudRouter, pick, validId, dbMessage };
