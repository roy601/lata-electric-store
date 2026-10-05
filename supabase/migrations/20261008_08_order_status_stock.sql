-- ════════════════════════════════════════════════════════════════════
-- Migration 08 — order status changes keep stock right
--
-- Before: stock was taken when an order was placed and only "Process return"
-- gave it back, so cancelling an order left those units missing from stock.
--
-- set_order_status(p_id, p_status) changes the status and, in the same
-- transaction:
--   • open → cancelled / returned   puts the items back in stock
--   • cancelled / returned → open   takes them out again (refuses if there
--                                   is not enough stock: INSUFFICIENT_STOCK)
-- Each change is logged in inventory_movements as cancel:/return:/reopen:<order>.
--
-- process_return now refuses cancelled orders (their stock is already back).
-- Safe to run more than once. Existing cancelled orders are NOT changed.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.set_order_status(p_id int, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items    jsonb;
  v_old      text;
  v_order_id text;
  v_item     jsonb;
  v_qty      int;
  v_stock    int;
  v_was_open boolean;
  v_now_open boolean;
begin
  if p_status not in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select items, status, order_id into v_items, v_old, v_order_id from orders where id = p_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_old = p_status then
    return v_old;
  end if;

  v_was_open := v_old not in ('cancelled', 'returned');
  v_now_open := p_status not in ('cancelled', 'returned');

  if v_was_open and not v_now_open then
    -- give the items back
    perform set_config('app.stock_reason', (case when p_status = 'cancelled' then 'cancel:' else 'return:' end) || v_order_id, true);
    for v_item in select * from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) loop
      update products set stock = coalesce(stock, 0) + (v_item->>'qty')::int
       where id = (v_item->>'id')::int;
    end loop;
  elsif not v_was_open and v_now_open then
    -- reopening: take the items out again, only if they are all available
    perform set_config('app.stock_reason', 'reopen:' || v_order_id, true);
    for v_item in select * from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) loop
      v_qty := (v_item->>'qty')::int;
      select coalesce(stock, 0) into v_stock from products where id = (v_item->>'id')::int for update;
      if not found then
        continue;  -- product was deleted; nothing to take
      end if;
      if v_stock < v_qty then
        raise exception 'INSUFFICIENT_STOCK:%', coalesce(v_item->>'name', v_item->>'id') using errcode = 'P0001';
      end if;
      update products set stock = v_stock - v_qty where id = (v_item->>'id')::int;
    end loop;
  end if;
  perform set_config('app.stock_reason', '', true);

  update orders set status = p_status where id = p_id;
  return v_old;
end;
$$;

create or replace function public.process_return(p_id int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items    jsonb;
  v_status   text;
  v_order_id text;
  v_item     jsonb;
begin
  select items, status, order_id into v_items, v_status, v_order_id from orders where id = p_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status = 'returned' then
    raise exception 'ALREADY_RETURNED' using errcode = 'P0001';
  end if;
  if v_status = 'cancelled' then
    raise exception 'ORDER_CANCELLED' using errcode = 'P0001';
  end if;

  update orders set status = 'returned', return_reason = nullif(p_reason, '') where id = p_id;

  perform set_config('app.stock_reason', 'return:' || v_order_id, true);
  for v_item in select * from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) loop
    update products
       set stock = coalesce(stock, 0) + (v_item->>'qty')::int
     where id = (v_item->>'id')::int;
  end loop;
  perform set_config('app.stock_reason', '', true);
end;
$$;

revoke all on function public.set_order_status(int, text) from public, anon, authenticated;
revoke all on function public.process_return(int, text)   from public, anon, authenticated;
grant execute on function public.set_order_status(int, text) to service_role;
grant execute on function public.process_return(int, text)   to service_role;

notify pgrst, 'reload schema';
