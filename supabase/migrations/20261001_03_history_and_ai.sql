-- ════════════════════════════════════════════════════════════════════
-- Migration 3 — business history + AI assistant storage
--
-- Additive only, safe to apply at any time (before or after deploying).
-- Run in Supabase Dashboard → SQL Editor.
--
--  • order_status_history  — every order status change, recorded by trigger
--  • inventory_movements   — every stock change with its reason, by trigger
--  • ai_conversations / ai_messages / ai_tool_calls / ai_usage
--      — assistant memory (per admin), audit trail and spend tracking
-- All new tables have RLS on and no policies: server (service_role) only.
-- ════════════════════════════════════════════════════════════════════


-- ── Order status history ────────────────────────────────────────────
create table if not exists public.order_status_history (
  id          bigserial primary key,
  order_id    int  not null references public.orders(id) on delete cascade,
  status      text not null,
  changed_at  timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, changed_at);

create or replace function public.log_order_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_status_history on public.orders;
create trigger orders_status_history
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Seed one row per existing order so history starts from today
insert into public.order_status_history (order_id, status, changed_at)
select o.id, o.status, coalesce(o.updated_at, o.created_at)
  from public.orders o
 where not exists (select 1 from public.order_status_history h where h.order_id = o.id);


-- ── Inventory movements ─────────────────────────────────────────────
-- reason comes from the transaction setting app.stock_reason, set by
-- create_order_atomic / process_return; anything else is an admin edit.
create table if not exists public.inventory_movements (
  id           bigserial primary key,
  product_id   int  not null references public.products(id) on delete cascade,
  change       int  not null,
  stock_after  int  not null,
  reason       text not null,
  created_at   timestamptz not null default now()
);
create index if not exists inventory_movements_product_idx on public.inventory_movements (product_id, created_at);

create or replace function public.log_stock_change()
returns trigger language plpgsql as $$
declare
  v_before int := case when tg_op = 'INSERT' then 0 else coalesce(old.stock, 0) end;
  v_after  int := coalesce(new.stock, 0);
begin
  if v_after <> v_before then
    insert into public.inventory_movements (product_id, change, stock_after, reason)
    values (new.id, v_after - v_before, v_after,
            coalesce(nullif(current_setting('app.stock_reason', true), ''),
                     case when tg_op = 'INSERT' then 'initial' else 'admin_edit' end));
  end if;
  return new;
end;
$$;

drop trigger if exists products_stock_movements on public.products;
create trigger products_stock_movements
  after insert or update of stock on public.products
  for each row execute function public.log_stock_change();

-- Same functions as migration 01, now tagging their stock changes.
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
    update products
       set stock = greatest(0, coalesce(stock, 0) - (v_item->>'qty')::int)
     where id = (v_item->>'id')::int;
  end loop;
  perform set_config('app.stock_reason', '', true);

  return p_order->>'order_id';
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

revoke all on function public.create_order_atomic(jsonb)  from public, anon, authenticated;
revoke all on function public.process_return(int, text)   from public, anon, authenticated;
grant execute on function public.create_order_atomic(jsonb) to service_role;
grant execute on function public.process_return(int, text)  to service_role;


-- ── AI assistant ────────────────────────────────────────────────────
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.admins(id) on delete cascade,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_conversations_admin_idx on public.ai_conversations (admin_id, updated_at desc);

-- One row per visible chat message. `data` holds the backend-computed
-- tables shown under an answer (numbers are never retyped by the model).
create table if not exists public.ai_messages (
  id               bigserial primary key,
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  data             jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, id);

create table if not exists public.ai_tool_calls (
  id               bigserial primary key,
  conversation_id  uuid references public.ai_conversations(id) on delete cascade,
  admin_id         uuid references public.admins(id) on delete set null,
  tool             text not null,
  input            jsonb,
  ok               boolean not null,
  error            text,
  duration_ms      int,
  created_at       timestamptz not null default now()
);
create index if not exists ai_tool_calls_created_idx on public.ai_tool_calls (created_at desc);

create table if not exists public.ai_usage (
  day            date not null,
  admin_id       uuid not null references public.admins(id) on delete cascade,
  requests       int    not null default 0,
  input_tokens   bigint not null default 0,
  output_tokens  bigint not null default 0,
  primary key (day, admin_id)
);

-- Atomic usage counter (called by the server after each model call)
create or replace function public.ai_record_usage(p_admin uuid, p_in bigint, p_out bigint)
returns void language sql security definer set search_path = public as $$
  insert into ai_usage (day, admin_id, requests, input_tokens, output_tokens)
  values ((now() at time zone 'Asia/Dhaka')::date, p_admin, 1, p_in, p_out)
  on conflict (day, admin_id) do update
    set requests      = ai_usage.requests + 1,
        input_tokens  = ai_usage.input_tokens + excluded.input_tokens,
        output_tokens = ai_usage.output_tokens + excluded.output_tokens;
$$;
revoke all on function public.ai_record_usage(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.ai_record_usage(uuid, bigint, bigint) to service_role;

alter table public.order_status_history enable row level security;
alter table public.inventory_movements  enable row level security;
alter table public.ai_conversations     enable row level security;
alter table public.ai_messages          enable row level security;
alter table public.ai_tool_calls        enable row level security;
alter table public.ai_usage             enable row level security;
