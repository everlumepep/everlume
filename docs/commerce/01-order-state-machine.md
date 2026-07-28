# Order State Machine v1

**Part of:** XCOP-COMMERCE-CONTRACT-v1 · **Status:** ENGINEERING READY
**Normative for:** Sonnet implementation. DDL below is a **specification
sketch**, not an applied migration.

Closes P0-15.2. Enforcement lives at the trusted data layer. **No UI, edge
function, or client path may perform a transition the database would refuse.**

---

## 1. Two machines, not one

The ruling's indicative sequence (`pending → payment_pending → paid →
processing → fulfilled`) conflates two independent lifecycles. **Recommended
deviation, with rationale:**

A single enum cannot represent real combinations — a *fulfilled* order that is
*partially refunded*, or a *confirmed* order whose payment was later *disputed*.
Forcing both into one field produces compound states (`paid_but_shortfall`,
`fulfilled_then_refunded`) that multiply combinatorially and make the legal
transition matrix unmaintainable.

**v1 therefore separates:**

- **`order_status`** — the *fulfillment* lifecycle (does the customer get goods?)
- **`payment_status`** — the *money* lifecycle (what happened to the funds?)

with an explicit legal-combination matrix (§5) constraining the pair. `paid` is
expressed as `payment_status = 'captured'`, not an order state.

> **COMMAND decision required:** accept the two-machine model, or direct a
> single-enum model. Everything downstream assumes two.

### Delta from `b9a3118`

| Change | Reason |
| --- | --- |
| **+** `payment_pending` order state | Today there is no state for "checkout live, money in flight." Without it, abandoned and processing are indistinguishable. |
| **−** `refunded` from `order_status` | A refunded order was still physically shipped. Refund is a money fact → `payment_status`. |
| **+** `payment_status`, `attention_reason`, `previous_status` columns | Required by §3 and §6. |
| **+** transition guard trigger | Closes P0-15.2. |

Delivered as **migration 0008**, additive, at implementation time. `0001–0007`
are not rewritten.

---

## 2. States

### `order_status` — fulfillment

| State | Meaning | Terminal |
| --- | --- | --- |
| `pending` | Order created from cart; payment not yet initiated | no |
| `payment_pending` | Checkout session live; awaiting processor outcome | no |
| `confirmed` | Payment verified per policy; order is real work | no |
| `processing` | Being picked | no |
| `ready` | Picked and packed; awaiting dispatch | no |
| `fulfilled` | Dispatched | **terminal** (fulfillment) |
| `cancelled` | Will not be fulfilled | **terminal** |
| `attention_required` | Exception; holds `previous_status` | no (reversible) |

### `payment_status` — money

`none` → `pending` → `authorized` → `captured` → `refunded` / `partially_refunded`
with `failed`, `expired`, `disputed` as off-path outcomes.

### Authorize-vs-capture policy

For physical goods with a pick/pack delay, **authorize at checkout, capture at
dispatch** is the recommended default: it avoids holding funds for goods not
yet shipped. `confirmed` therefore requires `payment_status IN
('authorized','captured')`, and capture fires on `ready → fulfilled`.

> **COMMAND decision required (D-3):** authorize-at-checkout/capture-at-dispatch
> (recommended) vs capture-at-checkout. Authorization windows are
> processor-limited (commonly ~7 days); orders exceeding the window must raise
> `attention_required(authorization_expiring)` before it lapses.

---

## 3. Legal transitions — exhaustive

Every pair not listed is **ILLEGAL** and must be refused.

| # | From → To | Trigger | Authorized actor | Guard invariant | Failure path | Events emitted (Contract 04) |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | `pending` → `payment_pending` | Customer starts checkout | **System** (edge fn, on customer request) | Active reservation exists; all lines purchasable (§G1); totals recomputed server-side | reservation unavailable → stay `pending`, typed error | `inventory.reserved`, `payment.session_created` *(or `inventory.unavailable` on failure)* |
| T2 | `pending` → `cancelled` | Customer cancels / cart TTL | Customer (own) or System | — | already terminal → no-op | `order.cancelled`, `inventory.released` |
| T3 | `payment_pending` → `confirmed` | **Verified** authorization/capture | **System only** | `payments` row verified; amount == `total_cents`; currency matches; reservation still active | amount mismatch → T6 | `payment.authorized` *(or `.captured`)*, `order.confirmed` |
| T4 | `payment_pending` → `cancelled` | Session expired / customer abandoned | System | No successful auth exists | late auth arrives → T6 | `payment.expired`, `order.cancelled`, `inventory.released` |
| T5 | `payment_pending` → `attention_required` | Payment failed ambiguously | System | reason typed | — | `payment.failed`, `order.attention_raised` |
| T6 | *any* → `attention_required` | Exception detected | System, Staff | `attention_reason` + `previous_status` set | — | `order.attention_raised` *(typed reason)* |
| T7 | `confirmed` → `processing` | Staff begins picking | Staff | Reservation active | shortfall → T6 | `order.processing` |
| T8 | `processing` → `ready` | Picked and packed | Staff | All lines picked | partial → T6 | `order.ready` |
| T9 | `ready` → `fulfilled` | Dispatched | Staff | Shipment recorded; destination permitted (G7); **capture succeeded**; reservations committed | capture fails → T6 | `payment.captured`, `inventory.committed`, `order.fulfilled`, `rewards.earned` |
| T10 | `confirmed`/`processing`/`ready` → `cancelled` | Cancellation after payment | **Manager+** | Refund initiated; reservations released | refund fails → T6 | `payment.refund_requested`, `payment.refunded`, `inventory.released`, `order.cancelled` |
| T11 | `attention_required` → `previous_status` | Exception resolved | Staff (Manager+ for money/compliance reasons) | Underlying condition cleared | — | `order.attention_resolved` |
| T12 | `attention_required` → `cancelled` | Unresolvable | **Manager+** | Refund/release as applicable | — | `order.attention_resolved`, `order.cancelled` *(+ refund/release events as applicable)* |
| T13 | `fulfilled` → `attention_required` | Refund request / dispute | System, Staff | — | — | `payment.refund_requested` *or* `payment.disputed`, `order.attention_raised` |

Per invariant **I6**, each transition emits **exactly one** `order_events` row
and **one** `audit_events` row; where a row above lists several events, they
correspond to distinct sub-operations (reservation, payment, rewards) each
carrying its own dedupe key. The battery asserts the count, so a transition
that emits two order events — or none — fails.

**Explicitly impossible, tested exhaustively:** `pending → confirmed` (skips
payment), `pending → processing`, **`pending → fulfilled`**, `confirmed →
fulfilled` (skips pick/pack), `fulfilled → processing`, any → `pending`, and
every transition out of `cancelled`.

---

## 4. Actor authority

| Actor | May cause |
| --- | --- |
| **Customer** | T1 (request), T2 — own order only |
| **System** (edge fn / webhook) | T1, T3, T4, T5, T6, T13 — **exclusively owns all payment-driven transitions** |
| **Staff** | T6, T7, T8, T9, T11 (non-money reasons) |
| **Manager+** | T10, T11 (money/compliance), T12, refunds |
| **Admin** | No order-specific authority beyond Manager |

**Neither Customer nor Staff may ever cause T3.** Only a signature-verified
processor event, processed server-side, moves an order into `confirmed`.

---

## 5. Legal `(order_status, payment_status)` combinations

| order_status | permitted payment_status |
| --- | --- |
| `pending` | `none`, `failed`, `expired` |
| `payment_pending` | `pending`, `failed` |
| `confirmed` / `processing` / `ready` | `authorized`, `captured` |
| `fulfilled` | `captured`, `partially_refunded`, `refunded`, `disputed` |
| `cancelled` | `none`, `failed`, `expired`, `refunded`, `partially_refunded` |
| `attention_required` | any |

Enforced as a table CHECK. A `confirmed` order with `payment_status='none'` is
unrepresentable.

---

## 6. Invariants

- **I1** — `confirmed`+ requires a verified `payments` row with amount equal to `orders.total_cents` in the same currency.
- **I2** — `total_cents` equals the sum of line items (plus shipping/tax when introduced); never client-supplied.
- **I3** — Transitions occur **only** through the guard function; direct `UPDATE orders SET status` is refused.
- **I4** — `attention_required` always carries `attention_reason` and a non-null `previous_status`.
- **I5** — `fulfilled` requires all reservations `committed`; `cancelled` requires all reservations `released`.
- **I6** — Every accepted transition emits **exactly one** `order_events` row **and one** `audit_events` row (Contract 04).
- **I7** — `cancelled` is absolutely terminal.
- **I8** — Guard evaluation and side effects share one transaction: a refused transition leaves no partial evidence.

---

## 7. Enforcement sketch (normative, not applied)

```sql
-- Rejects illegal moves and unauthorized actors before any row changes.
create or replace function public.guard_order_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor_role text := coalesce(public.role_of(auth.uid()), 'system');
begin
  if new.status is not distinct from old.status then
    return new;                      -- non-status edits handled elsewhere
  end if;

  if not exists (
    select 1 from public.order_transitions t
     where t.from_status = old.status
       and t.to_status   = new.status
       and (t.allowed_roles @> array[v_actor_role]::text[]
            or (t.system_only and auth.uid() is null))
  ) then
    raise exception
      'illegal order transition % -> % for role %', old.status, new.status, v_actor_role;
  end if;

  if new.status = 'attention_required' then
    if new.attention_reason is null then
      raise exception 'attention_required demands a typed reason';
    end if;
    new.previous_status := old.status;
  end if;

  -- I1: money must be real before fulfillment work begins.
  if new.status = 'confirmed' and not exists (
    select 1 from public.payments p
     where p.order_id = new.id
       and p.status in ('authorized','captured')
       and p.amount_cents = new.total_cents
       and p.currency = new.currency
  ) then
    raise exception 'cannot confirm without a verified payment of matching amount';
  end if;

  return new;
end $$;
```

`order_transitions` is a **data-driven** table (`from_status`, `to_status`,
`allowed_roles[]`, `system_only`) seeded from §3 — so the matrix is auditable
and testable as data rather than buried in procedural branches.

---

## 8. Battery obligations

Contract 05 must prove: the full illegal-transition matrix is refused; a
customer cannot reach `confirmed`; staff cannot refund; `pending → fulfilled`
fails; `attention_required` round-trips to `previous_status`; and I1 blocks
confirmation when the payment amount is altered.
