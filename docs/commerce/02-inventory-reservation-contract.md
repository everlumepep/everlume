# Inventory Reservation Contract v1

**Part of:** XCOP-COMMERCE-CONTRACT-v1 · **Status:** ENGINEERING READY

Closes P0-15.1. `inventory.quantity_reserved` is today a column **nothing
writes**. This contract makes it authoritative.

**No payment flow proceeds until this exists.**

---

## 1. Lifecycle

```
AVAILABLE ──reserve──► RESERVED ──commit──► COMMITTED   (stock leaves)
                          │
                          └──release/expire──► RELEASED (stock returns)
```

`COMMITTED` and `RELEASED` are terminal. A reservation never returns to
`RESERVED`.

**Availability is derived, never stored twice:**

```
available(sku) = quantity_on_hand − quantity_reserved
```

---

## 2. Ledger effects

| Operation | `quantity_on_hand` | `quantity_reserved` | `available` |
| --- | --- | --- | --- |
| **reserve** *n* | — | **+ n** | **− n** |
| **release** *n* | — | **− n** | **+ n** |
| **commit** *n* | **− n** | **− n** | — *(unchanged: already spoken for)* |

Commit leaving `available` unchanged is the correctness signal that reservation
accounting is sound — the stock was already deducted from availability at
reserve time.

Every operation appends to **`inventory_movements`** (append-only, mirroring
the rewards-ledger doctrine): reason, quantity delta, reference, actor,
timestamp. This is the substrate for lots, batches, expiry, cost, and supplier.

---

## 3. Oversell is a database invariant

```sql
alter table public.inventory
  add constraint inventory_no_oversell
  check (quantity_reserved >= 0
         and quantity_on_hand >= 0
         and quantity_reserved <= quantity_on_hand);
```

**Application logic is not permitted to be the oversell defence.** If every
edge function were removed, the constraint alone must still make oversell
impossible.

---

## 4. Atomicity and concurrency

All multi-line reservation happens inside **one** SQL function, one
transaction.

```sql
-- reserve_inventory(p_order_id uuid, p_lines jsonb, p_ttl interval)
--   -> {status:'reserved'|'unavailable', shortfalls:[...], reservation_ids:[...]}
```

Normative requirements:

1. **Deterministic lock order.** Lock target rows with `SELECT … FOR UPDATE`
   **ordered by `inventory.id` ascending**. Two concurrent multi-line
   checkouts overlapping on the same SKUs must never deadlock.
2. **All-or-nothing.** If any line is short, the whole reservation fails and
   *no* line is reserved. Partial reservation is not a state.
3. **Typed failure.** Return the shortfall set (sku, requested, available) so
   the customer sees a precise message, never a generic error.
4. **Purchasability re-checked under lock** — `status='active'`,
   `compliance_status='approved'`, `price_cents IS NOT NULL` (G1). A product
   unapproved *between* cart and checkout must fail here.
5. **Prices re-read under lock** and written to `order_items.unit_price_cents`.
   A client-supplied price is input, never authority.

**Last-unit race:** two concurrent checkouts, one unit. Exactly one receives
`reserved`; the other receives `unavailable` with a shortfall. `quantity_reserved`
never exceeds `quantity_on_hand`, and no apology-after-oversell path exists.

---

## 5. Idempotency

```sql
create unique index reservations_one_per_order_sku
  on public.inventory_reservations (order_id, inventory_id)
  where status = 'active';
```

- **Re-reserve** for the same `(order_id, inventory_id)` returns the existing
  active reservation. It never double-reserves.
- **Commit** and **release** are keyed on `reservation_id` and are no-ops if
  the reservation is already terminal — a retried webhook cannot double-deduct.
- Every operation accepts an **idempotency key**; replay returns the original
  outcome rather than re-executing.

---

## 6. Expiration

Reservations are time-bounded: `expires_at = now() + ttl`.

- **Recommended TTL: 30 minutes** — long enough for a processor redirect and
  3-D Secure, short enough to avoid stock hostage-taking. *(D-4, business decision.)*
- A scheduled sweeper releases expired reservations. It must be **idempotent**
  (`WHERE status='active' AND expires_at < now()`), safe to run concurrently,
  and safe to re-run after a crash mid-batch.
- Releasing a reservation on a `payment_pending` order also drives the order to
  `cancelled` (T4) — stock and order state never diverge.
- **Race:** a payment authorized *after* expiry must not silently succeed. The
  webhook handler re-checks reservation validity; if released and stock is no
  longer available, it raises `attention_required(inventory_shortfall)` and
  initiates refund. Money is never kept for stock that cannot ship.

---

## 7. Recovery matrix

| Failure | Detection | Recovery | Invariant preserved |
| --- | --- | --- | --- |
| Reserve succeeded, order write failed | Orphan reservation, no order | TTL sweeper releases | availability restored |
| Payment captured, commit failed | `payment_status='captured'` + reservation `active` | `attention_required(inventory_commit_failed)`; retry commit (idempotent) | no double-deduct |
| Duplicate webhook | Processor event id already stored | No-op, return 200 | no double commit |
| Sweeper dies mid-batch | Reservations still `active`, expired | Next run completes | idempotent |
| Manual stock correction during active reservations | Constraint would be violated | Adjustment refused if it would push `on_hand < reserved`; staff must release first | no oversell |
| Reservation committed, dispatch failed | `committed` + order not `fulfilled` | Compensating movement (restock) — **never** a reversing UPDATE | append-only history |

Corrections are always **new movements**, never mutations. Inventory history is
as immutable as the rewards ledger.

---

## 8. Schema sketch (normative, not applied)

```sql
create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  inventory_id uuid not null references public.inventory (id),
  quantity integer not null check (quantity > 0),
  status text not null default 'active'
    check (status in ('active','committed','released')),
  expires_at timestamptz not null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory (id),
  delta integer not null check (delta <> 0),
  reason text not null,            -- commit | restock | correction | receipt | shrinkage
  reference_type text not null default '',
  reference_id text not null default '',
  actor_id uuid,
  created_at timestamptz not null default now()
);
```

`inventory_movements` carries the same append-only trigger doctrine as the
rewards ledger — **including the migration-0007 lesson**: cascade paths must
not deadlock against the immutability trigger. Deleting an order must not be
blocked by its movement history.

**RLS:** reservations and movements are staff-readable, manager-writable;
customers see neither. Reservation creation happens only inside the
SECURITY DEFINER function called by the server-side surface.

---

## 9. Battery obligations

Contract 05 must prove: concurrent last-unit yields exactly one winner;
`available` never goes negative under load; the CHECK blocks oversell even with
edge functions bypassed; re-reserve is idempotent; TTL expiry releases and
cancels; commit leaves `available` unchanged; late-authorization-after-expiry
refunds rather than oversells; and stock adjustment below active reservations
is refused.
