-- Everlume platform · 0001 — profiles, roles, and RLS helper functions.
-- auth.users is the authentication authority; profiles carries application
-- data and the role used for authorization everywhere else.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  role text not null default 'customer'
    check (role in ('customer', 'staff', 'manager', 'admin')),
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'closed')),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile per auth.users row. role drives all staff authorization; it can only be changed by an admin (enforced by trigger, not UI).';

-- Shared updated_at maintenance, reused by later migrations.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role helpers. SECURITY DEFINER so RLS policies on profiles can call them
-- without recursing into profiles' own policies.
create or replace function public.role_of(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = uid
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.role_of(auth.uid()) in ('staff', 'manager', 'admin'), false)
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.role_of(auth.uid()) in ('manager', 'admin'), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.role_of(auth.uid()) = 'admin', false)
$$;

-- Auto-provision a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'first_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privileged fields cannot be self-served. auth.uid() is null in service /
-- migration contexts, which stay allowed.
create or replace function public.protect_profile_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.account_status is distinct from old.account_status)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'only an admin may change role or account_status';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_protect_privileged on public.profiles;
create trigger trg_profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff" on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Inserts happen only via the auth trigger (definer) — no insert policy.
