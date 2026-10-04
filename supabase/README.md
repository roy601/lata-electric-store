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

## Migration 03: history and AI assistant

Run `migrations/20261001_03_history_and_ai.sql` at any time. It only adds things:

- **`order_status_history` and `inventory_movements`.** Database triggers fill these automatically from now on.
- **The AI assistant's tables:** conversations, messages, tool-call audit and usage.

To switch the assistant on, use free AI providers. No credit card is needed.

1. Create free API keys:
   - **Cerebras:** https://cloud.cerebras.ai → API Keys. The free tier allows about 1M tokens/day.
   - **Groq:** https://console.groq.com → API Keys. The free tier allows about 200k tokens/day. It's used automatically when Cerebras is busy.
2. In Render → your service → Environment, add:
   ```
   CEREBRAS_API_KEY=csk-...
   GROQ_API_KEY=gsk_...
   ```
3. Save. Render redeploys automatically. Then open **Admin → AI Assistant**.

Optional: in the Groq Console → Data Controls, turn on **Zero Data Retention**.

Claude (paid) is still supported. Set `ANTHROPIC_API_KEY` only if you decide to use it.

### Rolling back step 5

In the SQL Editor, run `alter table public.<table> disable row level security;` for the affected table. This restores open access, so treat it as temporary.

## Migration 04: large catalogues and import history

`migrations/20261004_04_catalog_scale.sql` lets the shop handle thousands of products. It loads them page by page instead of all at once, which also avoids Supabase's 1,000-rows-per-request limit. The migration only adds things.

**Order matters: the new website needs this migration.**

1. **Run `migrations/20261004_04_catalog_scale.sql`** in the SQL Editor.
   - If it prints a **NOTICE about duplicate SKUs**, everything else was still applied. Only the unique-SKU rule was skipped. Fix the listed SKUs in Admin → Products, then run the file again.
2. **Deploy the server** (Render).
3. **Deploy the client** (Vercel).
4. **Check:**
   - The home page, All Products (filters, price sort, search) and the header search box work.
   - The menu shows product counts.
   - Admin → Products shows pages, and Import from Excel → History opens.

The migration adds:

- **`products.effective_price`:** the price customers pay (the flash price during a flash sale). It's used for filtering and sorting by price.
- **Search indexes** on product name, brand and SKU.
- **A unique SKU rule.** Capital letters don't count as different, and empty SKUs are allowed.
- **`category_product_counts`, `product_brands` and `home_category_products`:** small read functions used by the shop.
- **`product_imports` and `product_import_items`:** Excel import history, progress and undo. Only the server can read them.
- **A stock check in `create_order_atomic`:** when two customers buy the last unit at the same moment, only one order goes through. The other customer is asked to update their cart.

## Migration 05: orders belong to accounts (no confirmation email)

`migrations/20261004_05_orders_by_account.sql` adds `orders.customer_user_id`. An order placed while signed in is saved to that account, so customers can use their account the moment they sign up.

1. **Run migration 05** (after 04).
2. **Deploy the server, then the client.**
3. **In Supabase → Authentication → Sign In / Providers → Email**, turn **"Confirm email" OFF**. New accounts then work straight away.
4. **Turn on Google:** Authentication → Providers → Google. Paste the Client ID and secret from Google Cloud Console → APIs & Services → Credentials → OAuth client (type "Web application"). In Google Cloud, set the authorised redirect URI to the callback URL that Supabase shows on that page.
5. **In Authentication → URL Configuration:**
   - Set **Site URL** to your live domain.
   - Add `https://<domain>/account`, `https://<domain>/checkout` and `https://<domain>/reset-password` to **Redirect URLs**.
6. **Facebook (optional):** enable it the same way, then set `VITE_ENABLE_FACEBOOK=true` in Vercel and redeploy the client.

**How My Orders works now:**

- **Orders placed while signed in** show automatically.
- **Guest orders placed with the same email** show automatically only for people who sign in with **Google or Facebook**, because those services have verified the email.
- **Any other earlier order** can be added from My Orders with **"Add a past order"**, using the order ID and phone number. This is the same proof the tracking page asks for. It's limited to 10 tries per 15 minutes.
- **Before you deploy:** orders placed by signed-in customers *before this migration* were linked by email only. They show again once those customers sign in with Google or use "Add a past order".
