# Everlume Access Register — August 31, 2026

This register records custody without passwords, passkeys, secret keys, recovery codes, or payment details.

## Company identity

- Company service login: `everlume.admin@gmail.com`
- Display name: Everlume Admin
- Business owners: Denisha Phillips (50%) and Veronicah Williams (50%)
- Shared-account use should be replaced with individual `@myeverlume.com` identities when the owners approve and fund managed email.

## Service register

| Service | Current role | Handoff state | Owner action |
|---|---|---|---|
| Google | Company service identity | Active | Maintain recovery methods and MFA |
| GitHub | Source repository | Everlume organization repository present | Confirm both owners have appropriate organization access |
| Netlify | Preview hosting | Preview 5 available | Keep production promotion held until written authorization |
| Supabase | Auth and operational data | Everlume Admin authorized | Create individual founder accounts later if desired |
| Stripe | Test payment foundation | Test/readiness only | Complete live business verification and authorize production separately |
| Shippo | Shipping workspace | Starter workspace connected through dashboard | Add sender/return address, phone, and payment method before first label |
| Cloudflare | Domain and DNS custody | Controlling account not yet verified | Recover source account, export DNS, and transfer to Everlume custody |

## Security boundary

No credential is included in this package. Passwords, passkeys, API keys, one-time codes, recovery codes, and payment information must be exchanged only through the provider’s secure account and recovery flows.

The live custody and payment-method verification status is maintained in `EVERLUME-CUSTODY-PRIVACY-AUDIT-2026-08-31.md`. Equal 50/50 business ownership must not be confused with verified owner/admin access in each provider.
