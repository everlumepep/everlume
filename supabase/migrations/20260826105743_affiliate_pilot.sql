-- Everlume Affiliate Pilot
-- Narrow scope: application, manual review, unique code/link, and pending
-- commission visibility. Payouts and automated settlement are intentionally
-- excluded from this schema.

create table public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 100),
  email text not null,
  channel_url text not null default '',
  audience_note text not null default '' check (length(audience_note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  affiliate_code text unique,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'approved' and affiliate_code is not null and reviewed_at is not null)
      or (status <> 'approved' and affiliate_code is null))
);

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'void')),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index affiliate_applications_status_idx on public.affiliate_applications (status, created_at);
create index affiliate_commissions_user_idx on public.affiliate_commissions (affiliate_user_id, created_at desc);

create or replace function private.set_affiliate_application_identity()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  new.user_id := auth.uid();
  select email into new.email from auth.users where id = auth.uid();
  return new;
end $$;

revoke all on function private.set_affiliate_application_identity() from public, anon, authenticated;
create trigger trg_affiliate_application_identity
  before insert on public.affiliate_applications
  for each row execute function private.set_affiliate_application_identity();

create trigger trg_affiliate_applications_updated_at
  before update on public.affiliate_applications
  for each row execute function public.set_updated_at();
create trigger trg_affiliate_commissions_updated_at
  before update on public.affiliate_commissions
  for each row execute function public.set_updated_at();

alter table public.affiliate_applications enable row level security;
alter table public.affiliate_commissions enable row level security;

create policy affiliate_applications_select_own_or_staff
  on public.affiliate_applications for select to authenticated
  using ((select auth.uid()) = user_id or private.is_staff());
create policy affiliate_applications_insert_own
  on public.affiliate_applications for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending'
    and affiliate_code is null and reviewed_by is null and reviewed_at is null);
create policy affiliate_commissions_select_own_or_staff
  on public.affiliate_commissions for select to authenticated
  using ((select auth.uid()) = affiliate_user_id or private.is_staff());

grant select, insert on public.affiliate_applications to authenticated;
grant select on public.affiliate_commissions to authenticated;
revoke update, delete on public.affiliate_applications from anon, authenticated;
revoke insert, update, delete on public.affiliate_commissions from anon, authenticated;

create or replace function private.next_affiliate_code(p_name text, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  base text;
  candidate text;
  attempt integer := 0;
begin
  base := upper(regexp_replace(coalesce(p_name, 'EVERLUME'), '[^a-zA-Z0-9]', '', 'g'));
  base := left(coalesce(nullif(base, ''), 'EVERLUME'), 8);
  loop
    candidate := base || '-' || upper(substr(md5(p_user_id::text || attempt::text), 1, 6));
    exit when not exists (select 1 from public.affiliate_applications where affiliate_code = candidate);
    attempt := attempt + 1;
  end loop;
  return candidate;
end $$;

create or replace function private.review_affiliate_application(p_application_id uuid, p_decision text)
returns public.affiliate_applications
language plpgsql
security definer
set search_path = public, private
as $$
declare
  row public.affiliate_applications;
begin
  if not private.is_manager() then
    raise exception 'affiliate review requires manager or admin';
  end if;
  if p_decision not in ('approved', 'declined') then
    raise exception 'decision must be approved or declined';
  end if;
  select * into row from public.affiliate_applications where id = p_application_id for update;
  if not found then raise exception 'affiliate application not found'; end if;
  update public.affiliate_applications
     set status = p_decision,
         affiliate_code = case when p_decision = 'approved'
           then coalesce(row.affiliate_code, private.next_affiliate_code(row.display_name, row.user_id))
           else null end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_application_id returning * into row;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'affiliate.reviewed', 'affiliate_application', row.id::text,
    jsonb_build_object('decision', p_decision, 'affiliate_code', row.affiliate_code));
  return row;
end $$;

revoke all on function private.next_affiliate_code(text, uuid) from public, anon, authenticated;
revoke all on function private.review_affiliate_application(uuid, text) from public, anon;
grant execute on function private.review_affiliate_application(uuid, text) to authenticated;

create or replace function public.review_affiliate_application(p_application_id uuid, p_decision text)
returns public.affiliate_applications
language sql
security invoker
set search_path = public, private
as $$ select private.review_affiliate_application(p_application_id, p_decision) $$;

revoke all on function public.review_affiliate_application(uuid, text) from public, anon;
grant execute on function public.review_affiliate_application(uuid, text) to authenticated;

comment on table public.affiliate_commissions is
  'Affiliate Pilot estimates only. No payout, payable, paid, or settlement capability exists.';
