-- Everlume platform · 0002 — compliance policies and gate acceptances.
-- NOTE: these tables are technical compliance controls (versioned policies,
-- acceptance receipts). They do not make any product legal to sell and are
-- not a declaration of regulatory status.

create table if not exists public.compliance_policies (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null
    check (policy_type in ('terms', 'privacy', 'research_use', 'gate')),
  version text not null,
  title text not null,
  content text not null default '',
  effective_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (policy_type, version)
);

create table if not exists public.compliance_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  session_reference text,
  policy_id uuid references public.compliance_policies (id) on delete set null,
  gate_version text not null default '',
  policy_versions jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  -- Data minimization: a receipt proves the gate was completed and under
  -- which versions. It never contains a date of birth or an age.
  check (user_id is not null or session_reference is not null)
);

create index if not exists idx_acceptances_user on public.compliance_acceptances (user_id);
create index if not exists idx_acceptances_session on public.compliance_acceptances (session_reference);
create index if not exists idx_acceptances_time on public.compliance_acceptances (accepted_at);

alter table public.compliance_policies enable row level security;
alter table public.compliance_acceptances enable row level security;

-- Policy documents are public reading material.
drop policy if exists "policies_select_all" on public.compliance_policies;
create policy "policies_select_all" on public.compliance_policies
  for select using (true);

drop policy if exists "policies_write_manager" on public.compliance_policies;
create policy "policies_write_manager" on public.compliance_policies
  for all using (public.is_manager()) with check (public.is_manager());

-- Anyone (including anonymous gate visitors) may record an acceptance;
-- acceptances are append-only receipts — no update/delete policies exist.
drop policy if exists "acceptances_insert_any" on public.compliance_acceptances;
create policy "acceptances_insert_any" on public.compliance_acceptances
  for insert with check (user_id is null or user_id = auth.uid());

drop policy if exists "acceptances_select_own_or_staff" on public.compliance_acceptances;
create policy "acceptances_select_own_or_staff" on public.compliance_acceptances
  for select using (user_id = auth.uid() or public.is_staff());

-- Seed the policy versions currently referenced by js/config.js.
insert into public.compliance_policies (policy_type, version, title)
values
  ('terms', '1.0-draft', 'Terms & Conditions (draft pending legal review)'),
  ('privacy', '1.0', 'Privacy Policy'),
  ('research_use', '1.0', 'Research-Use & Compliance Notice'),
  ('gate', '2026-07-28.1', 'Entry gate — adult access & product acknowledgement')
on conflict (policy_type, version) do nothing;
