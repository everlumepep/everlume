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
| Netlify | Confirm Everlume identity, plan, invoices, and stored payment method | Verified August 31: **Everlume Admin**, Free plan, no card saved, no invoices, and no overdue balance |
| Stripe | Replace the payout bank, account representative, ownership details, personal recovery data, and any Xenth security method | **Open:** payout bank and Xenth legal representative remain until a founder supplies verified replacements; no Stripe invoice history was present |
| Shippo | Confirm account owner, billing method, invoices, sender/return identity, and recovery | Verified August 31: Everlume Google access connected; no payment method or invoice present. Sender/return details still require client entry |
| Cloudflare | Replace personal payment and billing information without interrupting domain renewal | **Open:** the only invoice shown is paid; one Xenth card and billing address remain because no Everlume replacement card is on file |
| GitHub organization | Confirm Denisha and Veronicah have the intended owner/admin access and recovery coverage | Repository owner organization verified; individual org ownership unverified |
| Google | Confirm both co-owners control recovery and MFA for the shared company account | Shared identity recorded; recovery/MFA sharing unverified |

## Stripe founder replacement instructions

**Priority #1 for client handoff.**

The existing payout destination and Xenth legal representative have **not** been removed. A founder must complete the following directly in Stripe before Xenth information can be safely deleted:

1. Denisha Phillips or Veronicah Williams signs in through the Everlume-controlled account.
2. Add and verify an Everlume-owned payout bank account.
3. Replace the account representative with the appropriate founder and provide Stripe's legally required identity information directly to Stripe.
4. Record both founders' 50/50 ownership wherever Stripe requests beneficial-owner information.
5. Complete Stripe's outstanding business-information review before its displayed deadline.
6. Test access and confirm the new payout destination is active.
7. Only after those checks pass, remove the prior payout bank, Xenth representative record, personal recovery method, and any Xenth security credential.

No bank number, government identifier, password, passkey, recovery code, or authentication code belongs in this handoff package.

The Xenth backup email removal was initiated on August 31, 2026, but Stripe requires the account owner to complete its verification prompt before the deletion can be certified.

## Removal rule

Do not remove a billing owner, payment method, recovery channel, domain custodian, or sole administrator until the Everlume-owned replacement is verified. Each removal must be followed by a fresh sign-in or access test and recorded evidence.
