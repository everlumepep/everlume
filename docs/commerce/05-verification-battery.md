# Commerce Verification Battery v1

**Part of:** XCOP-COMMERCE-CONTRACT-v1 · **Status:** FROZEN

Per the War Room finding, the battery is a **Foundation deliverable and a
design-review mechanism** — written *before* implementation, not after. It
already earned its place once: authoring the 001.14 battery exposed the
ledger/cascade defect before any backend existed.

**Extends** `scripts/live-verify.mjs` as `scripts/live-verify-commerce.mjs`,
same conventions: dependency-free `fetch`, assertions through real signed-in
sessions, service-role only for fixture lifecycle, exit `2` without
credentials / `1` on failure / `0` clean, JSON receipt.

**Runs entirely against `FakeAdapter`** — so the commerce control plane is
fully certifiable while G2 is unresolved.

---

## Fixture doctrine (protects G1)

The battery needs purchasable products, but **must not weaken the production
authorization rule**. Therefore:

- Fixtures are **explicitly approved test records** created by the harness and
  destroyed after — never a global bypass, never a default-approved migration,
  never a production "test mode."
- **Group A includes a test asserting that no bypass mechanism exists**: if a
  future implementation adds an override flag or an env var that skips
  `compliance_status`, that test fails. The battery defends the gate against
  its own future maintainers.

---

## A · Compliance gate (G1) — highest severity

| # | Assertion |
| --- | --- |
| A1 | `pending_review` product **cannot** be added to cart |
| A2 | `pending_review` product **cannot** be ordered even by direct API call |
| A3 | `draft`/`archived` product cannot be carted or ordered |
| A4 | product with `price_cents IS NULL` cannot be ordered |
| A5 | product de-approved **between cart and checkout** fails at reservation |
| A6 | **no bypass exists** — no flag, env var, or role permits ordering an unapproved product; staff, manager, and admin all fail |
| A7 | de-approving a product with open orders raises `compliance.hold_applied` |

## B · Cart integrity

B1 client-supplied price is ignored; order uses DB price · B2 client cannot set
`total_cents` · B3 quantity ≤ 0 or non-integer refused · B4 customer cannot
read another's cart · B5 anonymous→signed-in merge moves only that session's
cart and leaks nothing · B6 cart referencing a deleted product fails cleanly

## C · Reservation (P0-15.1)

| # | Assertion |
| --- | --- |
| C1 | reserve increments `quantity_reserved`, decrements `available` |
| C2 | **oversell impossible** — direct SQL attempt violates the CHECK |
| C3 | **concurrent last-unit → exactly one winner**, one clean `unavailable` |
| C4 | multi-line all-or-nothing: one short line reserves nothing |
| C5 | re-reserve same (order, sku) is idempotent — no double count |
| C6 | TTL expiry releases and drives `commercial → cancelled` (C2) |
| C7 | commit leaves `available` **unchanged**, `on_hand` reduced |
| C8 | release restores availability exactly |
| C9 | stock adjustment below active reservations is refused |
| C10 | sweeper is idempotent and safe re-run after simulated crash |
| C11 | late authorization after expiry → refund, **never oversell** |
| C12 | `available` never negative under concurrent load |

## D · Machine-local legality (P0-15.2)

| # | Assertion |
| --- | --- |
| D1 | **exhaustive illegal-transition matrix per machine** — every (machine, from, to) not in Contract 01 §3 is refused |
| D2 | fulfillment `unfulfilled → fulfilled` impossible by any actor *(the merged model's `pending → fulfilled`)* |
| D3 | commercial `pending → closed` impossible |
| D4 | fulfillment `reserved → ready` impossible (skips picking) |
| D5 | **customer cannot cause any payment transition**; neither can staff (P2/P3/P6/P7 System-only) |
| D6 | staff cannot request a refund; Manager+ can |
| D7 | staff cannot cancel a confirmed order; Manager+ can |
| D8 | `closed` and `cancelled` are terminal — every outbound transition refused |
| D9 | I1 holds: tampering `total_cents` after authorization blocks confirmation |
| D10 | partial-shipment sequence `ready → partially_fulfilled → …→ fulfilled` is legal and reaches `fulfilled` exactly once |
| D11 | direct `UPDATE orders SET …_status` bypassing the guard is refused (I3) |

## D′ · Cross-machine invariants (D-1 ruling)

**Independence must not mean every combination is legal.** Each invariant is
tested to fail closed.

| # | Assertion |
| --- | --- |
| X1 | fulfillment cannot pass `reserved` while `commercial ≠ confirmed` |
| X2 | `commercial = confirmed` refused unless payment satisfies the **configured capture strategy** — tested under both `immediate` and `authorize_then_capture` |
| X3 | **goods cannot ship against uncaptured funds** — `partially_fulfilled`/`fulfilled` refused unless `payment = captured`, in *both* strategies |
| X4 | `payment = failed` (or `expired`) cannot drive fulfillment into `processing`; an in-flight order is forced back and a blocking exception raised |
| X5 | inventory commit does **not** occur on fulfillment change alone — requires `commercial=confirmed` **and** `payment=captured` |
| X6 | `commercial = cancelled` forces `fulfillment = cancelled`, releases all reservations, and refuses illegal payment pairings |
| X7 | `closed` refused unless `fulfilled` **and** payment settled |
| X8 | a **blocking** open exception freezes all three machines; resolving it unfreezes |
| X9 | `payment = disputed` raises a blocking exception and halts advancement |
| X10 | **full state-triple product** (4 × 9 × 7) — every combination is either reachable by a legal path or refused; none is silently representable |

Groups A–H plus D′ constitute the exit criterion.

## E · Payment (against `FakeAdapter`)

E1 unsigned webhook rejected, **no state change** · E2 tampered payload
rejected · E3 replayed webhook is a no-op, one timeline entry · E4 out-of-order
(`captured` before `authorized`) converges correctly · E5 amount mismatch →
`exception(payment_amount_mismatch)`, never confirms · E6 currency
mismatch → attention · E7 **retried capture with same idempotency key charges
once** · E8 concurrent duplicate captures → one capture · E9 refund posts a
compensating entry, mutates nothing · E10 partial refund keeps
`refunded_cents ≤ amount_cents` · E11 customer cannot read another's payments ·
E12 customer cannot INSERT/UPDATE `payments` · E13 `fake` adapter **cannot** be
selected under production config · E14 dispute event raises a blocking
exception · E15 **both capture strategies exercised end-to-end**; a strategy
unsupported by the adapter **fails closed at boot** · E16 in-flight orders
complete under the strategy they started with after a config change

## F · Rewards

F1 earn fires **once** at `fulfilled` · F2 replayed fulfillment does not
double-award · F3 refund posts compensating entry; balance reconciles · F4
earning inert while `rewards_rules.active = false` (G6) · F5 ledger remains
append-only under commerce load · F6 balance equals ledger sum after a full
lifecycle including refund

## G · Evidence

G1 **exactly one** `order_events` + one `audit_events` per transition · G2
`order_events` append-only · G3 dedupe key prevents duplicate timeline entries
· G4 customer reads only own `customer_visible` events · G5 customer-visible
payloads leak no staff identity or internal reason codes · G6 refused
transition leaves **no** partial evidence · G7 reconciliation detects an
injected divergence and raises attention

## H · Security & regression

H1 no service-role key or secret in any deployed **edge function bundle**
(extends the existing repo scan) · H2 customer cannot read
reservations/movements/shipments · H3 staff cannot forge or delete evidence ·
H4 **0007 regression** — account with commerce + rewards history still
deletable, ledger anonymized · H5 full `npm test` remains green

---

## Concurrency harness

C3, C12, and E8 require genuine parallelism. The harness fires N simultaneous
requests via `Promise.all` against the live backend and asserts the
**invariant**, not a timing outcome: exactly one winner, `available ≥ 0`, one
capture. Anything that passes only sequentially is a failed test.

## Exit criterion

`XCOP-001.15 — COMMERCE: VERIFIED` requires a clean receipt over **all groups
A–H** against `FakeAdapter`, plus `npm test` green. A live-processor smoke pass
is a **separate** gate after G2, and is not a substitute for this battery.
