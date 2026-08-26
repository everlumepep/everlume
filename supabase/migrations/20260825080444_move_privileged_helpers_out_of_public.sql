-- Keep privileged authorization helpers outside the exposed Data API schema.
-- Existing RLS policy dependencies follow the functions by OID when moved.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema private to service_role;
  end if;
end $$;

alter function public.role_of(uuid) set schema private;
alter function public.is_staff() set schema private;
alter function public.is_manager() set schema private;
alter function public.is_admin() set schema private;

create or replace function private.role_of(uid uuid)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select role from public.profiles where id = uid
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(private.role_of(auth.uid()) in ('staff', 'manager', 'admin'), false)
$$;

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(private.role_of(auth.uid()) in ('manager', 'admin'), false)
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(private.role_of(auth.uid()) = 'admin', false)
$$;

revoke all on function private.role_of(uuid) from public, anon, authenticated;
revoke all on function private.is_staff() from public;
revoke all on function private.is_manager() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.is_staff() to anon, authenticated;
grant execute on function private.is_manager() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

-- These trigger/RPC bodies are source text, so update their helper references.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (new.role is distinct from old.role
      or new.account_status is distinct from old.account_status)
     and auth.uid() is not null
     and not private.is_admin() then
    raise exception 'only an admin may change role or account_status';
  end if;
  return new;
end $$;

revoke all on function public.protect_profile_privileged_fields()
  from public, anon, authenticated;

-- Move the privileged inventory implementation out of public. Keep a narrow,
-- invoker-rights RPC wrapper so signed-in staff can use the existing API.
alter function public.adjust_inventory(text, integer, text) set schema private;

create or replace function private.adjust_inventory(
  p_sku text,
  p_delta integer,
  p_reason text
)
returns public.inventory
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_row public.inventory;
  v_before integer;
begin
  if not private.is_manager() then
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

revoke all on function private.adjust_inventory(text, integer, text)
  from public, anon;
grant execute on function private.adjust_inventory(text, integer, text)
  to authenticated;

create or replace function public.adjust_inventory(
  p_sku text,
  p_delta integer,
  p_reason text
)
returns public.inventory
language sql
security invoker
set search_path = public, private
as $$
  select private.adjust_inventory(p_sku, p_delta, p_reason)
$$;

revoke all on function public.adjust_inventory(text, integer, text)
  from public, anon;
grant execute on function public.adjust_inventory(text, integer, text)
  to authenticated;
