# Everlume Closure Evidence — August 26, 2026

## Completed

- Preview 5 website and read-only operations dashboard prepared for client review
- Shared company service account `everlume.admin@gmail.com` verified, renamed to **Everlume Admin**, and authorized for the read-only operations desk
- Business ownership recorded as Denisha Phillips (co-owner, 50%) and Veronicah Williams (co-owner, 50%)
- Supabase and Netlify preview credentials aligned to the Everlume project
- Stripe test-mode integration present and fail-closed when preview billing is disabled
- Client-confirmed catalog entries recorded: Semax available at $30; Lipo C available at $45
- Affiliate Pilot added with application, manual approval, unique code/link, and pending-estimate view
- Affiliate payouts and complex settlement functions explicitly excluded
- Client-controlled Shippo Starter workspace created under the Everlume company login and linked from the operations desk
- Shipping module records the $0 monthly platform fee, up-to-30-label Starter allowance, multi-carrier rate comparison, and 4 × 6 thermal-label target
- Shipping module includes a four-step manual fulfillment workflow, identifies API order sync as not connected, and records local pickup/arranged drop-off as owner-confirmed
- Checkout records shipping or local pickup/arranged drop-off preference without promising automatic mileage eligibility
- Requested public catalog presentation uses `TR` and `RT` abbreviations while governed internal records retain full product names
- Postage purchases, sender/return-address entry, saved payment methods, carrier contracts, and production fulfillment remain owner-controlled actions
- Final automated proofread guard added for known errors and U.S. English policy variants
- Full site validation and database migration/invariant verification passed before publication

## Evidence

- Application test suite: 50 tests passed
- Database/invariant verification: 46 checks passed
- Static validation: 53 required files and 16 pages passed
- Live Supabase verification: `affiliate_applications` and `affiliate_commissions` tables present; public and private review functions present; migration `20260826105743` recorded
- Supabase security advisor: no affiliate/RLS findings; existing project warning remains for leaked-password protection being disabled

## Awaiting human completion

1. Everlume returns written acceptance of Preview 5 using `EVERLUME-PREVIEW-5-ACCEPTANCE.md` or equivalent email language.
2. The client enters verified real inventory.
3. Confirm the sender/return address and phone number before entering either into Shippo; then select the owners’ physical 4 × 6 thermal printer model when available.
4. Locate or recover the Cloudflare account that actually controls `myeverlume.com`, export the live DNS zone, establish an Everlume-controlled destination account, and complete a witnessed registrar/zone handoff without disrupting the website or email.
5. Production commerce, product publication/compliance approval, production-domain release, postage purchases, carrier contracts, and affiliate payouts remain separately held.

## Support handoff

Support is governed by `EVERLUME-SUPPORT-TERMS.md`. Xenth remains Everlume’s account manager. The 14-calendar-day included transition-support period runs from September 1 through September 14, 2026; beginning September 15, 2026, ongoing maintenance requires an active paid Xenth maintenance subscription or separately approved written scope.
