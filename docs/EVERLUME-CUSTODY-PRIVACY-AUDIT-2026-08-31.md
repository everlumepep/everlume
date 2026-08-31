# Everlume Custody and Privacy Audit — August 31, 2026

## Ownership target

- Denisha Phillips — co-owner, 50%
- Veronicah Williams — co-owner, 50%
- Shared company identity — `everlume.admin@gmail.com`, displayed as **Everlume Admin**
- Xenth — account manager and scoped technical collaborator, not a business owner or billing owner

Equal business ownership does not prove equal administrator access inside every third-party provider. Provider access must be verified separately.

## Verified

- Supabase shared account is email-confirmed, active, labeled **Everlume Admin**, and assigned the `admin` role.
- Personal Xenth test accounts `admin@xenthgroup.com` and `mderby5@gmail.com` were removed from Supabase after confirming that neither held orders, inquiries, addresses, or subscriptions.
- The public website and client handoff package contain no Michael Derby, Xenth personal-email, or `XENTHGRP` identifiers.
- GitHub repository ownership is held by the `everlumepep` organization. `XENTHGRP` has contributor access but is not an owner.
- No embedded live Stripe secret, saved card, or privileged Supabase credential is intentionally included in the public/client source package. Test fixtures remain nonproduction test data.

## Requires authenticated provider verification

| Provider | Required check | Current result |
|---|---|---|
| Netlify | Confirm Everlume owner identity, billing owner, payment method, recovery, and Xenth access level | Unverified — local session signed out |
| Stripe | Confirm business representative, owners, bank/payout account, billing contacts, payment methods, recovery, and remove Xenth personal data where replacement ownership is established | Unverified |
| Shippo | Confirm account owner, sender/return identity, billing method, recovery, and remove Xenth personal or payment data | Unverified |
| Cloudflare | Recover the controlling account, confirm domain owner, billing method, recovery, and remove Xenth ownership/payment responsibility after safe transfer | Blocked pending account recovery |
| GitHub organization | Confirm Denisha and Veronicah have the intended owner/admin access and recovery coverage | Repository owner organization verified; individual org ownership unverified |
| Google | Confirm both co-owners control recovery and MFA for the shared company account | Shared identity recorded; recovery/MFA sharing unverified |

## Removal rule

Do not remove a billing owner, payment method, recovery channel, domain custodian, or sole administrator until the Everlume-owned replacement is verified. Each removal must be followed by a fresh sign-in or access test and recorded evidence.
