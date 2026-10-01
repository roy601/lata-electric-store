-- ════════════════════════════════════════════════════════════════════
-- Phase 0 · Migration 2 — lock down browser (anon key) access
--
-- ⚠ Apply ONLY AFTER the new server (Render) and client (Vercel) are
--   deployed. Before that, the old admin panel still writes through the
--   anon key and would stop working.
--
-- After this migration the public anon key can only:
--   • read catalogue tables (products, categories, subcategories,
--     banners, electricians, settings)
--   • read approved reviews, and insert a review as the signed-in customer
-- Orders, coupons and admins are reachable only through the Express API
-- (service_role). Storage uploads also go through the API.
-- ════════════════════════════════════════════════════════════════════

-- 1. Drop every existing policy on these tables (they were created ad hoc
--    in the dashboard, so their names are unknown).
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('products','categories','subcategories','banners','electricians',
                         'settings','reviews','orders','coupons','admins')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2. RLS on everywhere
alter table public.products      enable row level security;
alter table public.categories    enable row level security;
alter table public.subcategories enable row level security;
alter table public.banners       enable row level security;
alter table public.electricians  enable row level security;
alter table public.settings      enable row level security;
alter table public.reviews       enable row level security;
alter table public.orders        enable row level security;
alter table public.coupons       enable row level security;
alter table public.admins        enable row level security;

-- 3. Belt and braces: no browser writes at the grant level either
revoke insert, update, delete on
  public.products, public.categories, public.subcategories, public.banners,
  public.electricians, public.settings, public.orders, public.coupons, public.admins
from anon, authenticated;
revoke select on public.orders, public.coupons, public.admins from anon, authenticated;
revoke update, delete on public.reviews from anon, authenticated;
revoke insert on public.reviews from anon;

-- 4. Public read of the catalogue (same data the storefront reads today)
create policy catalogue_read on public.products      for select to anon, authenticated using (true);
create policy catalogue_read on public.categories    for select to anon, authenticated using (true);
create policy catalogue_read on public.subcategories for select to anon, authenticated using (true);
create policy catalogue_read on public.banners       for select to anon, authenticated using (true);
create policy catalogue_read on public.electricians  for select to anon, authenticated using (true);
create policy catalogue_read on public.settings      for select to anon, authenticated using (true);

-- 5. Reviews: anyone reads approved ones; signed-in customers add their own,
--    always unapproved.
create policy reviews_read_approved on public.reviews
  for select to anon, authenticated using (is_approved = true);
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (user_id = auth.uid() and coalesce(is_approved, false) = false);

-- orders / coupons / admins: no policies → no browser access at all.

-- 6. Storage: remove browser write policies. Public buckets stay readable
--    through their public URLs; uploads go through POST /api/uploads/image.
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and cmd in ('INSERT','UPDATE','DELETE','ALL')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;
