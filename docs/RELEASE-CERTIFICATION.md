# Everlume — (X) MASTER Release Candidate

**Audit date:** 2026-08-20  
**Certified source:** `everlumepep/everlume` · `mderby5/everlume-photographic-vials` · `494835ad6ab24fb9107a8117426439d179be45e7`
**Connected preview:** Netlify deploy `6a87431c8d0cee0008ef716c` · `https://deploy-preview-5--everlume1.netlify.app`
**Release recommendation:** **NO-GO.** The exact technical preview passes, including authenticated administrator COMMAND. Custody/recovery, Firefox and physical-device coverage, keyboard/screen-reader evidence, real recovery-email delivery, data restoration, proactive monitoring, legal, and Founder gates remain open. Commerce remains stopped.

This is the authoritative completion board for Directive 03. `PASS` means evidence was collected. `BLOCKED` and `UNTESTED` never mean pass.

## Directive 04 execution receipt — 2026-08-20

**Release status: STOPPED — PRODUCTION NO-GO.**

- Source identity reverified: canonical folder, remote, branch, and baseline commit all match.
- The directive's `b5b9034` is the hardened security baseline. Git ancestry proves the linear chain `b5b9034 → 4e7e746 → e3c1fe5 → 2e94ab4 → 4d5def5 → 14619fa → 195cbf7 → 801b956 → 494835a`.
- Scoped working tree reverified at pushed candidate `494835a`; unrelated `AGENTS.md` and `supabase/.temp/` remain excluded.
- Source suite: **PASS — 23/23** after adding the COMMAND identity regression guard.
- Offline migrations and security invariants: **PASS — 43/43** across 13 ordered migrations, including the locally uncommitted performance-advisor remediation.
- Dependency audit: **PASS — 0 known vulnerabilities**.
- Exact PR #5 preview network battery: **PASS — 60/60** at commit `494835a`, Netlify deployment `6a87431c8d0cee0008ef716c`.
- Dedicated backend: **PASS for connection/schema boundary** — preview-only Netlify variables resolve to Supabase `Everlume` (`zyerhqcqxcjdnfmdbutg`); production values remain empty; the project is `ACTIVE_HEALTHY`, has 13 live migrations, 18 public tables, and RLS on all 18.
- Security advisor: **7 WARN** — anonymous and authenticated execution exposure for `is_staff`, `is_manager`, and `is_admin`, plus authenticated execution for the intentionally role-checking/audited `adjust_inventory` RPC. No advisor warning is silently treated as a pass.
- Performance advisor remediation: **APPLIED LIVE / COMMITTED** at `494835a` — all 10 unindexed foreign-key and all 14 per-row Auth/RLS notices cleared. Remaining: 35 intentional overlapping-policy notices and 24 unused-index notices on an almost-empty preview database.
- Corrective security migration: **APPLIED LIVE / COMMITTED AND PUSHED** at `b5b9034`.
- Anonymous live authorization: **PASS** — identity RPCs return `false`, inventory mutation returns 401, and protected profile/audit reads return zero rows.
- Auth configuration: **PASS** — Site URL `https://myeverlume.com`; exact PR preview and Netlify deploy wildcard allowed; email sign-up enabled; confirmation required; anonymous sign-in disabled. Default templates are active; custom SMTP/branding is not configured.
- Authenticated live RLS battery: **PASS for tested customer/staff/manager/admin boundaries** — three `.invalid` accounts established sessions; customer isolation, privilege escalation refusal, staff visibility, manager inventory enforcement/attribution, and admin role-management/restore passed. Account deletion was not run because deletion was explicitly prohibited.
- Password recovery: **PARTIAL** — approved redirect configured; Supabase correctly refused reserved `.invalid`/`example.com` delivery addresses, so real delivery remains unproved without authorization to send to an owned inbox.
- Authenticated browser: customer sign-in/account portal and ordinary-customer COMMAND refusal passed. Administrator COMMAND passed in exact deploy `6a87431c8d0cee0008ef716c` after scoping the profile query to the signed-in user; regression coverage passes.
- Netlify ownership: **PASS** — `everlume.admin@gmail.com` / DENISHA P is the sole Owner; rollback/deploy history is accessible. Recovery is **FAIL** because the sole owner has no 2FA and no second recovery owner.
- GitHub custody: **PARTIAL** — authenticated viewer `XENTHGRP` has WRITE to `everlumepep/everlume`; repository-owner/admin custody remains unproved.
- Cloudflare: authoritative nameservers verified; account/zone custody remains unproved.
- Monitoring: Netlify observability and GitHub deploy checks exist; email failure alerts require a paid plan and no form-delivery webhook is configured. Escalation owner is not formally approved.
- Production hosting was not changed during this run. Commerce remains disabled.

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
| Hardened baseline | `b5b9034` | PASS — superseded |
| Current candidate | `494835ad6ab24fb9107a8117426439d179be45e7` | PASS |
| Pull request | PR #5 open and unmerged; head `494835a` | PASS — review only |
| Netlify project | `everlume1`, team `everlume-admin`, owner `everlume.admin@gmail.com` | PASS |
| Production source | `main` merge `780249bf46e0b1e7ddd43ce26899833141f99f28`; deploy `6a871f9299c9d8000863e666` | OBSERVED — not promoted during this run |
| Preview source | PR #5 head `494835a`; connected deploy `6a87431c8d0cee0008ef716c` | PASS |
| Production domain | `myeverlume.com` | PASS |
| DNS / registrar | Cloudflare; `nick.ns.cloudflare.com`, `uma.ns.cloudflare.com`; routes to Netlify | PASS |
| Preview/backend boundary | only Deploy Previews have Supabase URL/publishable key; production is empty; billing false | PASS |

Authoritative chain today:

`GitHub main@780249b → Netlify production 6a871f9299c9d8000863e666 → myeverlume.com → Supabase runtime values empty`

Candidate chain:

`GitHub PR #5 / branch@494835a → Netlify 6a87431c8d0cee0008ef716c → Supabase Everlume zyerhqcqxcjdnfmdbutg (preview-only)`

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
- Account, password recovery, portal, rewards/referrals, subscriptions, and COMMAND interfaces are implemented and the preview has backend credentials; Auth URL/email configuration and authenticated certification remain blocked on Supabase dashboard access.
- Commerce tables, state machines, inventory controls, audit trails, server price lookup, Stripe functions, and webhook signature checks are implemented but not certified as a complete commercial loop.
- Public deployment boundary, security headers, no-index posture, static validation, and offline migration invariants pass.

## 5. Master completion board

| Priority | Owner | Surface | Evidence | Acceptance criteria / verification | Status |
| --- | --- | --- | --- | --- | --- |
| P0 | XENTH release owner | candidate identity | preview `801b956` / `6a873a67c7878a5bdba432ff`; production merge `780249b` / `6a871f9299c9d8000863e666` | Founder must decide against the exact recorded identities; no further production action before approvals | PASS identity / NO-GO release |
| P0 | XENTH / Supabase owner | accounts, saved data, COMMAND | dedicated project is connected to preview only; 13 migrations; 18/18 RLS; anonymous refusal probes pass | configure Auth URLs/email and pass authenticated live verification | IN PROGRESS |
| P0 | Founder / legal | terms and public authority | Terms v1.0 is marked draft | written approval and final policy version | BLOCKED |
| P0 | Founder / commercial owner | commerce | products pending review; inventory zero; processor approval and credentials unverified | every commercial gate in Directive 03 passes | BLOCKED / commerce closed |
| P0 | Engineering | subscription authorization | endpoint has a server billing gate; preview and production runtime both report billing false | `BILLING_ENABLED` must remain false until separate commerce approval | PASS at `801b956` |
| P1 | Engineering / content | Pep Talk | deterministic UI claimed unavailable account/order/subscription value | identify deterministic behavior, retain medical refusal, state preview limitations | PASS at `b5b9034` |
| P1 | Engineering | keyboard accessibility | dialog returned focus but did not contain focus | Tab and Shift+Tab remain within open dialog; Escape closes and restores focus | FIXED LOCALLY; browser check BLOCKED |
| P1 | XENTH admin | Netlify ownership | `everlume.admin@gmail.com` / DENISHA P is sole Owner; deploy and rollback history accessible | add 2FA and independent recovery owner | PARTIAL — custody pass, recovery fail |
| P1 | XENTH admin | Cloudflare ownership | DNS and registrar are Cloudflare; local CLI is not authenticated | confirm destination account and zone access without changing DNS | BLOCKED |
| P1 | Operations | inquiry delivery | form blueprint and endpoint certify; notification recipient not visible | submit marked test, confirm receipt, delete test record | BLOCKED — external side effect/owner access |
| P1 | Engineering | browser certification | Chromium DOM/navigation smoke passes; authenticated flow and required Safari/Firefox/iPhone/tablet/screen-reader matrix not completed | complete real device/browser matrix after Auth configuration | PARTIAL |
| P1 | Operations | observability and recovery | Netlify observability and GitHub checks available; paid email alerts/form webhook, backup export, restore drill, and approved escalation owner absent | owners, alerts, retention, backup restore test documented | BLOCKED |
| P2 | Content / engineering | documentation | MASTER board reconciled locally with exact connected preview and current infrastructure | review, authorize commit/push, and preserve evidence | UPDATED LOCALLY / UNCOMMITTED |
| P2 | Engineering | performance and assets | 10 FK and 14 Auth/RLS notices remediated; 35 policy-overlap and 24 unused-index notices dispositioned | measure browser performance after Auth is configured; retain indexes until representative traffic exists | PARTIAL |
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
| GitHub | `everlumepep/everlume`; authenticated viewer `XENTHGRP` has WRITE; repository owner is `everlumepep` | write custody verified; repository admin/recovery owner unconfirmed |
| Netlify | team `everlume-admin`, project `everlume1`; DENISHA P / `everlume.admin@gmail.com` is sole Owner | owner and rollback access verified; no 2FA or second recovery owner |
| Cloudflare / registrar | authoritative DNS and registrar for `myeverlume.com` | exact account owner and destination access unconfirmed |
| Supabase | XENTH org; dedicated `Everlume` project `zyerhqcqxcjdnfmdbutg`, `ACTIVE_HEALTHY`; 13 migrations; 18/18 RLS | connector access verified; dashboard owner identity, Auth configuration, and recovery admin unrecorded |
| Stripe | functions exist | account, approval, mode, owner, and credentials unconfirmed |
| Email | Netlify form capture exists; no form-submission webhook configured | routing, recipient, and delivery receipt unconfirmed |
| Analytics / monitoring | Netlify observability and GitHub deploy checks exist; proactive failure email is paywalled on current plan | escalation owner and incident response remain unapproved |

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
| Source tests | PASS — 23/23 with local COMMAND regression fix |
| Static validation | Prior PASS — current repository contains 51 required files / 16 pages |
| Offline migrations / invariants | PASS — 43/43 after performance remediation |
| Dependency audit | PASS — 0 known vulnerabilities |
| Exact connected PR preview public certification | PASS — 60/60 at `801b956`; deploy `6a873a67c7878a5bdba432ff` |
| Production identity | OBSERVED — merge `780249b`, deploy `6a871f9299c9d8000863e666`; not altered during this run |
| Authentication / password recovery | Auth URL/email policy PASS; recovery redirect configured; delivery to an owned inbox remains blocked |
| Customer isolation / privilege refusal | PASS offline and live for customer/staff/manager/admin test boundaries |
| Product authorization / inventory invariants | PASS offline |
| Order creation | PASS offline; BLOCKED live |
| Stripe payment / webhook / refund / reconciliation | BLOCKED |
| Account deletion | PASS offline; BLOCKED live |
| Desktop / tablet / mobile / keyboard / browser console | Chromium sign-in/account/customer-refusal PASS; deployed admin COMMAND FAIL due identity-query bug; Safari/Firefox/iPhone/tablet/screen-reader matrix BLOCKED |
| Broken public surfaces and protected paths | PASS in 60-check network battery |
| Metadata / no-index / security headers | PASS |
| Performance | Advisor material findings remediated; Lighthouse and representative-load measurements remain open |
| Production smoke | Not part of this non-production authorization; production identity preserved |

## 12. User-journey and commercial-loop results

`LAND → UNDERSTAND → ENTER → EXPLORE → SELECT FORMAT → SAVE LOCALLY OR INQUIRE` is supported by source and public network checks. Real browser interaction and form receipt remain blocked.

`CREATE ACCOUNT → RECEIVE VALUE → RETURN` remains blocked because the preview backend is connected but Auth URLs/email and authenticated live behavior are not certified.

`SELECT → CART → CHECKOUT → PAYMENT → ORDER → ENTITLEMENT → FULFILLMENT → ACCOUNT → RENEW/CANCEL` is intentionally closed and not certified. The release must not be described as Commerce V1.

## 13. Binary launch checklist

- [x] Canonical repository, branch, and directive commit identified
- [x] Active branch reconciled with `main`
- [x] Preview network certification passes
- [x] Offline database invariants pass
- [x] Dependency audit passes
- [x] Current connected preview identified at `801b956` / `6a873a67c7878a5bdba432ff`
- [x] Preview-only Supabase connection verified; production variables empty
- [x] Material Supabase performance notices remediated live; local migration uncommitted
- [ ] Real-browser desktop/tablet/mobile/keyboard/console certification passes
- [ ] Dedicated Everlume Supabase project exists, is migrated, and is preview-connected; Auth configuration and authenticated battery remain
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

Current production identity: Netlify deploy `6a871f9299c9d8000863e666`, Git merge `780249bf46e0b1e7ddd43ce26899833141f99f28`. Preserved prior production rollback: Netlify deploy `6a8682629962070009eaf22c`, Git commit `65a2ac8f61d3595e5258cd3c5a747be4d651307e`. Connected preview rollback: deploy `6a871c4b471fef0008980754` at `801b956` before preview environment variables; current connected preview is `6a873a67c7878a5bdba432ff`. Netlify Owner access can reach deploy history, but no rollback was executed. If a future authorized production smoke fails, restore the explicitly approved prior deploy without changing DNS, rerun the public battery, and keep commerce disabled. The database performance migration is additive/equivalent-policy work; database restore or rollback remains separately blocked pending a tested export/restore procedure and Founder approval.

## 16. Final recommendation

**NO-GO.** The exact connected preview is `801b956` / `6a873a67c7878a5bdba432ff`. Do not perform any further production release action until Supabase Auth/email configuration, authenticated RLS isolation, cross-browser/device/accessibility, inquiry delivery, monitoring/escalation, backup restore, Cloudflare custody, legal approval, and Founder approval are evidenced. Commerce V1 remains a separate no-go decision and stays disabled.
