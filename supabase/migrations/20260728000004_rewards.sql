-- Everlume platform · 0004 — rewards foundation.
-- Points are NEVER a mutable number: rewards_transactions is the append-only
-- ledger of truth, and rewards_accounts.balance is a cache maintained only by
-- the apply_rewards_transaction trigger.

create table if not exists public.rewards_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance bigint not null default 0,
  referral_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rewards_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('earn', 'redeem', 'adjustment', 'expire', 'refund')),
  points bigint not null check (points <> 0),
  source text not null default '',          -- e.g. 'order', 'referral', 'promotion', 'signup'
  reference_id text not null default '',    -- e.g. order id, referral id
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Sign discipline: earns add, redemptions/expiries subtract;
  -- adjustments and refunds may go either way.
  check (
    (type = 'earn' and points > 0)
    or (type in ('redeem', 'expire') and points < 0)
    or (type in ('adjustment', 'refund'))
  )
);

create index if not exists idx_rewards_txn_user on public.rewards_transactions (user_id);
create index if not exists idx_rewards_txn_created on public.rewards_transactions (created_at);

create table if not exists public.rewards_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  description text not null default '',
  config jsonb not null default '{}'::jsonb,
  -- Rules ship inactive: no financial incentive activates until the business
  -- rules are approved.
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rewards_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid references public.rewards_transactions (id) on delete set null,
  reward_description text not null default '',
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  referred_user_id uuid unique references auth.users (id) on delete set null,
  code_used text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'qualified', 'rewarded')),
  created_at timestamptz not null default now()
);

create index if not exists idx_referrals_referrer on public.referrals (referrer_user_id);

drop trigger if exists trg_rewards_accounts_updated_at on public.rewards_accounts;
create trigger trg_rewards_accounts_updated_at
  before update on public.rewards_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_rewards_rules_updated_at on public.rewards_rules;
create trigger trg_rewards_rules_updated_at
  before update on public.rewards_rules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_rewards_redemptions_updated_at on public.rewards_redemptions;
create trigger trg_rewards_redemptions_updated_at
  before update on public.rewards_redemptions
  for each row execute function public.set_updated_at();

-- Every profile gets a rewards account.
create or replace function public.provision_rewards_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.rewards_accounts (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_profiles_rewards_account on public.profiles;
create trigger trg_profiles_rewards_account
  after insert on public.profiles
  for each row execute function public.provision_rewards_account();

-- Ledger application: the ONLY writer of rewards_accounts.balance.
create or replace function public.apply_rewards_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_balance bigint;
begin
  insert into public.rewards_accounts (user_id) values (new.user_id)
  on conflict (user_id) do nothing;

  update public.rewards_accounts
     set balance = balance + new.points, updated_at = now()
   where user_id = new.user_id
  returning balance into v_balance;

  if v_balance < 0 then
    raise exception 'rewards balance may not go negative (would be %)', v_balance;
  end if;
  return new;
end $$;

drop trigger if exists trg_apply_rewards_transaction on public.rewards_transactions;
create trigger trg_apply_rewards_transaction
  after insert on public.rewards_transactions
  for each row execute function public.apply_rewards_transaction();

-- The ledger is append-only.
create or replace function public.forbid_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'rewards_transactions is append-only';
end $$;

drop trigger if exists trg_rewards_txn_immutable on public.rewards_transactions;
create trigger trg_rewards_txn_immutable
  before update or delete on public.rewards_transactions
  for each row execute function public.forbid_ledger_mutation();

-- ── Row level security ─────────────────────────────────────────────────────
alter table public.rewards_accounts enable row level security;
alter table public.rewards_transactions enable row level security;
alter table public.rewards_rules enable row level security;
alter table public.rewards_redemptions enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "rewards_accounts_select_own_or_staff" on public.rewards_accounts;
create policy "rewards_accounts_select_own_or_staff" on public.rewards_accounts
  for select using (user_id = auth.uid() or public.is_staff());
-- No insert/update policies: accounts are provisioned and balanced only by
-- SECURITY DEFINER triggers.

drop policy if exists "rewards_txn_select_own_or_staff" on public.rewards_transactions;
create policy "rewards_txn_select_own_or_staff" on public.rewards_transactions
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "rewards_txn_insert_staff" on public.rewards_transactions;
create policy "rewards_txn_insert_staff" on public.rewards_transactions
  for insert with check (public.is_staff());

drop policy if exists "rewards_rules_select_staff" on public.rewards_rules;
create policy "rewards_rules_select_staff" on public.rewards_rules
  for select using (public.is_staff());

drop policy if exists "rewards_rules_write_manager" on public.rewards_rules;
create policy "rewards_rules_write_manager" on public.rewards_rules
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists "redemptions_select_own_or_staff" on public.rewards_redemptions;
create policy "redemptions_select_own_or_staff" on public.rewards_redemptions
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "redemptions_insert_own_requested" on public.rewards_redemptions;
create policy "redemptions_insert_own_requested" on public.rewards_redemptions
  for insert with check (
    (user_id = auth.uid() and status = 'requested') or public.is_staff()
  );

drop policy if exists "redemptions_update_staff" on public.rewards_redemptions;
create policy "redemptions_update_staff" on public.rewards_redemptions
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "referrals_select_own_or_staff" on public.referrals;
create policy "referrals_select_own_or_staff" on public.referrals
  for select using (
    referrer_user_id = auth.uid() or referred_user_id = auth.uid() or public.is_staff()
  );

drop policy if exists "referrals_write_staff" on public.referrals;
create policy "referrals_write_staff" on public.referrals
  for all using (public.is_staff()) with check (public.is_staff());

-- Placeholder rules (inactive) so the shape is visible to the business.
insert into public.rewards_rules (rule_key, description, config)
values
  ('earn_per_dollar', 'Points earned per dollar of completed order value', '{"points_per_dollar": 10}'),
  ('signup_bonus', 'One-time points bonus for creating an account', '{"points": 250}'),
  ('referral_bonus', 'Points for a qualified referral', '{"referrer_points": 500, "referred_points": 250}')
on conflict (rule_key) do nothing;
