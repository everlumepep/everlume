# XCOP-001.15 — Commerce & Order Lifecycle Architecture

**Status:** REQUIREMENTS / ARCHITECTURE ONLY — implementation not authorized.
Blocked behind `XCOP-001 — CUSTOMER PLATFORM ALPHA: VERIFIED`.
**Baseline:** commit `b9a3118` (seven migrations, 16/16 + validator PASS).
**Prepared for:** Sonnet execution once the Alpha gate passes.

This document defines the full lifecycle with explicit authority boundaries,
failure states, and evidence at every transition. It changes no production
system and adds no code.

---

## 0. Two gaps in the current foundation this phase must close

Verified against `b9a3118`, not assumed:

1. **`inventory.quantity_reserved` is a column nothing writes.** It is
   declared, constrained, and displayed in COMMAND — but no code path
   reserves or releases stock. Reservation does not exist yet; it is
   currently decoration.
2. **Order status has no transition legality enforcement.** The CHECK
   constraint validates the *value*, never the *move*. A staff account can
   today take an order `pending → fulfilled`, skipping payment entirely. The
   state machine in §3 must be enforced by trigger, not convention.

Neither is a defect in shipped behaviour (nothing transacts yet), but both
become critical the moment money moves.

---

## 1. Scope and non-goals

**In scope:** catalog availability, cart, checkout, payment authorization and
capture, order lifecycle, inventory reservation and movement, fulfillment,
customer-visible status, COMMAND exception handling, and evidence.

**Explicitly out of scope for this phase:** activating payments, selecting a
processor, publishing prices, approving any product for sale, and enabling
rewards earning. Each is an authority gate in §2, not an engineering task.

---

## 2. Authority gates — ALL blocking, none engineering

Implementation may build against these; it may not resolve them.

| # | Gate | Authority | Consequence if unresolved |
| --- | --- | --- | --- |
| G1 | **Product regulatory classification** | Legal / regulatory | Nothing is sellable. See §4 — this is enforced structurally. |
| G2 | **Payment processor selection + merchant account** | Client business | No checkout. **High risk — see below.** |
| G3 | **Public pricing approval** | Client business | `price_cents` stays null; catalog cannot quote. |
| G4 | **Terms/refund/shipping policy review** | Legal | Checkout cannot present binding terms. |
| G5 | **Server-side compute approval** | Founder / architecture | See §5 — payment forces a new execution surface. |
| G6 | **Rewards rule activation** | Client business | Earning stays inert; ledger records nothing. |
| G7 | **Shipping/destination restrictions** | Legal + operations | Fulfillment cannot validate destinations. |

> **G2 carries material business risk that engineering cannot mitigate.**
> Research-chemical and peptide sellers are routinely classified as
> high-risk or prohibited by mainstream processors, and merchant accounts in
> this category are frequently declined or terminated after review. **Confirm
> processor acceptance in writing before commerce implementation begins** —
> otherwise XCOP-001.15 can be engineered to completion and still be
> undeliverable. Recommend resolving G2 *before* Sonnet execution starts,
> not during it.

---

## 3. The lifecycle

```
Catalog → Availability → Cart → Checkout → Payment → Order
   → Inventory → Fulfillment → Customer Status → COMMAND Exception → Evidence
```

### State machine (enforced by trigger, not convention)

```
                    ┌──────────────► cancelled
                    │                    ▲
pending ──► confirmed ──► processing ──► ready ──► fulfilled
   │            │             │            │           │
   │            └─────────────┴────────────┴───────────┤
   ▼                                                   ▼
cancelled                                  refunded ◄──┘

any state ──► attention_required ──► (back to originating state | cancelled)
```

**Legal transitions only.** Every other move is rejected at the database.
`pending → fulfilled` must be impossible. `attention_required` is reversible
and records the state it came from.

### Transition contract

| Transition | Trigger | Precondition | Authority | Failure states | Evidence |
| --- | --- | --- | --- | --- | --- |
| — → `pending` | Customer submits checkout | Gate passed; cart non-empty; every line `active` + `approved` | Customer (own order only) | empty cart, stale price, unapproved product, reservation unavailable | `order.created` |
| `pending` → `confirmed` | Payment **captured** (webhook, server-verified) | Payment intent matches order total; idempotency key unused | **System only** — never client, never staff | payment declined, amount mismatch, webhook replay, timeout | `payment.captured`, `order.confirmed` |
| `pending` → `cancelled` | Customer cancels, or reservation TTL expires | Not yet captured | Customer or System | double-cancel | `order.cancelled`, `inventory.released` |
| `confirmed` → `processing` | Staff begins picking | Stock committed | Staff | shortfall discovered → `attention_required` | `order.processing` |
| `processing` → `ready` | Picked and packed | All lines picked | Staff | partial pick | `order.ready` |
| `ready` → `fulfilled` | Shipment dispatched | Carrier + tracking recorded; destination permitted (G7) | Staff | invalid/restricted destination | `order.fulfilled`, `inventory.movement`, `rewards.earned` |
| any → `attention_required` | Exception detected | — | Staff **or** System | — | `order.attention`, with typed reason |
| `confirmed`+ → `refunded` | Refund issued | Original capture exists | **Manager+** | partial refund, processor failure | `payment.refunded`, `rewards.refund` |

**Rewards earn fires once, at `fulfilled`**, keyed idempotently on
`reference_id = order.id` + rule key, so replay can never double-award.
Refund posts a compensating `refund` ledger entry — never a mutation, per the
append-only doctrine.

---

## 4. Availability — the compliance gate is load-bearing

A line item is purchasable **only** if:

```
products.status            = 'active'
products.compliance_status = 'approved'
products.price_cents       IS NOT NULL
available                  >= requested
```

where `available = quantity_on_hand - quantity_reserved`.

Because migration `0006` seeds **every product `pending_review`**, checkout is
**structurally impossible today** — not by feature flag, but by data. Someone
could wire a complete payment integration and still sell nothing until a human
performs the G1 review and promotes products to `approved`.

**This property must be preserved, not optimized away.** It is the difference
between a compliance control and a compliance decoration, and it is the single
most important architectural characteristic of this phase. Any implementation
that introduces a bypass — an override flag, a "test mode" that ignores
`compliance_status`, a default of `approved` — has broken the system's core
safety guarantee.

---

## 5. Payment forces a new execution surface — decision required (G5)

Everlume is today a **purely static site secured by RLS**. That model cannot
safely process payment, for a reason no amount of client-side care fixes: a
browser can claim any amount. Order totals, capture confirmation, and refunds
must be computed and verified where the customer cannot reach them.

XCOP-001.15 therefore introduces the platform's **first server-side execution
surface**. Recommended: **Supabase Edge Functions**, keeping compute adjacent
to the data and the security model in one system rather than splitting trust
across Netlify and Supabase.

Non-negotiable rules for that surface:

1. The **service-role key lives only in server-side environment config** and
   never reaches a browser bundle — the existing repo test must be extended
   to scan any new function bundles.
2. **Order totals are recomputed server-side** from current DB prices. A
   client-supplied amount is input, never authority.
3. **Payment state changes only via processor webhook**, signature-verified.
   A client "payment succeeded" callback is a hint, never a state transition.
4. **Idempotency keys on every capture and refund** — the retried-publish
   doctrine from the Factory applies verbatim: a retried capture must never
   double-charge.
5. **Webhook replay is expected, not exceptional.** Handlers must be safe to
   run repeatedly with identical effect.

---

## 6. Inventory reservation

Closes gap #1. Reservation happens **at checkout initiation, not cart add** —
carts are browsing, and reserving on add lets an idle cart deny stock to a
buyer.

- New `inventory_reservations`: order_id, inventory_id, quantity, `expires_at`, status.
- Reserve → increments `quantity_reserved` atomically, refusing to exceed `quantity_on_hand`.
- **Capture** → converts reservation to a movement, decrements `quantity_on_hand`, releases the reserve.
- **Expiry / cancel** → releases the reserve, restoring availability.
- New `inventory_movements` (append-only, mirroring the ledger doctrine):
  every stock change carries a reason and a reference. This is the substrate
  for lots, batches, expiry, cost, and supplier later.

**No-oversell is a database invariant, not application logic.** Concurrent
checkouts on the last unit must be resolved by row-level locking, with the
loser receiving a clean availability failure — not an oversell plus an apology.

---

## 7. Schema deltas

| Object | Purpose |
| --- | --- |
| `carts`, `cart_items` | Server-authoritative cart; anonymous keyed by the gate's opaque `session_reference`, merged on sign-in |
| `payments` | Intent/capture/refund records, processor refs, idempotency keys, **never raw instrument data** |
| `inventory_reservations` | Time-boxed holds (§6) |
| `inventory_movements` | Append-only stock history |
| `shipments` | Carrier, tracking, destination validation (G7) |
| `order_events` | Customer-visible status timeline, distinct from the internal audit trail |
| `orders` +cols | `payment_status`, `attention_reason`, `previous_status` |
| Transition guard trigger | Enforces §3; closes gap #2 |

**Card data never touches Everlume infrastructure** — processor-hosted fields
only, storing references. `payments` holds no PAN, CVV, or full instrument
detail, and no credential material enters the repo.

---

## 8. COMMAND exception model

`attention_required` must be typed, not a shrug. Taxonomy:
`payment_failed`, `payment_amount_mismatch`, `inventory_shortfall`,
`address_invalid`, `destination_restricted`, `compliance_hold`,
`refund_requested`, `manual_review`.

Each carries the reason, the originating state, and a resolution path back.
This is what makes the Phase 4 intelligence layer ("ATTENTION REQUIRED —
TB-500 projected below minimum") real reporting rather than invented text: it
reads typed exceptions and actual movement history, never a heuristic.

---

## 9. Battery extension (Foundation deliverable, per War Room finding)

Per the ruling that the battery is a design-review mechanism, these checks are
**written before commerce implementation begins**, extending
`scripts/live-verify.mjs`:

- unapproved / draft / unpriced product **cannot** be added to cart or ordered
- customer **cannot** alter cart pricing, or order a quantity exceeding availability
- concurrent checkout on the last unit yields exactly one winner, **no oversell**
- order **cannot** reach `confirmed` without a verified capture
- illegal transitions (`pending → fulfilled`) are **rejected**
- webhook replay is idempotent — no double capture, no double reward
- refund posts a compensating ledger entry; balance reconciles; nothing mutates
- customer cannot read another customer's cart, payment, or shipment
- staff cannot issue refunds (manager+ only)
- no service-role key in any deployed function bundle

---

## 10. Execution sequencing for Sonnet

Ordered so each step is independently verifiable, cheapest risk first:

1. Transition guard trigger + battery checks (**closes gap #2 with no new surface**)
2. Inventory reservation + movements (**closes gap #1**)
3. Cart (server-authoritative, anonymous → signed-in merge)
4. Checkout intent — reserve, recompute totals, create `pending`
5. **Payment integration — gated on G2 + G5, do not start earlier**
6. Fulfillment, shipments, order events
7. COMMAND write operations + typed exception queue
8. Rewards earn activation — gated on G6

**Steps 1–4 and 6–7 need no processor**, so real progress continues while G2
is resolved. Only step 5 is hard-blocked.

---

## 11. Open decisions requiring authority

1. Processor selection and **written confirmation of category acceptance** (G2)
2. Server-side surface approval — Supabase Edge Functions recommended (G5)
3. Reservation TTL (recommend 30 min; business decision)
4. Backorder policy — refuse, or accept with `attention_required`
5. Guest checkout, or accounts-required
6. Rewards earn basis — order subtotal vs total, and behaviour on partial refund
7. Destination restriction list (G7)

---

## 12. Program note

If XCOP-001.14's measurement holds — ~85% portable — then §§3, 6, 7, and 9
are **platform, not client work**: the state machine, reservation semantics,
idempotency doctrine, and commerce battery carry to every future Client
Copilot. Only pricing, products, destinations, and processor choice are
Everlume-specific. That is the evidence base for the open question of whether
XENTH is building the XCOP platform rather than repeatedly building client
projects — it should be answered with Everlume's actual commerce numbers once
this phase completes, not before.
