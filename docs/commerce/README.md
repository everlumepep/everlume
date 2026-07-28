# XCOP-COMMERCE-CONTRACT-v1

**Status:** 🟢 **ENGINEERING READY**
**Baseline:** `d73075e` · **Prepared for:** Sonnet execution
**Authority:** specification only — no implementation, no processor
integration, no production change.

Converts [`../COMMERCE-ARCHITECTURE.md`](../COMMERCE-ARCHITECTURE.md) into an
engineering-complete contract.

| # | Contract | Closes |
| --- | --- | --- |
| [01](01-order-state-machine.md) | **Order State Machine v1** — states, legal transitions, actor authority, invariants, guard enforcement | **P0-15.2** |
| [02](02-inventory-reservation-contract.md) | **Inventory Reservation Contract v1** — reserve/release/commit, concurrency, expiry, oversell, recovery | **P0-15.1** |
| [03](03-payment-adapter-contract.md) | **Payment Adapter Contract v1** — processor-neutral boundary, idempotency, webhook rules, `FakeAdapter` | **G2 de-risking** |
| [04](04-evidence-catalog.md) | **Commerce Evidence Catalog v1** — canonical events, exception taxonomy, reconciliation | Evidence |
| [05](05-verification-battery.md) | **Commerce Verification Battery v1** — executable requirements, groups A–H | Pre-implementation proof |

## Held invariants

- **G1 preserved as a hard gate.** `pending_review` ≠ purchasable. No global
  bypass, no default-approved migration, no production test mode. Contract 05
  §A6 actively tests that no bypass exists.
- **The browser never declares financial truth.** All price recomputation,
  availability verification, reservation, idempotency, webhook verification,
  payment transitions, refunds, inventory commit, and audit emission live in
  the server-side surface (G5, approved for design).
- **`pending → fulfilled` is impossible** regardless of UI.
- **Migrations stay additive.** `0001–0007` are never rewritten; this phase
  lands as `0008`+.

## Decisions requiring COMMAND authority

| ID | Decision | Recommendation |
| --- | --- | --- |
| **D-1** | Two-machine model (`order_status` + `payment_status`) vs single enum | **Two** — a single enum cannot represent a fulfilled-then-partially-refunded order |
| **D-2** | Rename `confirmed` → keep; drop `refunded` from `order_status` | Accept (delta in 01 §1) |
| **D-3** | Authorize-at-checkout + capture-at-dispatch, vs capture-at-checkout | **Auth-then-capture** — avoids holding funds for unshipped goods |
| **D-4** | Reservation TTL | **30 minutes** |
| **D-5** | Backorder policy | Refuse in v1; revisit with supplier data |
| **D-6** | Guest checkout vs accounts-required | Accounts-required in v1 (simplifies isolation + rewards) |
| **D-7** | Rewards earn basis, and behaviour on partial refund | Subtotal; proportional compensating entry |

## Blocking gates (unchanged, none engineering)

**G1** product regulatory review · **G2** written processor acceptance for
Everlume's exact model *(exit evidence: underwriting approval — not signup,
sandbox, or API keys)* · **G3** pricing · **G4** policy review · **G5** server
surface *(approved for design)* · **G6** rewards activation · **G7**
destination restrictions.

## Execution order (Sonnet, once authorized)

1. Transition guard + `order_transitions` data + battery group D — *no new surface*
2. Reservation, movements, sweeper + group C — **P0s closed after this**
3. Cart + group B
4. Checkout intent (reserve → recompute → `pending`) + group A
5. **Payment against `FakeAdapter`** + groups E, G — *processor-independent*
6. Fulfillment, shipments, timeline
7. COMMAND writes + typed exception queue
8. Rewards activation *(G6)*
9. **Live processor integration — G2 only**

**Steps 1–8 require no processor.** Only step 9 is hard-blocked by G2, and
step 5 proves the money path before a processor is ever chosen.

## Exit

`XCOP-001.15 — COMMERCE: VERIFIED` requires a clean battery receipt over
groups A–H against `FakeAdapter`, plus `npm test` green. Live-processor smoke
is a separate, later gate.

**Then hold.** Implementation begins only when Alpha is live-certified *and*
G2 has a viable processor path.
