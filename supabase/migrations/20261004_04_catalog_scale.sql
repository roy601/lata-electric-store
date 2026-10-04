-- ════════════════════════════════════════════════════════════════════
-- Migration 04 — large catalogues, bulk import history, safe stock
--
-- Run BEFORE deploying the matching server and client: the new storefront
-- reads `effective_price` and calls the functions below.
-- Everything here is additive and safe to run more than once.
--
--   1. products.effective_price  — the price customers actually pay
--      (flash price when on flash sale). Lets the shop filter/sort by
--      price on the server instead of downloading every product.
--   2. Fast search indexes (pg_trgm) for name / brand / SKU.
--   3. Unique SKUs (skipped with a NOTICE if duplicates exist today).
--   4. Small read functions for the shop: category counts, brand list,
--      home-page product sections.
--   5. product_imports / product_import_items — Excel import history,
--      progress and undo.
--   6. create_order_atomic now refuses to sell more than is in stock,
--      even when two customers buy the last item at the same moment.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Effective price ───────────────────────────────────────────────
alter table public.products
  add column if not exists effective_price numeric
  generated always as (
    case when flash_sale and coalesce(flash_price, 0) > 0 then flash_price else price end
  ) stored;

create index if not exists products_active_cat_idx   on public.products (is_active, category_id);
create index if not exists products_effective_price_idx on public.products (effective_price);
create index if not exists products_created_idx       on public.products (created_at desc);
create index if not exists products_flags_idx         on public.products (is_active, flash_sale, featured, top_sell, trending);

-- ── 2. Search ────────────────────────────────────────────────────────
create extension if not exists pg_trgm with schema extensions;
do $$
declare s text;  -- pg_trgm may already live in "public" on older projects
begin
  select n.nspname into s from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format('create index if not exists products_name_trgm  on public.products using gin (name  %I.gin_trgm_ops)', s);
  execute format('create index if not exists products_brand_trgm on public.products using gin (brand %I.gin_trgm_ops)', s);
  execute format('create index if not exists products_sku_trgm   on public.products using gin (sku   %I.gin_trgm_ops)', s);
end $$;

-- ── 3. Unique SKU (case-insensitive, empty SKUs allowed) ─────────────
do $$
declare v_dupes text;
begin
  select string_agg(format('"%s" (ids %s)', k, ids), ', ')
    into v_dupes
    from (select lower(trim(sku)) k, string_agg(id::text, ',') ids
            from public.products
           where coalesce(trim(sku), '') <> ''
           group by 1 having count(*) > 1) d;
  if v_dupes is null then
    create unique index if not exists products_sku_unique
      on public.products (lower(trim(sku))) where coalesce(trim(sku), '') <> '';
  else
    raise notice 'Unique SKU index NOT created — fix these duplicate SKUs in Admin, then run this file again: %', v_dupes;
  end if;
end $$;

-- ── 4. Read functions for the shop ───────────────────────────────────
-- Product count per category (active products only unless asked)
create or replace function public.category_product_counts(p_active_only boolean default true)
returns table (category_id int, total bigint)
language sql stable security invoker set search_path = public as $$
  select category_id, count(*) from products
   where category_id is not null and (not p_active_only or is_active)
   group by category_id
$$;

-- Distinct brands of active products
create or replace function public.product_brands()
returns table (brand text)
language sql stable security invoker set search_path = public as $$
  select distinct trim(brand) from products
   where is_active and coalesce(trim(brand), '') <> ''
   order by 1
$$;

-- Newest N active products of every category (home page sections)
create or replace function public.home_category_products(p_per_cat int default 10)
returns setof public.products
language sql stable security invoker set search_path = public as $$
  select (x.p).* from (
    select p, row_number() over (partition by p.category_id order by p.created_at desc, p.id desc) rn
      from products p
     where p.is_active and p.category_id is not null
  ) x
  where x.rn <= least(greatest(p_per_cat, 1), 30)
$$;

grant execute on function public.category_product_counts(boolean) to anon, authenticated, service_role;
grant execute on function public.product_brands()                 to anon, authenticated, service_role;
grant execute on function public.home_category_products(int)      to anon, authenticated, service_role;

-- ── 5. Import history ────────────────────────────────────────────────
create table if not exists public.product_imports (
  id           bigserial primary key,
  admin_id     uuid references public.admins(id) on delete set null,
  file_name    text,
  status       text not null default 'running'
               check (status in ('running', 'done', 'failed', 'interrupted', 'undone')),
  total        int  not null default 0,
  processed    int  not null default 0,
  added        int  not null default 0,
  updated      int  not null default 0,
  failed       int  not null default 0,
  errors       jsonb not null default '[]'::jsonb,   -- [{ row, name, error }]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  finished_at  timestamptz,
  undone_at    timestamptz
);
create index if not exists product_imports_created_idx on public.product_imports (created_at desc);

-- One row per product the import touched; `before` = the values it replaced (updates only)
create table if not exists public.product_import_items (
  id          bigserial primary key,
  import_id   bigint not null references public.product_imports(id) on delete cascade,
  product_id  int    not null,
  action      text   not null check (action in ('added', 'updated')),
  before      jsonb
);
create index if not exists product_import_items_import_idx on public.product_import_items (import_id);

alter table public.product_imports      enable row level security;
alter table public.product_import_items enable row level security;
revoke all on public.product_imports, public.product_import_items from anon, authenticated;
-- no policies → only the server (service_role) can use them

-- ── 6. Orders never oversell ─────────────────────────────────────────
create or replace function public.create_order_atomic(p_order jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   jsonb;
  v_code   text := nullif(p_order->>'coupon_code', '');
  v_rows   int;
begin
  if v_code is not null then
    update coupons
       set used_count = coalesce(used_count, 0) + 1
     where code = v_code
       and is_active
       and (nullif(usage_limit, 0) is null or coalesce(used_count, 0) < usage_limit);
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'COUPON_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;

  insert into orders (
    order_id, customer_name, customer_phone, customer_address,
    customer_city, customer_district, customer_email, notes,
    items, subtotal, delivery_charge, coupon_code, coupon_discount, total,
    payment_method, transaction_id, status, payment_paid
  ) values (
    p_order->>'order_id', p_order->>'customer_name', p_order->>'customer_phone', p_order->>'customer_address',
    p_order->>'customer_city', p_order->>'customer_district', nullif(p_order->>'customer_email', ''), nullif(p_order->>'notes', ''),
    p_order->'items', (p_order->>'subtotal')::numeric, (p_order->>'delivery_charge')::numeric,
    v_code, coalesce((p_order->>'coupon_discount')::numeric, 0), (p_order->>'total')::numeric,
    p_order->>'payment_method', nullif(p_order->>'transaction_id', ''), 'pending', false
  );

  perform set_config('app.stock_reason', 'order:' || (p_order->>'order_id'), true);
  for v_item in select * from jsonb_array_elements(p_order->'items') loop
    -- Row lock + check in one statement: two buyers can't both take the last unit
    update products
       set stock = coalesce(stock, 0) - (v_item->>'qty')::int
     where id = (v_item->>'id')::int
       and coalesce(stock, 0) >= (v_item->>'qty')::int;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'OUT_OF_STOCK:%', v_item->>'name' using errcode = 'P0001';
    end if;
  end loop;
  perform set_config('app.stock_reason', '', true);

  return p_order->>'order_id';
end;
$$;

revoke all on function public.create_order_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.create_order_atomic(jsonb) to service_role;

-- Make PostgREST pick up the new column and functions right away
notify pgrst, 'reload schema';
