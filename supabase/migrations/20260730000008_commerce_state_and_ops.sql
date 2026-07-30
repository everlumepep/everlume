-- Everlume platform · 0008 — three-machine order state, exceptions, inquiries,
-- and audited inventory adjustment.
--
-- Implements the FROZEN contract in docs/commerce/01-order-state-machine.md.
-- Vocabulary is taken verbatim from that contract and is authoritative:
-- `captured` (not `paid`), `none` (not `not_required`).
--
-- ADDITIVE, in the same spirit as 0007. The original `orders.status` column is
-- left in place and backfilled FROM, not dropped: an in-flight deployment must
-- not lose data because a column vanished. It is marked superseded and no new
-- code reads it.

-- ── 1. Three independent state machines ────────────────────────────────────
alter table public.orders
  add column if not exists commercial_status text not null default 'pending',
  add column if not exists payment_status text not null default 'none',
  add column if not exists fulfillment_status text not null default 'unfulfilled';

-- Backfill from the merged enum before constraining, so existing rows are
-- legal under the new model. The merged enum conflated commercial and
-- fulfillment meaning; this mapping is the best faithful reading of each.
update public.orders set
  commercial_status = case status
    when 'pending' then 'pending'
    when 'cancelled' then 'cancelled'
    when 'refunded' then 'closed'
    when 'fulfilled' then 'closed'
    else 'confirmed' end,
  payment_status = case status
    when 'pending' then 'none'
    when 'refunded' then 'refunded'
    when 'cancelled' then 'none'
    else 'captured' end,
  fulfillment_status = case status
    when 'pending' then 'unfulfilled'
    when 'confirmed' then 'unfulfilled'
    when 'processing' then 'processing'
    when 'ready' then 'ready'
    when 'fulfilled' then 'fulfilled'
    when 'cancelled' then 'cancelled'
    when 'refunded' then 'fulfilled'
    else 'unfulfilled' end
where commercial_status = 'pending' and payment_status = 'none';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_commercial_status_check') then
    alter table public.orders add constraint orders_commercial_status_check
      check (commercial_status in ('pending', 'confirmed', 'closed', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('none', 'pending', 'authorized', 'captured',
                                'partially_refunded', 'refunded', 'failed',
                                'expired', 'disputed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_fulfillment_status_check') then
    alter table public.orders add constraint orders_fulfillment_status_check
      check (fulfillment_status in ('unfulfilled', 'reserved', 'processing',
                                    'ready', 'partially_fulfilled', 'fulfilled',
                                    'cancelled'));
  end if;
end $$;

comment on column public.orders.status is
  'SUPERSEDED by commercial_status/payment_status/fulfillment_status (contract 01, ruling D-1). Retained for backfill safety; no new code reads it.';

-- ── 2. Cross-machine invariants ────────────────────────────────────────────
-- The machines are independent, but not every combination is coherent. These
-- are the contract's invariants, enforced in Postgres rather than trusted to
-- application code.
create or replace function public.guard_order_state()
returns trigger
language plpgsql
as $$
begin
  -- Physical work requires a commercially confirmed order.
  if new.fulfillment_status in ('processing', 'ready', 'partially_fulfilled', 'fulfilled')
     and new.commercial_status <> 'confirmed' then
    raise exception 'fulfillment_status % requires commercial_status = confirmed (got %)',
      new.fulfillment_status, new.commercial_status;
  end if;

  -- Nothing ships before the money is actually captured.
  if new.fulfillment_status in ('partially_fulfilled', 'fulfilled')
     and new.payment_status <> 'captured' then
    raise exception 'cannot ship with payment_status = % (captured required)', new.payment_status;
  end if;

  -- A failed or expired payment cannot coexist with work in progress.
  if new.payment_status in ('failed', 'expired')
     and new.fulfillment_status in ('processing', 'ready', 'partially_fulfilled', 'fulfilled') then
    raise exception 'payment_status % is incompatible with fulfillment_status %',
      new.payment_status, new.fulfillment_status;
  end if;

  new.updated_at = now();
  return new;
end $$;

drop trigger if exists guard_order_state on public.orders;
create trigger guard_order_state
  before insert or update on public.orders
  for each row execute function public.guard_order_state();

-- ── 3. Exceptions are rows, not a state ────────────────────────────────────
-- `attention_required` is removed from the machines: an order awaiting a
-- compliance answer has not stopped being confirmed.
create table if not exists public.order_exceptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reason text not null check (reason in (
    'compliance_hold', 'payment_review', 'inventory_shortfall',
    'address_problem', 'carrier_problem', 'customer_request', 'other')),
  detail text not null default '',
  blocking boolean not null default true,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create index if not exists order_exceptions_open_idx
  on public.order_exceptions (order_id) where resolved_at is null;

alter table public.order_exceptions enable row level security;
drop policy if exists "staff read exceptions" on public.order_exceptions;
create policy "staff read exceptions" on public.order_exceptions
  for select using (public.is_staff());
drop policy if exists "staff write exceptions" on public.order_exceptions;
create policy "staff write exceptions" on public.order_exceptions
  for all using (public.is_staff()) with check (public.is_staff());

-- ── 4. Inquiries ───────────────────────────────────────────────────────────
-- The storefront inquiry form currently posts to Netlify Forms, which leaves
-- the operations console blind to it. This table is the durable home so
-- COMMAND can show inquiries alongside orders.
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null default '',
  organization text not null default '',
  email text not null default '',
  product text not null default '',
  message text not null default '',
  research_use_acknowledged boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'in_review', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;
-- Anonymous visitors may submit an inquiry but may never read any back.
drop policy if exists "anyone submits inquiry" on public.inquiries;
create policy "anyone submits inquiry" on public.inquiries
  for insert with check (true);
drop policy if exists "staff read inquiries" on public.inquiries;
create policy "staff read inquiries" on public.inquiries
  for select using (public.is_staff());
drop policy if exists "staff update inquiries" on public.inquiries;
create policy "staff update inquiries" on public.inquiries
  for update using (public.is_staff()) with check (public.is_staff());

-- ── 5. Audited inventory adjustment ────────────────────────────────────────
-- Manual stock correction is a privileged, audited operation. It is a function
-- rather than a direct UPDATE so that no adjustment can happen without a
-- reason and an audit row — the audit is part of the same transaction, so an
-- adjustment that fails to record simply does not occur.
create or replace function public.adjust_inventory(
  p_sku text,
  p_delta integer,
  p_reason text
)
returns public.inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inventory;
  v_before integer;
begin
  if not public.is_manager() then
    raise exception 'inventory adjustment requires manager or admin';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'inventory adjustment requires a reason';
  end if;
  if p_delta = 0 then
    raise exception 'inventory adjustment delta must be non-zero';
  end if;

  select * into v_row from public.inventory where sku = p_sku for update;
  if not found then
    raise exception 'unknown sku %', p_sku;
  end if;

  v_before := v_row.quantity_on_hand;
  if v_before + p_delta < 0 then
    raise exception 'adjustment would drive % below zero (on hand %, delta %)',
      p_sku, v_before, p_delta;
  end if;

  update public.inventory
     set quantity_on_hand = v_before + p_delta,
         updated_at = now()
   where id = v_row.id
   returning * into v_row;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'inventory.adjusted', 'inventory', v_row.id::text,
          jsonb_build_object('sku', p_sku, 'delta', p_delta,
                             'before', v_before, 'after', v_row.quantity_on_hand,
                             'reason', p_reason));

  return v_row;
end $$;

revoke all on function public.adjust_inventory(text, integer, text) from public;
grant execute on function public.adjust_inventory(text, integer, text) to authenticated;
