# Database migrations

Run each file in **Supabase Dashboard → SQL Editor**, in filename order, following the deploy steps below.

## Phase 0 deploy order (secure data access)

The order matters. Locking the database before the new code is live would break the admin panel.

1. **Run `migrations/20260930_01_orders_atomic.sql`.**
   It is additive only: new order columns and two functions. The live site keeps working.
2. **Deploy the server** (Render) from the `phase0-secure-data-access` branch.
3. **Deploy the client** (Vercel) from the same branch.
4. **Check the live site.** Log in to `/admin` and open every page. Place a test order, then track it with its order ID and phone number.
5. **Run `migrations/20260930_02_lock_rls.sql`.**
   After this, the public anon key can only read catalogue data. Orders, coupons and admins become reachable only through the API.
6. **Re-check.** The storefront, checkout, order tracking, the Account page and every admin page should still work.

### Rolling back step 5

In the SQL Editor, run `alter table public.<table> disable row level security;` for the affected table. This restores open access, so treat it as temporary.
