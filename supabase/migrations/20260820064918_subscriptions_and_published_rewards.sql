-- Everlume subscriptions and the client-published rewards program.
-- Rewards: $10 referral credit after the referred customer's first settled
-- purchase; six fulfilled purchases unlock one complimentary eligible item.

alter table public.rewards_accounts
  add column if not exists store_credit_cents integer not null default 0 check (store_credit_cents >= 0),
  add column if not exists qualifying_purchases integer not null default 0 check (qualifying_purchases >= 0),
  add column if not exists complimentary_rewards integer not null default 0 check (complimentary_rewards >= 0);

alter table public.profiles add column if not exists stripe_customer_id text unique;

create table if not exists public.store_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  amount_cents integer not null check (amount_cents <> 0),
  type text not null check (type in ('referral','redemption','refund','adjustment')),
  reference_id text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists uq_store_credit_reference
  on public.store_credit_transactions(type, reference_id) where reference_id <> '';
alter table public.store_credit_transactions enable row level security;
create policy "store_credit_select_own_or_staff" on public.store_credit_transactions
  for select to authenticated using ((select auth.uid()) = user_id or public.is_staff());

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  cadence_days integer not null check (cadence_days in (30,60,90)),
  status text not null check (status in ('incomplete','incomplete_expired','trialing','active','past_due','paused','canceled','unpaid')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own_or_staff" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id or public.is_staff());
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

insert into public.rewards_rules(rule_key, description, config, active) values
 ('referral_credit', '$10 credit after referred customer first settled purchase', '{"credit_cents":1000,"qualification":"first_settled_purchase"}', true),
 ('seventh_purchase_reward', 'Six fulfilled purchases unlock a complimentary eligible item', '{"qualifying_purchases":6,"reward":"eligible_item","redeem_on_purchase":7}', true)
on conflict (rule_key) do update set description=excluded.description, config=excluded.config, active=true;
update public.rewards_rules set active=false where rule_key in ('earn_per_dollar','signup_bonus','referral_bonus');

create or replace function public.apply_store_credit_transaction()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_balance integer;
begin
  insert into public.rewards_accounts(user_id) values(new.user_id) on conflict(user_id) do nothing;
  update public.rewards_accounts set store_credit_cents=store_credit_cents+new.amount_cents, updated_at=now()
   where user_id=new.user_id returning store_credit_cents into v_balance;
  if v_balance < 0 then raise exception 'store credit may not go negative'; end if;
  return new;
end $$;
revoke all on function public.apply_store_credit_transaction() from public, anon, authenticated;
create trigger trg_apply_store_credit after insert on public.store_credit_transactions
  for each row execute function public.apply_store_credit_transaction();

create or replace function public.apply_fulfilled_purchase_reward()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.user_id is not null and new.status='fulfilled' and old.status is distinct from 'fulfilled' then
    insert into public.rewards_accounts(user_id) values(new.user_id) on conflict(user_id) do nothing;
    update public.rewards_accounts set
      qualifying_purchases=(qualifying_purchases+1)%6,
      complimentary_rewards=complimentary_rewards + case when qualifying_purchases=5 then 1 else 0 end,
      updated_at=now()
    where user_id=new.user_id;
  end if;
  return new;
end $$;
revoke all on function public.apply_fulfilled_purchase_reward() from public, anon, authenticated;
create trigger trg_fulfilled_purchase_reward after update of status on public.orders
  for each row execute function public.apply_fulfilled_purchase_reward();

-- Capture a referral code at account creation and resolve it server-side.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_referrer uuid;
begin
  insert into public.profiles(id,email,first_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'first_name','')) on conflict(id) do nothing;
  if nullif(trim(new.raw_user_meta_data->>'referral_code'),'') is not null then
    select user_id into v_referrer from public.rewards_accounts
      where referral_code=upper(trim(new.raw_user_meta_data->>'referral_code')) and user_id<>new.id;
    if v_referrer is not null then
      insert into public.referrals(referrer_user_id,referred_user_id,code_used)
      values(v_referrer,new.id,upper(trim(new.raw_user_meta_data->>'referral_code'))) on conflict(referred_user_id) do nothing;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.award_qualified_referral()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_referral public.referrals%rowtype;
begin
  if new.user_id is not null and new.payment_status='captured' and old.payment_status is distinct from 'captured' then
    select * into v_referral from public.referrals where referred_user_id=new.user_id and status='pending' for update;
    if found then
      insert into public.store_credit_transactions(user_id,amount_cents,type,reference_id,description)
      values(v_referral.referrer_user_id,1000,'referral',v_referral.id::text,'Qualified referral — $10 store credit')
      on conflict do nothing;
      update public.referrals set status='rewarded' where id=v_referral.id;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.award_qualified_referral() from public, anon, authenticated;
create trigger trg_award_qualified_referral after update of payment_status on public.orders
  for each row execute function public.award_qualified_referral();

grant select on public.subscriptions, public.store_credit_transactions to authenticated;
