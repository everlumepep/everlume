-- Advisor remediation for the controlled-preview candidate.
--
-- 1. Add covering indexes for every foreign key currently reported by the
--    Supabase performance advisor.
-- 2. Cache auth.uid() once per statement in RLS policies instead of
--    re-evaluating it for every candidate row.

create index if not exists compliance_acceptances_policy_id_idx
  on public.compliance_acceptances (policy_id);
create index if not exists inquiries_user_id_idx
  on public.inquiries (user_id);
create index if not exists order_exceptions_resolved_by_idx
  on public.order_exceptions (resolved_by);
create index if not exists order_items_product_id_idx
  on public.order_items (product_id);
create index if not exists orders_shipping_address_id_idx
  on public.orders (shipping_address_id);
create index if not exists rewards_redemptions_transaction_id_idx
  on public.rewards_redemptions (transaction_id);
create index if not exists rewards_redemptions_user_id_idx
  on public.rewards_redemptions (user_id);
create index if not exists store_credit_transactions_user_id_idx
  on public.store_credit_transactions (user_id);
create index if not exists subscriptions_product_id_idx
  on public.subscriptions (product_id);
create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

alter policy "profiles_select_own_or_staff" on public.profiles
  using (id = (select auth.uid()) or public.is_staff());

alter policy "profiles_update_own_or_admin" on public.profiles
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

alter policy "acceptances_insert_any" on public.compliance_acceptances
  with check (user_id is null or user_id = (select auth.uid()));

alter policy "acceptances_select_own_or_staff" on public.compliance_acceptances
  using (user_id = (select auth.uid()) or public.is_staff());

alter policy "addresses_own" on public.addresses
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "orders_select_own_or_staff" on public.orders
  using (user_id = (select auth.uid()) or public.is_staff());

alter policy "orders_insert_own_pending" on public.orders
  with check (user_id = (select auth.uid()) and status = 'pending');

alter policy "order_items_select_visible" on public.order_items
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.user_id = (select auth.uid()) or public.is_staff())
  ));

alter policy "order_items_insert_own_pending" on public.order_items
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id
      and ((o.user_id = (select auth.uid()) and o.status = 'pending') or public.is_staff())
  ));

alter policy "rewards_accounts_select_own_or_staff" on public.rewards_accounts
  using (user_id = (select auth.uid()) or public.is_staff());

alter policy "rewards_txn_select_own_or_staff" on public.rewards_transactions
  using (user_id = (select auth.uid()) or public.is_staff());

alter policy "redemptions_select_own_or_staff" on public.rewards_redemptions
  using (user_id = (select auth.uid()) or public.is_staff());

alter policy "redemptions_insert_own_requested" on public.rewards_redemptions
  with check (
    (user_id = (select auth.uid()) and status = 'requested')
    or public.is_staff()
  );

alter policy "referrals_select_own_or_staff" on public.referrals
  using (
    referrer_user_id = (select auth.uid())
    or referred_user_id = (select auth.uid())
    or public.is_staff()
  );
