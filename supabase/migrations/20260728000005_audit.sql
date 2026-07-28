-- Everlume platform · 0005 — audit trail for protected actions.
-- audit_events is written only by SECURITY DEFINER triggers attached to the
-- protected tables; clients can never insert, alter, or delete audit rows.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,                    -- auth.uid() of the acting user; null = system/service
  action text not null,             -- e.g. 'UPDATE:inventory'
  entity_type text not null,
  entity_id text not null default '',
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_created on public.audit_events (created_at);
create index if not exists idx_audit_entity on public.audit_events (entity_type, entity_id);

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entity_id text;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id::text;
  else
    v_entity_id := new.id::text;
  end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, before_state, after_state)
  values (
    auth.uid(),
    tg_op || ':' || tg_table_name,
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

-- Protected actions per the platform directive:
-- inventory adjustment
drop trigger if exists trg_audit_inventory on public.inventory;
create trigger trg_audit_inventory
  after insert or update or delete on public.inventory
  for each row execute function public.audit_row_change();

-- order state change
drop trigger if exists trg_audit_orders on public.orders;
create trigger trg_audit_orders
  after update on public.orders
  for each row execute function public.audit_row_change();

-- reward adjustment (ledger writes)
drop trigger if exists trg_audit_rewards_txn on public.rewards_transactions;
create trigger trg_audit_rewards_txn
  after insert on public.rewards_transactions
  for each row execute function public.audit_row_change();

-- product modification (includes compliance_status changes)
drop trigger if exists trg_audit_products on public.products;
create trigger trg_audit_products
  after insert or update or delete on public.products
  for each row execute function public.audit_row_change();

-- policy changes
drop trigger if exists trg_audit_policies on public.compliance_policies;
create trigger trg_audit_policies
  after insert or update or delete on public.compliance_policies
  for each row execute function public.audit_row_change();

-- role / account status changes on profiles
drop trigger if exists trg_audit_profile_roles on public.profiles;
create trigger trg_audit_profile_roles
  after update of role, account_status on public.profiles
  for each row execute function public.audit_row_change();

alter table public.audit_events enable row level security;

drop policy if exists "audit_select_staff" on public.audit_events;
create policy "audit_select_staff" on public.audit_events
  for select using (public.is_staff());
-- No insert/update/delete policies: definer-trigger writes only.
