# Everlume — (X) MASTER Release Candidate

**Audit date:** 2026-08-20  
**Certified source:** `everlumepep/everlume` · `mderby5/everlume-photographic-vials` · `b5b9034`
**Release recommendation:** **NO-GO.** The exact static candidate is preview-deployed and network-certified, but preview backend connection, live/browser certification, ownership, legal, monitoring, recovery, and Founder gates remain open. Production and commerce remain stopped.

This is the authoritative completion board for Directive 03. `PASS` means evidence was collected. `BLOCKED` and `UNTESTED` never mean pass.

## Directive 04 execution receipt — 2026-08-20

**Release status: STOPPED — PRODUCTION NO-GO.**

- Source identity reverified: canonical folder, remote, branch, and baseline commit all match.
- Scoped working tree reverified at pushed candidate `b5b9034`; unrelated untracked files remain excluded.
- Source suite and static validation: **PASS — 22/22**, 50 required files and 15 pages.
- Offline migrations and security invariants: **PASS — 42/42** across all 12 ordered migrations.
- Dependency audit: **PASS — 0 known vulnerabilities**.
- Exact PR #4 preview network battery: **PASS — 60/60** at commit `b5b9034`, Netlify deployment `6a86ff875bcf430008283699`.
- Dedicated backend: **PASS for existence/schema boundary** — Supabase `Everlume` (`zyerhqcqxcjdnfmdbutg`) is `ACTIVE_HEALTHY`, has 12 migrations, 18 public tables, and RLS enabled on every public table.
- Security advisor: **7 WARN** — anonymous and authenticated execution exposure for `is_staff`, `is_manager`, and `is_admin`, plus authenticated execution for the intentionally role-checking/audited `adjust_inventory` RPC. No advisor warning is silently treated as a pass.
- Performance advisor: **OPEN** — unindexed foreign keys, per-row Auth/RLS evaluation, and overlapping permissive policies remain optimization risks.
- Corrective security migration: **APPLIED LIVE / COMMITTED AND PUSHED** at `b5b9034`.
- Real-browser certification: **BLOCKED** after a repeated attempt because the administrator-enforced browser security policy could not be verified.
- Preview/backend connection and live Auth/RLS battery: **BLOCKED** because Netlify ownership cannot be authenticated in the available browser or local CLI session.
- Ownership, inquiry delivery, monitoring, backup/restore, legal, and Founder gates: **BLOCKED / unrecorded**.
- Production and commerce: unchanged and inaccessible by policy; no production action was taken.

The stop conditions in Directive 04 remain active after publication. Release work resumes only after restored browser access, authenticated Netlify ownership, preview-only backend/Auth configuration, live certification, and the required approvals.

## Live security-warning disposition — 2026-08-20

**Disposition: controlled-preview risk acceptance only; remediation required before production.**

Identity helpers `is_admin()`, `is_manager()`, and `is_staff()`:

- are `STABLE SECURITY DEFINER` functions with fixed `search_path=public`;
- take no arguments, so callers cannot supply or probe another user ID;
- derive identity only from `auth.uid()` and return one boolean;
- delegate the profile lookup to `role_of(uid)`, whose EXECUTE privilege is limited to `service_role` and database ownership;
- are referenced by 30 live RLS policies, so simply revoking EXECUTE would break authorization;
- returned `false` for all three anonymous live RPC probes and for a synthetic ordinary authenticated session;
- disclose no user identifier, role string, profile row, or privileged record in those probes.

Required production remediation: move the helpers and `role_of` into a non-exposed private schema, update and re-certify all dependent RLS policies, then remove their public-schema RPC surface. Until that migration passes the live authorization battery, the six helper warnings remain accepted only for the non-production controlled preview.

`adjust_inventory(text, integer, text)`:

- anonymous RPC: **PASS — refused at the function privilege boundary**;
- ordinary authenticated customer: **PASS — refused by manager/admin enforcement**;
- manager path: **PASS — exactly one inventory change and one attributable audit event in the same transaction**;
- blank reason: **PASS — refused**;
- negative inventory: **PASS — refused**;
- cleanup: **PASS — all probes rolled back; zero synthetic users, zero probe audit rows, and unchanged inventory remained**.

The authenticated `adjust_inventory` warning is formally accepted for controlled preview because direct invocation is the intended COMMAND RPC and its body independently enforces role, reason, non-zero delta, non-negative inventory, row locking, attribution, and transactional audit. It remains subject to re-test after the preview is connected through a real Auth session.

## 1. Canonical source and production identity

| Link | Verified state | Result |
| --- | --- | --- |
| Local source | `/Users/xenth_admin/XENTH-LANES/everlume` | PASS |
| GitHub | `https://github.com/everlumepep/everlume.git` | PASS |
| Active branch | `mderby5/everlume-photographic-vials` | PASS |
| Directive commit | hardened candidate `b5b9034` | PASS |
| Branch comparison | active branch is 12 commits ahead of `main`, 0 behind | PASS |
| Pull request | PR #4, draft, mergeable, clean; Netlify preview successful | PASS |
| Netlify project | `everlume1`, account name `Everlume` | PASS |
| Production source | `main` at `65a2ac8` | PASS |
| Preview source | PR #4 at `b5b9034`; Netlify deploy `6a86ff875bcf430008283699` | PASS |
| Production domain | `myeverlume.com` | PASS |
| DNS / registrar | Cloudflare; `nick.ns.cloudflare.com`, `uma.ns.cloudflare.com`; routes to Netlify | PASS |
| Source-to-production agreement | production is 12 commits behind the release candidate | FAIL — P0 |

Authoritative chain today:

`GitHub main@65a2ac8 → Netlify everlume1 → myeverlume.com → no connected Everlume Supabase backend`

Candidate chain:

`GitHub PR #4 / branch@b5b9034 → Netlify deploy-preview-4--everlume1.netlify.app → Supabase Everlume zyerhqcqxcjdnfmdbutg (not yet connected to preview)`

## 2. Current product definition

The strongest honest immediate release is **A. Controlled Preview**. It is a premium research catalog with cinematic entry, photographic product presentation, format selection, local saved-research lists, deterministic catalog guidance, policies, and Netlify inquiries. Commerce, accounts, cross-device saved data, subscriptions, rewards, operational COMMAND data, and payment flows are not active.

## 3. Existing architecture

- Static HTML/CSS/JavaScript storefront deployed by Netlify.
- Netlify Forms for the `research-inquiry` workflow.
- Supabase schema and 12 ordered migrations for Auth, profiles, compliance, products, inventory, orders, rewards, audit, subscriptions, RLS, and function-boundary hardening.
- Browser-side Supabase client that degrades to an explicit unavailable state when runtime configuration is absent.
- Netlify Functions for Stripe subscription checkout, customer portal, and signed webhooks.
- COMMAND console whose reads and operations are protected by database roles and RLS.
- Deterministic, client-side Pep Talk catalog guidance; it is not an AI system.

## 4. Completed functionality

- Storefront, entry gate, catalog filtering, photographic vials, dose/format selection, research list, inquiry form, and policy pages are implemented.
- Account, password recovery, portal, rewards/referrals, subscriptions, and COMMAND interfaces are implemented but operationally blocked by the missing Everlume backend.
- Commerce tables, state machines, inventory controls, audit trails, server price lookup, Stripe functions, and webhook signature checks are implemented but not certified as a complete commercial loop.
- Public deployment boundary, security headers, no-index posture, static validation, and offline migration invariants pass.

## 5. Master completion board

| Priority | Owner | Surface | Evidence | Acceptance criteria / verification | Status |
| --- | --- | --- | --- | --- | --- |
| P0 | XENTH release owner | production identity | production hash equals `main@65a2ac8`, preview equals `b5b9034` | production deploys the exact certified commit only after all approvals; rerun 60 checks | FAIL |
| P0 | XENTH / Supabase owner | accounts, saved data, COMMAND | dedicated `Everlume` project `zyerhqcqxcjdnfmdbutg` is ACTIVE_HEALTHY; 12 migrations applied; all public tables have RLS | connect preview/Auth configuration and pass live verification | IN PROGRESS |
| P0 | Founder / legal | terms and public authority | Terms v1.0 is marked draft | written approval and final policy version | BLOCKED |
| P0 | Founder / commercial owner | commerce | products pending review; inventory zero; processor approval and credentials unverified | every commercial gate in Directive 03 passes | BLOCKED / commerce closed |
| P0 | Engineering | subscription authorization | endpoint previously lacked a server billing gate | `BILLING_ENABLED` must be exactly `true` before any auth, DB, or Stripe operation | PASS at `b5b9034` |
| P1 | Engineering / content | Pep Talk | deterministic UI claimed unavailable account/order/subscription value | identify deterministic behavior, retain medical refusal, state preview limitations | PASS at `b5b9034` |
| P1 | Engineering | keyboard accessibility | dialog returned focus but did not contain focus | Tab and Shift+Tab remain within open dialog; Escape closes and restores focus | FIXED LOCALLY; browser check BLOCKED |
| P1 | XENTH admin | Netlify ownership | public API exposes account name only; local CLI is not authenticated | confirm `admin@xenthgroup.com` has owner/admin access and document rollback | BLOCKED |
| P1 | XENTH admin | Cloudflare ownership | DNS and registrar are Cloudflare; local CLI is not authenticated | confirm destination account and zone access without changing DNS | BLOCKED |
| P1 | Operations | inquiry delivery | form blueprint and endpoint certify; notification recipient not visible | submit marked test, confirm receipt, delete test record | BLOCKED — external side effect/owner access |
| P1 | Engineering | browser certification | browser security policy could not be verified | desktop/tablet/mobile, keyboard, links and console pass in real browser | BLOCKED |
| P1 | Operations | observability and recovery | no analytics, monitoring, alerting, backup owner, or runbook verified | owners, alerts, retention, backup restore test documented | BLOCKED |
| P2 | Content / engineering | documentation | prior handoff describes the older inquiry-only main build | reconcile documentation with this board and deployed state | IN PROGRESS |
| P2 | Engineering | performance and assets | no measured Lighthouse/browser result | capture mobile/desktop performance and optimize material regressions | BLOCKED by browser |
| P3 | Product | COMMAND analytics/settings | explicit future-state copy in console | scope only after real operations exist | DEFERRED |

## 6. Removal candidates

No source file is currently proven obsolete. `forms 2.html` looks oddly named but is the deployed Netlify Forms registration blueprint and is covered by certification; do not remove it. Old repositories, archives, lanes, deployments, Supabase projects, and branches must not be deleted until ownership, active traffic, rollback, and Founder authorization are recorded.

## 7. Security risks

- Production/candidate drift can place an uncertified or stale build on the canonical domain.
- No live Everlume RLS/customer-isolation test is possible without a dedicated backend.
- Stripe webhook handling verifies signatures and upserts subscriptions, but a complete idempotency/reconciliation/refund/order-entitlement battery has not passed against a live processor.
- Billing redirect origins currently derive from request headers; before commerce, use a fixed approved site origin or strict allowlist.
- Terms are a legal draft; public launch would misrepresent approval.
- Monitoring, alert routing, incident ownership, and backup restoration are unverified.

## 8. Cost risks

- Supabase project plan, database retention, Auth email/SMTP, and log retention are unverified.
- Netlify function, form, bandwidth, and build usage ownership is unverified.
- Stripe pricing, disputes, refunds, taxes, and subscription reconciliation ownership are unverified.
- Email delivery, analytics, monitoring, and alerting vendors are not selected or costed.

## 9. Account and infrastructure ownership map

| Service | Observed | Administrative ownership |
| --- | --- | --- |
| GitHub | `everlumepep/everlume`; current viewer has WRITE; commits authored by `admin@xenthgroup.com` / `XENTHGRP` | partial verification; organization owner still unconfirmed |
| Netlify | account `Everlume`, site `everlume1` | exact owner and `admin@xenthgroup.com` access unconfirmed |
| Cloudflare / registrar | authoritative DNS and registrar for `myeverlume.com` | exact account owner and destination access unconfirmed |
| Supabase | XENTH org; dedicated `Everlume` project `zyerhqcqxcjdnfmdbutg`, `ACTIVE_HEALTHY`, $0/month reported | project identity and schema verified; exact administrative owner identity still unrecorded |
| Stripe | functions exist | account, approval, mode, owner, and credentials unconfirmed |
| Email | Netlify form delivery expected | routing and recipient unconfirmed |
| Analytics / monitoring | none verified | unassigned |

## 10. Environment-variable inventory

| Variable | Scope | Required state |
| --- | --- | --- |
| `SUPABASE_URL` | public runtime + functions + live tests | dedicated Everlume project URL |
| `SUPABASE_ANON_KEY` | public runtime + functions + live tests | active publishable/anon credential only |
| `SUPABASE_SERVICE_ROLE_KEY` | functions + live tests | secret, server/test environment only |
| `BILLING_ENABLED` | public runtime + server subscription gate | absent/false for controlled preview |
| `STRIPE_SECRET_KEY` | functions | absent until commercial approval; secret only |
| `STRIPE_WEBHOOK_SECRET` | webhook function | absent until endpoint approved/configured; secret only |
| `EVERLUME_TEST_STAMP` | optional live-test isolation | test-only |

No analytics, monitoring, email-provider, or fixed production-origin variables are implemented.

## 11. Verification results

| Verification | Result |
| --- | --- |
| Source tests | PASS — 22/22 at `b5b9034` |
| Static validation | PASS — 50 files, 15 pages |
| Offline migrations / invariants | PASS — 42/42 after function-boundary hardening |
| Dependency audit | PASS — 0 known vulnerabilities |
| Exact hardened PR preview public certification | PASS — 60/60 at `b5b9034`; deploy `6a86ff875bcf430008283699` |
| Production public certification | FAIL — 59/60; stale catalog/pricing build |
| Authentication / password recovery | BLOCKED — project exists but preview/Auth URLs/email are not configured and live flow is untested |
| Customer isolation / privilege refusal | PASS offline; BLOCKED live |
| Product authorization / inventory invariants | PASS offline |
| Order creation | PASS offline; BLOCKED live |
| Stripe payment / webhook / refund / reconciliation | BLOCKED |
| Account deletion | PASS offline; BLOCKED live |
| Desktop / tablet / mobile / keyboard / browser console | BLOCKED — browser policy check unavailable |
| Broken public surfaces and protected paths | PASS in 60-check network battery |
| Metadata / no-index / security headers | PASS |
| Performance | UNTESTED |
| Production smoke | FAIL due source drift; remaining network checks pass |

## 12. User-journey and commercial-loop results

`LAND → UNDERSTAND → ENTER → EXPLORE → SELECT FORMAT → SAVE LOCALLY OR INQUIRE` is supported by source and public network checks. Real browser interaction and form receipt remain blocked.

`CREATE ACCOUNT → RECEIVE VALUE → RETURN` is blocked because no Everlume backend is connected.

`SELECT → CART → CHECKOUT → PAYMENT → ORDER → ENTITLEMENT → FULFILLMENT → ACCOUNT → RENEW/CANCEL` is intentionally closed and not certified. The release must not be described as Commerce V1.

## 13. Binary launch checklist

- [x] Canonical repository, branch, and directive commit identified
- [x] Active branch reconciled with `main`
- [x] Preview network certification passes
- [x] Offline database invariants pass
- [x] Dependency audit passes
- [x] Local P0/P1 fixes committed and preview-deployed at `b5b9034`
- [ ] Real-browser desktop/tablet/mobile/keyboard/console certification passes
- [ ] Dedicated Everlume Supabase project exists and is migrated; preview connection, Auth configuration, and live battery remain
- [ ] Inquiry delivery owner and receipt verified
- [ ] Monitoring, alerting, backup, and recovery verified
- [ ] Terms/legal approval recorded
- [ ] Netlify, Cloudflare, Supabase, Stripe, email, and monitoring authority consolidated
- [ ] Founder approves exact certified commit and release state
- [ ] Production deploys exact certified commit
- [ ] Production smoke and release receipt pass

## 14. Exact execution order

1. Review and commit only the scoped P0/P1 changes; do not include the untracked `AGENTS.md` unless explicitly authorized.
2. Push the active branch and let PR #4 create a fresh Netlify preview.
3. Rerun source, migration, dependency, and 60-check preview certification.
4. Complete desktop/tablet/mobile, keyboard, console, broken-link, and performance checks.
5. Confirm Netlify and Cloudflare control under `admin@xenthgroup.com`; make no ownership or DNS change yet.
6. Provision or explicitly select a dedicated Everlume Supabase project; do not reuse COMMAND or North Star by assumption.
7. Apply all migrations, configure Auth URLs/email, and run the live verification battery.
8. Verify a marked Netlify inquiry reaches the approved recipient; remove the test record.
9. Obtain legal, commercial, operational, and Founder approvals. Keep commerce disabled unless every gate passes.
10. Merge the exact certified PR commit to `main`, preserve `65a2ac8` as rollback, and deploy through the existing Netlify project.
11. Run production smoke/certification and record commit, deploy ID, timestamp, approver, and rollback point.

## 15. Rollback plan

Current rollback point: Netlify production deploy `6a8682629962070009eaf22c`, Git commit `65a2ac8`. Before release, record the new deploy ID and verify Netlify rollback access. If production smoke fails, restore the prior deploy without changing DNS, confirm `myeverlume.com` serves `65a2ac8`, rerun the public battery, and keep commerce disabled. Database or ownership cutovers require a separate tested restore plan and Founder approval; none are authorized by this report.

## 16. Final recommendation

**NO-GO.** Keep the exact static candidate available only as a non-production preview. Do not release to production until Netlify ownership is authenticated, the preview-only backend and Auth/email configuration are complete, live and browser batteries pass, monitoring and recovery are proven, legal approval is recorded, and the Founder approves the exact candidate. Commerce V1 remains a separate no-go decision.
