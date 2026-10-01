-- ════════════════════════════════════════════════════════════════════
-- Phase 0 · Migration 1 — order columns + atomic order/return functions
--
-- Safe to apply BEFORE deploying the new server: it only adds columns
-- and functions, nothing existing is changed or removed.
-- Run in Supabase Dashboard → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- Columns the checkout already sends but the table never had
alter table public.orders add column if not exists customer_email  text;
alter table public.orders add column if not exists coupon_code     text;
alter table public.orders add column if not exists coupon_discount numeric not null default 0;

create index if not exists orders_customer_email_idx on public.orders (customer_email);   -- stored lowercased by the server
create index if not exists orders_customer_phone_idx on public.orders (customer_phone);
create index if not exists orders_created_at_idx     on public.orders (created_at desc);


-- ── create_order_atomic ─────────────────────────────────────────────
-- Prices/totals are computed and validated by the Express server
-- (server/services/orderPricing.js). This function makes the writes
-- atomic: order insert + stock decrement + coupon usage succeed or fail
-- together, and product rows are locked so concurrent orders can't race.
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
  -- Coupon usage: increment only if still under the limit (race-safe)
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

  -- Same behaviour as before: stock never goes below 0
  for v_item in select * from jsonb_array_elements(p_order->'items') loop
    update products
       set stock = greatest(0, coalesce(stock, 0) - (v_item->>'qty')::int)
     where id = (v_item->>'id')::int;
  end loop;

  return p_order->>'order_id';
end;
$$;


-- ── process_return ──────────────────────────────────────────────────
-- Marks an order returned and restocks its items in one transaction.
-- Refuses to run twice on the same order (the old code could restock twice).
create or replace function public.process_return(p_id int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items  jsonb;
  v_status text;
  v_item   jsonb;
begin
  select items, status into v_items, v_status from orders where id = p_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status = 'returned' then
    raise exception 'ALREADY_RETURNED' using errcode = 'P0001';
  end if;

  update orders set status = 'returned', return_reason = nullif(p_reason, '') where id = p_id;

  for v_item in select * from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) loop
    update products
       set stock = coalesce(stock, 0) + (v_item->>'qty')::int
     where id = (v_item->>'id')::int;
  end loop;
end;
$$;

-- Only the server (service_role) may call these
revoke all on function public.create_order_atomic(jsonb)  from public, anon, authenticated;
revoke all on function public.process_return(int, text)   from public, anon, authenticated;
grant execute on function public.create_order_atomic(jsonb) to service_role;
grant execute on function public.process_return(int, text)  to service_role;
