# Everlume Three-Pass Quality-Assurance Standard

Status: required for every client-facing release, handoff revision, and production change

No Everlume release is described as complete until all three passes are recorded. A pass must be repeated when a later change affects its scope.

## Pass 1 — Content and presentation

- Review all customer-facing wording for clear U.S. English, spelling, grammar, punctuation, consistency, and Everlume voice.
- Verify names, ownership-neutral shared-account labels, prices, abbreviations, policy dates, links, imagery, alignment, responsive scaling, and accessibility copy.
- Confirm that private information, credentials, payment details, draft notes, and internal-only names are absent from public and client-facing artifacts.

## Pass 2 — Functional and security verification

- Run the complete automated application, database, migration, security, and static-validation suites.
- Test navigation, authentication, role restrictions, checkout boundaries, local-fulfillment preference, dashboard modules, Shippo launcher, Stripe test controls, and fail-closed behavior.
- Confirm that real inventory, production commerce, publication approval, and external payments remain held unless separately authorized.

## Pass 3 — Release and handoff verification

- Verify the exact pushed commit and deployed preview rather than relying on a local build.
- Recheck website, dashboard, account identity, access register, support dates, handoff package, and rollback reference.
- Record outstanding third-party custody, billing, payment-method, recovery, domain, and owner-admin actions without marking them complete prematurely.

## Evidence requirement

Each pass must record the date, reviewer, exact artifact or commit, checks performed, findings, corrections, and final result. All three results must be `PASS` before release; `PARTIAL`, `HOLD`, or `UNVERIFIED` is not a pass.
