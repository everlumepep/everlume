-- Everlume platform · 0007 — allow account deletion without breaking the
-- append-only rewards ledger.
--
-- DEFECT (found by the XCOP-001.14 live-verification battery, before any
-- production data existed): rewards_transactions.user_id used ON DELETE
-- CASCADE while a BEFORE UPDATE OR DELETE trigger unconditionally raised.
-- Deleting an auth.users row therefore cascaded into a blocked DELETE and
-- the whole transaction failed — so any customer who had ever earned a
-- single point could not have their account closed or erased.
--
-- FIX: a rewards ledger is a financial record and should survive the
-- account, anonymized rather than destroyed. user_id becomes nullable with
-- ON DELETE SET NULL, and the immutability trigger gains ONE narrow
-- carve-out: the FK-driven anonymization update, where the only column that
-- changes is user_id going from a value to NULL. DELETE stays blocked
-- unconditionally, and points/type/created_at remain immutable forever.

alter table public.rewards_transactions
  alter column user_id drop not null;

alter table public.rewards_transactions
  drop constraint if exists rewards_transactions_user_id_fkey;

alter table public.rewards_transactions
  add constraint rewards_transactions_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

create or replace function public.forbid_ledger_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'rewards_transactions is append-only (delete refused)';
  end if;

  -- Permit ONLY account anonymization: user_id value -> NULL, nothing else
  -- touched. Comparing the full rows minus user_id makes this impossible to
  -- abuse as a general update path.
  if old.user_id is not null
     and new.user_id is null
     and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;

  raise exception 'rewards_transactions is append-only (update refused)';
end $$;

comment on function public.forbid_ledger_mutation() is
  'Keeps the rewards ledger append-only. Deletes always refused; the only permitted update is FK-driven anonymization (user_id -> NULL) when an account is deleted.';

-- Redemptions reference the ledger and the user; keep them consistent with
-- the same "survive the account, anonymized" rule.
alter table public.rewards_redemptions
  alter column user_id drop not null;

alter table public.rewards_redemptions
  drop constraint if exists rewards_redemptions_user_id_fkey;

alter table public.rewards_redemptions
  add constraint rewards_redemptions_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
