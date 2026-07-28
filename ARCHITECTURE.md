# Everlume Platform Architecture

Everlume is one connected commerce platform: the customer storefront and the
future **XENTH / EVERLUME COMMAND** operations console read the same Supabase
source of truth.

## Stack

- **Frontend:** static, no-build site on Netlify (unchanged deployment model:
  publish `.`, no build command). New surfaces are plain HTML/CSS/JS using the
  existing Everlume design system.
- **Backend:** Supabase — `auth.users` for authentication, Postgres for data,
  **RLS as the security boundary**. `vendor/supabase.js` is self-hosted so the
  CSP stays `script-src 'self'`.
- **Config:** `js/config.js` holds the public Supabase URL + anon key (safe to
  publish by design) plus the gate/policy versions. Until it is filled in,
  every account/COMMAND surface degrades to a clear "backend not connected"
  state and the storefront gate runs fully client-side.

## Surfaces

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Storefront + entry compliance gate | Public (gated) |
| `/terms.html`, `/privacy.html`, `/research-use.html` | Policies | Public, ungated (the gate links to them) |
| `/account/signin.html` | Sign in / sign up / password reset | Public |
| `/account/` | My Everlume portal (overview, orders, rewards, profile, addresses, settings) | Signed-in customer |
| `/command/` | XENTH / EVERLUME COMMAND admin shell | `staff` / `manager` / `admin` roles only |

## Entry compliance gate

- DOB (MM/DD/YYYY) validated client-side; configurable minimum age
  (`MIN_AGE`, default 18); underage → refusal state.
- Four acknowledgements (age, Terms, Privacy, Research-Use notice), versioned
  via `GATE_VERSION` + `POLICY_VERSIONS`. Bumping any version forces
  re-consent for every visitor.
- **Data minimization:** anonymous visitors' DOB is checked in the browser and
  never stored or transmitted. The pass record (localStorage) holds only
  versions + timestamp. If Supabase is configured, an acceptance receipt keyed
  by an opaque session UUID is recorded in `compliance_acceptances` — still no
  DOB, no age. Stronger identity/age verification can later replace this
  without redesigning the schema (acceptances already support `user_id`).
- Accessible: dialog semantics, focus trap, keyboard-completable, no dark
  patterns.

⚠️ The gate, disclaimers, and acknowledgements are **technical controls
only**. They do not make any product legal to sell. Product regulatory status
is tracked separately (`products.compliance_status`, default
`pending_review`) and requires human/legal review.

## Data model

```
auth.users ──▶ profiles (role: customer|staff|manager|admin)
                 ├─▶ addresses
                 ├─▶ orders ──▶ order_items ──▶ products ──▶ inventory
                 └─▶ rewards_accounts ◀── trigger ── rewards_transactions (append-only ledger)
                       rewards_rules (inactive until approved) · rewards_redemptions · referrals
compliance_policies ──▶ compliance_acceptances (user OR anonymous session ref)
audit_events ◀── SECURITY DEFINER triggers on inventory/orders/rewards/products/policies/roles
```

Key invariants (enforced in Postgres, not UI):

- `profiles.role` and `account_status` can only be changed by an admin
  (trigger), and role changes are audited.
- Rewards balance is **never** written directly: `rewards_transactions` is an
  append-only ledger (update/delete raise), and a trigger maintains
  `rewards_accounts.balance`, rejecting negative balances.
- Customers can only create their own `pending` orders; all later state
  changes are staff-only and audited.
- `audit_events` accepts writes only from definer triggers; staff can read,
  nobody can edit.
- All 14 tables have RLS enabled (verified by `tests/schema.test.mjs`).

## Roles

`customer` (default) → `staff` (read ops data, process orders) → `manager`
(write products/inventory/policies/rules) → `admin` (role management). Roles
live on `profiles` and are assigned in the database by an admin — never from
client UI.

## Environment / configuration required to activate the backend

1. Create a Supabase project.
2. Apply migrations: `supabase link --project-ref <ref> && supabase db push`
   (or run the six files in `supabase/migrations/` in order in the SQL editor).
3. Fill `js/config.js` → `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon key only —
   the service_role key must never appear in this repo; CI test enforces no
   key material is committed).
4. Supabase Auth settings: set Site URL to the deployed origin; add
   `/account/` and `/account/reset.html` to the redirect allow-list; keep
   email confirmation ON.
5. Promote the first admin: `update profiles set role = 'admin' where email = '<founder email>';`

## Live verification battery (XCOP-001.14)

Once the backend is connected, run the full security battery against the real
project. It exercises every control through the same path a browser takes
(anon key + real signed-in sessions); the service-role key is used only to
create and destroy throwaway test accounts and is never used to make an
assertion pass.

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/live-verify.mjs
```

Set those in the shell for that run only — never in a file. The script exits
2 if credentials are absent, 1 on any failed control, 0 on a clean battery,
and prints a JSON receipt suitable for evidence capture. It covers schema
reachability, auth, customer isolation, order ownership, privilege-escalation
refusal, ledger immutability and balance reconciliation, staff authorization,
audit generation and forgery refusal, account deletion, gate data
minimization, and draft-product exposure.

## Testing

`npm test` runs:
- `tests/gate-logic.test.mjs` — DOB validation, age boundaries, refusal,
  acknowledgement enforcement, version re-consent, data-minimization.
- `tests/schema.test.mjs` — every table has RLS, ledger is append-only, audit
  is client-read-only, no credential material committed, seeds stay
  `pending_review`.
- `validate.mjs` — required files, internal links, noindex posture, CSP, and
  consumer-claim phrase scan.

## Deliberately deferred

- Checkout/payments (needs processor + product/jurisdiction legal review).
- Rewards activation (`rewards_rules.active = false` until business approval).
- COMMAND write operations (order state, inventory adjustments) — arrive with
  the commerce build-out; server-side enforcement is already in place.
- Lots/batches/expiration (`inventory_lots`, `inventory_movements`).
- Netlify Functions for privileged server-side operations if ever needed
  beyond RLS.
