-- ════════════════════════════════════════════════════════════════════
-- Migration 05 — orders belong to customer accounts (no confirmation email)
--
-- Run AFTER migration 04 and BEFORE deploying the matching server.
-- Safe to run more than once.
--
-- Orders used to be matched to an account by email address, which only is
-- safe when every account's email has been confirmed. Now an order placed
-- while signed in stores the account's id, so customers can use their
-- account right after signing up — no "click the link in your email" step.
-- Older guest orders can be added to an account with order ID + phone.
-- ════════════════════════════════════════════════════════════════════

alter table public.orders
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_customer_user_idx on public.orders (customer_user_id, created_at desc);

-- Same as migration 04, plus customer_user_id
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
    payment_method, transaction_id, status, payment_paid, customer_user_id
  ) values (
    p_order->>'order_id', p_order->>'customer_name', p_order->>'customer_phone', p_order->>'customer_address',
    p_order->>'customer_city', p_order->>'customer_district', nullif(p_order->>'customer_email', ''), nullif(p_order->>'notes', ''),
    p_order->'items', (p_order->>'subtotal')::numeric, (p_order->>'delivery_charge')::numeric,
    v_code, coalesce((p_order->>'coupon_discount')::numeric, 0), (p_order->>'total')::numeric,
    p_order->>'payment_method', nullif(p_order->>'transaction_id', ''), 'pending', false,
    nullif(p_order->>'customer_user_id', '')::uuid
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

notify pgrst, 'reload schema';
