# Order State Machine v1

**Part of:** XCOP-COMMERCE-CONTRACT-v1 · **Status:** FROZEN
**Incorporates:** D-1 ruling (three independent machines) + cross-machine
invariant requirement.
**Normative for:** Sonnet implementation. DDL is a **specification sketch**,
not an applied migration.

Closes P0-15.2. Enforcement lives at the trusted data layer. **No UI, edge
function, or client path may perform a transition the database would refuse.**

---

## 1. Three machines

Per D-1: commercial, payment, and fulfillment lifecycles are **independent
dimensions**. Collapsing them produces compound states
(`fulfilled_partially_refunded`, then
`partially_fulfilled_partially_refunded`, then multiple shipments, partial
captures, returns…) that multiply without bound.

> **Correction from the pre-freeze draft.** The earlier version proposed *two*
> machines and labelled `order_status` "the fulfillment lifecycle" — it was in
> fact a merged commercial+fulfillment enum, and had no way to express
> `partially_fulfilled`. Multiple shipments were unrepresentable. The
> three-way split below is the ruling as issued, not the draft as written.

| Machine | Question it answers | Column |
| --- | --- | --- |
| **Commercial** | Is the transaction commercially alive? | `commercial_status` |
| **Payment** | What happened to the money? | `payment_status` |
| **Fulfillment** | What happened physically? | `fulfillment_status` |

All three are columns on the **same `orders` row**, which means cross-machine
invariants (§5) are enforceable by a single trigger in a single transaction —
no distributed consistency problem.

### Core rule (normative)

**No state machine may impersonate another.**
Payment state does not prove fulfillment. Fulfillment does not prove payment.
Commercial state overrides neither. Permitted operations are derived from the
**combination** plus policy.

`payment=captured` + `fulfillment=unfulfilled` means **ready to fulfill**, not
"complete." `payment=partially_refunded` + `fulfillment=fulfilled` is valid
historical truth, not an error.

---

## 2. States

### `commercial_status` — is the transaction alive?

| State | Meaning | Terminal |
| --- | --- | --- |
| `pending` | Order created; not yet commercially committed | no |
| `confirmed` | Payment sufficient per capture strategy; order is real work | no |
| `closed` | Fully fulfilled and financially settled | **terminal** |
| `cancelled` | Will not proceed | **terminal** |

`draft` is deliberately **absent**: pre-order state lives in `carts`, not in
`orders`. An order exists only once intent is committed.

### `payment_status` — money *(vocabulary preserved from the reviewed contract)*

`none` · `pending` · `authorized` · `captured` · `partially_refunded` ·
`refunded` · `failed` · `expired` · `disputed`

Per the ruling, contract vocabulary is authoritative: `captured` (not `paid`),
`none` (not `not_required`).

### `fulfillment_status` — physical execution

| State | Meaning | Terminal |
| --- | --- | --- |
| `unfulfilled` | Nothing held or shipped | no |
| `reserved` | Stock held (Contract 02) | no |
| `processing` | Being picked | no |
| `ready` | Packed, awaiting dispatch | no |
| `partially_fulfilled` | Some lines/quantities shipped | no |
| `fulfilled` | All lines shipped | **terminal** |
| `cancelled` | Will not ship; reservations released | **terminal** |

`partially_fulfilled` is what the merged model could not express. It is
reachable from `ready` and returns to `partially_fulfilled` on each subsequent
shipment until complete.

### Exceptions are **not** a state

`attention_required` is removed from the machines entirely. Under a three-way
split, placing it in any one machine corrupts that machine's semantics — an
order awaiting a compliance answer has not stopped being `confirmed`.

Exceptions become **first-class rows** in `order_exceptions`: typed reason,
`blocking` boolean, open/resolved, and the machines they gate. This also
removes the `previous_status` bookkeeping the merged model required.

### Delta from `b9a3118`

`orders.status` → three columns; `refunded` leaves order state (money fact);
`payment_pending` becomes `commercial=pending` + `payment=pending`;
`attention_required` becomes `order_exceptions`; new `order_transitions` and
`order_exceptions` tables. Delivered as **migration 0008**, additive.
`0001–0007` are never rewritten.

---

## 3. Machine-local legality

Every pair not listed is **ILLEGAL**.

### Commercial

| # | From → To | Trigger | Actor | Events (Contract 04) |
| --- | --- | --- | --- | --- |
| C1 | `pending` → `confirmed` | Payment sufficient per strategy (§X2) | **System only** | `order.confirmed` |
| C2 | `pending` → `cancelled` | Customer cancels / checkout TTL | Customer (own), System | `order.cancelled` |
| C3 | `confirmed` → `cancelled` | Cancellation after commitment | **Manager+** | `order.cancelled` |
| C4 | `confirmed` → `closed` | Fulfilled and settled (§X7) | System | `order.closed` |

### Payment

| # | From → To | Trigger | Actor | Events |
| --- | --- | --- | --- | --- |
| P1 | `none` → `pending` | Checkout session created | System | `payment.session_created` |
| P2 | `pending` → `authorized` | Verified authorization | **System only** | `payment.authorized` |
| P3 | `pending`/`authorized` → `captured` | Verified capture | **System only** | `payment.captured` |
| P4 | `pending`/`authorized` → `failed` | Decline / capture failure | System | `payment.failed` |
| P5 | `pending`/`authorized` → `expired` | Session or auth window lapsed | System | `payment.expired` |
| P6 | `captured` → `partially_refunded` | Partial refund settled | **Manager+** → System | `payment.partially_refunded` |
| P7 | `captured`/`partially_refunded` → `refunded` | Full refund settled | **Manager+** → System | `payment.refunded` |
| P8 | `captured`/`partially_refunded` → `disputed` | Chargeback opened | System | `payment.disputed` |

**Neither Customer nor Staff may cause P2, P3, P6, or P7.** Only a
signature-verified processor event processed server-side moves payment state;
Manager+ *requests* a refund, the processor event *effects* it.

### Fulfillment

| # | From → To | Trigger | Actor | Events |
| --- | --- | --- | --- | --- |
| F1 | `unfulfilled` → `reserved` | Reservation acquired | System | `inventory.reserved` |
| F2 | `reserved` → `unfulfilled` | Reservation released/expired | System | `inventory.released` |
| F3 | `reserved` → `processing` | Picking begins (§X1, §X4) | Staff | `order.processing` |
| F4 | `processing` → `ready` | Picked and packed | Staff | `order.ready` |
| F5 | `ready` → `partially_fulfilled` | Partial shipment dispatched (§X3) | Staff | `inventory.committed`, `order.partially_fulfilled` |
| F6 | `ready`/`partially_fulfilled` → `fulfilled` | Final shipment dispatched (§X3) | Staff | `inventory.committed`, `order.fulfilled`, `rewards.earned` |
| F7 | `partially_fulfilled` → `partially_fulfilled` | Additional shipment | Staff | `inventory.committed`, `order.shipment_added` |
| F8 | `unfulfilled`/`reserved`/`processing`/`ready` → `cancelled` | Cancellation (§X6) | Manager+, System | `inventory.released`, `order.fulfillment_cancelled` |

Per invariant **I6**, each accepted transition emits **exactly one**
`order_events` row and **one** `audit_events` row; where a row lists several
events they are distinct sub-operations, each with its own dedupe key. The
battery asserts the count.

---

## 4. Actor authority

| Actor | May cause |
| --- | --- |
| **Customer** | C2 (own order only) |
| **System** (edge fn / webhook) | C1, C4, all P*, F1, F2 — **exclusively owns every payment transition** |
| **Staff** | F3–F7; raise/resolve non-money exceptions |
| **Manager+** | C3, refund *requests* (P6/P7 effected by System), F8, resolve money/compliance exceptions |

---

## 5. Cross-machine invariants

**Independence must not mean every combination is legal.** These are enforced
in the same trigger as machine-local legality.

| # | Invariant | Rationale |
| --- | --- | --- |
| **X1** | Fulfillment may not advance beyond `reserved` unless `commercial = confirmed` | No picking work on an uncommitted order |
| **X2** | `commercial = confirmed` requires `payment ∈ {authorized, captured}` per the configured capture strategy (Contract 03 §2a) | Confirmation must rest on verified money |
| **X3** | `fulfillment ∈ {partially_fulfilled, fulfilled}` requires `payment = captured` | **Goods never ship against uncaptured funds** |
| **X4** | `payment ∈ {failed, expired}` ⇒ fulfillment may not enter or remain in `processing`+; it must return to `reserved`/`unfulfilled` or raise a blocking exception | The ruling's named case |
| **X5** | Inventory **commit** occurs only on F5/F6/F7 **and** `commercial = confirmed` **and** `payment = captured` | Stock never leaves on fulfillment state alone |
| **X6** | `commercial = cancelled` ⇒ `fulfillment = cancelled`, all reservations released, and `payment ∈ {none, failed, expired, refunded, partially_refunded}` | No orphaned stock or funds |
| **X7** | `commercial = closed` requires `fulfillment = fulfilled` **and** `payment ∈ {captured, partially_refunded, refunded}` | Closure means settled |
| **X8** | No machine may advance while a **blocking** open exception exists | Exceptions gate, and gate all three |
| **X9** | `payment = disputed` raises a blocking exception and freezes commercial + fulfillment advancement | Disputes stop the line |

**Independence is about representation; governance is about combination.**
Machine-local legality answers *may this machine move?*; X1–X9 answer *may it
move given the others?* Both are required, both database-enforced.

### Combination validity

Rather than an exhaustive triple matrix (4 × 9 × 7 = 252 combinations, most
meaningless), validity is defined by X1–X9 as **rules**, and the battery
enumerates the full product to assert every combination is either reachable by
a legal path or refused. Rules stay maintainable; coverage stays exhaustive.

---

## 6. Invariants (machine-local)

- **I1** — `commercial = confirmed` requires a verified `payments` row equal to `orders.total_cents` in matching currency.
- **I2** — `total_cents` equals the sum of line items; never client-supplied.
- **I3** — Transitions occur **only** via the guard; direct `UPDATE orders SET …_status` is refused.
- **I4** — Every exception carries a typed reason and the machines it gates.
- **I5** — `fulfilled` requires all reservations `committed`; `cancelled` requires all `released`.
- **I6** — Exactly one `order_events` + one `audit_events` per accepted transition.
- **I7** — `closed` and `cancelled` are absolutely terminal in the commercial machine.
- **I8** — Guard evaluation and side effects share one transaction: a refused transition leaves no partial evidence.

---

## 7. Enforcement sketch (normative, not applied)

```sql
create or replace function public.guard_order_state()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(public.role_of(auth.uid()), 'system');
  v_blocking int;
begin
  -- 1 · machine-local legality, data-driven from order_transitions
  perform public.assert_transition('commercial',  old.commercial_status,  new.commercial_status,  v_role);
  perform public.assert_transition('payment',     old.payment_status,     new.payment_status,     v_role);
  perform public.assert_transition('fulfillment', old.fulfillment_status, new.fulfillment_status, v_role);

  -- 2 · X8/X9 · blocking exceptions gate every machine
  select count(*) into v_blocking
    from public.order_exceptions e
   where e.order_id = new.id and e.status = 'open' and e.blocking;
  if v_blocking > 0 and (new.commercial_status, new.payment_status, new.fulfillment_status)
                     is distinct from (old.commercial_status, old.payment_status, old.fulfillment_status)
     and not public.is_manager() then
    raise exception 'blocked by % open exception(s)', v_blocking;
  end if;

  -- 3 · cross-machine invariants
  if new.fulfillment_status in ('processing','ready','partially_fulfilled','fulfilled')
     and new.commercial_status <> 'confirmed' then
    raise exception 'X1: fulfillment beyond reserved requires commercial=confirmed';
  end if;

  if new.commercial_status = 'confirmed'
     and new.payment_status not in ('authorized','captured') then
    raise exception 'X2: confirmation requires authorized or captured payment';
  end if;

  if new.fulfillment_status in ('partially_fulfilled','fulfilled')
     and new.payment_status <> 'captured' then
    raise exception 'X3: goods may not ship against uncaptured funds';
  end if;

  if new.payment_status in ('failed','expired')
     and new.fulfillment_status in ('processing','ready','partially_fulfilled','fulfilled') then
    raise exception 'X4: fulfillment may not advance on failed or expired payment';
  end if;

  if new.commercial_status = 'closed'
     and (new.fulfillment_status <> 'fulfilled'
          or new.payment_status not in ('captured','partially_refunded','refunded')) then
    raise exception 'X7: closure requires fulfilled and settled';
  end if;

  return new;
end $$;
```

`order_transitions` is a **data-driven** table (`machine`, `from_status`,
`to_status`, `allowed_roles[]`, `system_only`) seeded from §3 — the matrix is
auditable as data, not buried in branches. X5 and X6 are enforced in the
reservation/cancellation functions (Contract 02), which own the stock side.

```sql
create table public.order_exceptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reason text not null,                       -- Contract 04 taxonomy
  blocking boolean not null default true,
  gates text[] not null default '{commercial,payment,fulfillment}',
  status text not null default 'open' check (status in ('open','resolved')),
  raised_by uuid, resolved_by uuid,
  raised_at timestamptz not null default now(), resolved_at timestamptz
);
```

---

## 8. Battery obligations

Contract 05 must prove: each machine's illegal-transition matrix is refused;
**X1–X9 each fail closed**; the full state-triple product is either reachable
or refused; `payment=failed` cannot drive `processing` (X4); goods cannot ship
uncaptured (X3); a blocking exception freezes all three machines (X8); partial
shipment sequences reach `fulfilled` correctly; and no actor but System can
move payment state.
