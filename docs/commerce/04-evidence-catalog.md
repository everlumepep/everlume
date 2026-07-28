# Commerce Evidence Catalog v1

**Part of:** XCOP-COMMERCE-CONTRACT-v1 · **Status:** FROZEN

Every commerce fact is evidenced. Nothing changes state silently.

---

## 1. Two streams, deliberately separate

| Stream | Table | Audience | Content |
| --- | --- | --- | --- |
| **Customer timeline** | `order_events` | Customer + staff | What happened to *my* order, in plain language |
| **Internal audit** | `audit_events` *(exists, 0005)* | Staff+ only | Actor, before/after state, full detail |

They are not redundant. The customer timeline must never leak internal reasons
(margin, supplier, fraud signals, staff identity); the audit trail must never
be softened for presentation. **A transition writes to both** (Contract 01, I6).

---

## 2. Catalog

`C` = customer-visible · `A` = audit only · **Idem** = dedupe key

| Event | Emitted when | Actor class | Key payload | Vis | Idem |
| --- | --- | --- | --- | --- | --- |
| `order.created` | Cart converted to order | Customer | order_id, line count, total | C | order_id |
| `inventory.reserved` | Reservation acquired | System | reservation_ids, skus, qty | A | order_id+sku |
| `inventory.unavailable` | Reservation refused | System | shortfalls[] | C *(as "item unavailable")* | attempt |
| `payment.session_created` | Checkout session opened | System | session_ref, expires_at | C | idem key |
| `payment.authorized` | Funds authorized | System | payment_ref, amount | C | processor_event_id |
| `payment.captured` | Funds captured | System | payment_ref, amount | C | processor_event_id |
| `payment.failed` | Declined / error | System | failure_code | C *(sanitized)* | processor_event_id |
| `payment.expired` | Session lapsed | System | session_ref | C | session_ref |
| `order.confirmed` | C1 | System | payment_ref | C | order_id |
| `order.processing` | F3 | Staff | — | C | order_id+status |
| `order.ready` | F4 | Staff | — | C | order_id+status |
| `order.partially_fulfilled` | F5 | Staff | shipped lines, carrier, tracking | C | order_id+shipment_seq |
| `order.shipment_added` | F7 | Staff | shipped lines, carrier, tracking | C | order_id+shipment_seq |
| `order.fulfillment_cancelled` | F8 | Manager+/System | reason | C | order_id |
| `order.closed` | C4 | System | — | C | order_id |
| `inventory.committed` | Stock deducted | System | movement_ids | A | reservation_id |
| `inventory.released` | Reservation released | System | reason | A | reservation_id |
| `order.fulfilled` | F6 | Staff | carrier, tracking | C | order_id |
| `rewards.earned` | At `fulfilled` | System | points, rule_key | C | order_id+rule_key |
| `order.cancelled` | C2/C3 | varies | reason | C | order_id |
| `payment.refund_requested` | Refund initiated | Manager+ | amount, reason | C | refund_seq |
| `payment.refunded` / `.partially_refunded` | Processor confirms | System | amount | C | processor_event_id |
| `rewards.refund_adjusted` | Compensating ledger entry | System | points, order_id | C | order_id+refund_seq |
| `payment.disputed` | Chargeback opened | System | amount | A | processor_event_id |
| `order.exception_raised` | Exception opened | System/Staff | **typed** reason, `blocking`, gated machines | A *(status only to customer)* | order_id+reason+seq |
| `order.exception_resolved` | Exception closed | Staff/Manager | resolution | A | order_id+seq |
| `reconciliation.mismatch_detected` | Processor ≠ local | System | field, local, processor | A | payment_ref+run |
| `compliance.hold_applied` | Product left `approved` w/ open orders | System | product_id, orders[] | A | product_id+seq |

### Exception taxonomy (`order_exceptions.reason`)

`payment_failed` · `payment_amount_mismatch` · `authorization_expiring` ·
`inventory_shortfall` · `inventory_commit_failed` · `address_invalid` ·
`destination_restricted` · `compliance_hold` · `refund_requested` ·
`dispute_opened` · `unmapped_payment_event` · `reconciliation_mismatch` ·
`manual_review`

Typed, never free text. This is what makes COMMAND's "ATTENTION REQUIRED"
panel *reporting* rather than invented narrative: it counts typed exceptions
and reads real movement history. **No intelligence surface may display a
figure it cannot derive from these events.**

---

## 3. Rules

- **Append-only.** `order_events` carries the immutability trigger doctrine.
  Corrections are new events. No UPDATE, no DELETE.
- **Idempotent.** Every event has a dedupe key; replay writes nothing new.
  Duplicate webhooks must not produce duplicate timeline entries.
- **Exactly one pair per transition** (I6) — a transition emitting two events,
  or none, is a defect the battery must catch.
- **Same transaction.** Evidence is written in the transaction that performs
  the change. A committed state change with missing evidence is impossible.
- **Sanitized outward.** Customer-visible payloads carry no staff identity, no
  internal reason codes, no processor failure text verbatim.
- **Ordering.** Consumers sort by `occurred_at` then monotonic `seq` — never
  by arrival.

## 4. Schema sketch (normative, not applied)

```sql
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  seq bigserial,
  event_key text not null,
  actor_class text not null check (actor_class in ('customer','staff','manager','system')),
  actor_id uuid,
  customer_visible boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  occurred_at timestamptz not null default now(),
  unique (order_id, dedupe_key)
);
```

**RLS:** customers read `customer_visible` events on their own orders only;
staff read all; **writes only from the SECURITY DEFINER control plane.**

---

## 5. Reconciliation as evidence

Three independent records must agree: the **order** (what was promised), the
**payments** row (what money moved), and the **inventory movements** (what
stock left). Nightly reconciliation asserts:

- every `fulfilled` order has captured payment ≥ (total − refunds)
- every captured payment has a non-`cancelled` order
- every committed reservation has a matching movement
- rewards earned equals the sum implied by fulfilled orders under active rules

Any failure emits `reconciliation.mismatch_detected` **and** raises
a blocking **exception**. Silent divergence between money, stock, and orders is
the single failure mode this catalog exists to prevent.
