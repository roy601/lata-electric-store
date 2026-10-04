/**
 * Supabase (PostgREST) returns at most 1000 rows per request by default.
 * fetchAll pages through with .range() until everything is read.
 *   build – () => query builder (called once per page; must have a stable .order())
 */
const PAGE = 1000;
const fetchAll = async (build) => {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
};

module.exports = { fetchAll };
