# EVERLUME DIRECTIVE 04 — CONTROLLED RELEASE CERTIFICATION

**Issued:** 2026-08-20  
**Status:** ACTIVE — PRODUCTION NO-GO  
**Canonical repository:** `everlumepep/everlume`  
**Candidate branch:** `mderby5/everlume-photographic-vials`  
**Audited baseline:** `5b81573`  
**Release authority:** `docs/RELEASE-CERTIFICATION.md`

## Command

Advance Everlume from audited and locally hardened to a fully certified controlled
preview. Do not promote production and do not enable commerce until every applicable
gate in the master release board passes and Founder approval is recorded.

The current honest product is a premium research catalog with local saved lists,
deterministic catalog guidance, policies, and inquiries. Accounts, subscriptions,
rewards, cross-device data, payments, fulfillment, and live COMMAND operations must
not be represented as available until their complete systems are provisioned and
certified.

## P0 — Certify the exact candidate

1. Review the scoped local hardening changes and separate them from unrelated files.
2. Run the full 22-test source suite, 41-check migration/security suite, dependency
   audit, static validation, and 60-check public preview battery.
3. Create a fresh non-production preview from the exact reviewed candidate.
4. Record the candidate commit and preview deployment ID in the master release board.
5. Do not merge, push, deploy, or alter production under this directive without the
   explicit authorization required for that action.

## P0 — Establish dedicated Everlume infrastructure

1. Confirm administrative ownership for GitHub, Netlify, Cloudflare, Supabase, Stripe,
   inquiry email, monitoring, and backups under the approved XENTH administrator.
2. Provision or explicitly select a dedicated Everlume Supabase project. Never reuse
   XENTH COMMAND or North Star infrastructure by assumption.
3. Apply the 11 ordered migrations and certify Auth, RLS, customer isolation, role
   refusal, inventory invariants, order state, audit records, and account deletion.
4. Configure approved Auth URLs and transactional email. Keep service credentials on
   server-only surfaces.
5. Keep `BILLING_ENABLED` absent or false. Stripe credentials remain absent until a
   separate commercial approval is recorded.

## P1 — Complete controlled-preview certification

1. Verify desktop, tablet, and mobile behavior in a real browser.
2. Verify keyboard navigation, Pep Talk focus containment/restoration, visible focus,
   Escape behavior, links, forms, console output, and reduced-motion behavior.
3. Submit one clearly marked inquiry test, confirm delivery to the approved recipient,
   and remove the test record.
4. Measure performance and remediate material regressions.
5. Establish monitoring, alert routing, incident ownership, log retention, backups,
   restore testing, and rollback access.
6. Finalize legal terms and record the approving authority and version.

## Production and commerce gates

Production may be promoted only when:

- The exact candidate commit has passed every controlled-preview check.
- Netlify and Cloudflare ownership and rollback access are verified.
- The dedicated Everlume backend and live security battery pass.
- Inquiry delivery, monitoring, backups, restore, and incident ownership pass.
- Final legal approval and Founder approval are recorded.
- Production deploys the exact certified commit and passes all 60 public checks.

Commerce remains a separate NO-GO until Stripe ownership and approval, live-mode
credentials, fixed approved origins, product authorization, inventory, taxes, refunds,
webhooks, reconciliation, fulfillment, entitlements, subscriptions, cancellation,
monitoring, and commercial approval all pass end to end.

## Preservation and cleanup rule

Do not delete repositories, archives, lanes, deployments, projects, branches, forms,
or infrastructure merely because they appear stale. First prove ownership, traffic,
dependency, rollback value, and replacement. Record explicit Founder authorization
before destructive removal. `forms 2.html` remains required for Netlify Forms.

## Required release record

The release owner must record:

- repository, branch, exact commit, PR, and deployment ID;
- test results and unresolved exceptions;
- infrastructure and account owners;
- legal, operational, commercial, and Founder approvals;
- production timestamp and smoke-test result;
- rollback commit, deployment ID, owner, and restoration result.

## Stop conditions

Stop the release if source identity drifts, a required owner cannot authenticate, the
backend is shared or unverified, browser certification is blocked, legal terms remain
draft, monitoring or restore is unproven, commerce becomes reachable prematurely, or
the exact candidate lacks Founder approval.

## Definition of done

Everlume is complete for controlled release only when the exact certified candidate is
deployed, the public and live-backend batteries pass, ownership and recovery are proven,
approvals are recorded, and production honestly exposes only the capabilities that are
operational. Commerce completion requires its own subsequent approval.
