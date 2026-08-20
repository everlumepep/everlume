-- Harden the function boundary discovered by the live Supabase advisor.
-- Trigger functions are internal implementation details and must never be
-- callable through PostgREST. Role predicates remain callable because RLS
-- policies use them for both anonymous and authenticated requests; they accept
-- no caller-controlled identity and resolve only auth.uid().

alter function public.set_updated_at() set search_path = public;
alter function public.derive_inventory_status() set search_path = public;
alter function public.assign_order_number() set search_path = public;
alter function public.guard_order_state() set search_path = public;
alter function public.forbid_ledger_mutation() set search_path = public;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.derive_inventory_status() from public, anon, authenticated;
revoke all on function public.assign_order_number() from public, anon, authenticated;
revoke all on function public.guard_order_state() from public, anon, authenticated;
revoke all on function public.forbid_ledger_mutation() from public, anon, authenticated;
revoke all on function public.apply_rewards_transaction() from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.protect_profile_privileged_fields() from public, anon, authenticated;
revoke all on function public.provision_rewards_account() from public, anon, authenticated;
revoke all on function public.role_of(uuid) from public, anon, authenticated;

-- This is the one privileged RPC intentionally exposed to signed-in users.
-- Its body independently requires manager/admin authority and records the
-- reason and audit event in the same transaction.
revoke all on function public.adjust_inventory(text, integer, text) from public, anon, authenticated;
grant execute on function public.adjust_inventory(text, integer, text) to authenticated;
