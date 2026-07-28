# Payment Adapter Contract v1

**Part of:** XCOP-COMMERCE-CONTRACT-v1 · **Status:** ENGINEERING READY

Everlume must not become architecturally married to any processor. This
contract defines a **processor-neutral boundary**: the control plane owns all
state and truth; an adapter only translates.

**Consequence for G2:** the outcome of processor underwriting no longer binds
the architecture. Steps 1–4 and 6–7 of execution are buildable and fully
verifiable against a test double before any processor is chosen. G2 gates
*going live*, not *building*.

---

## 1. Boundary rule

```
Browser ──request──► Control Plane (edge fn) ──► PaymentAdapter ──► Processor
                            │                                          │
                            └────◄── canonical event ◄── webhook ◄─────┘
```

- The **adapter never touches the database.** It has no DB client. It
  translates a canonical request into a processor call and a processor event
  into a canonical event. All persistence and state transitions belong to the
  control plane.
- **No processor SDK type crosses the boundary.** No `Stripe.PaymentIntent`,
  no Square/PayPal object, in any control-plane signature. A second adapter
  must be addable without touching order, inventory, or rewards code.
- **The browser may request commerce actions. The browser never declares
  financial truth.**

---

## 2. Interface

```ts
type Money = { amount_cents: number; currency: string };   // integer minor units only

interface PaymentAdapter {
  readonly name: string;                       // 'stripe' | 'fake' | …
  readonly capabilities: {
    authorizeThenCapture: boolean;             // split auth/capture supported?
    partialRefund: boolean;
    maxAuthorizationWindowDays: number | null;
  };

  createCheckoutSession(input: {
    orderId: string; total: Money; lines: LineSummary[];
    returnUrl: string; cancelUrl: string; idempotencyKey: string;
  }): Promise<{ sessionRef: string; redirectUrl: string; expiresAt: string }>;

  verifyWebhook(raw: Uint8Array, headers: Record<string,string>): VerifiedEvent;
  normalizeEvent(event: VerifiedEvent): CanonicalPaymentEvent;

  capture(input: { paymentRef: string; amount: Money; idempotencyKey: string }):
    Promise<{ status: 'captured'|'failed'; processorRef: string; failureCode?: string }>;

  refund(input: { paymentRef: string; amount: Money; reason: string; idempotencyKey: string }):
    Promise<{ status: 'refunded'|'pending'|'failed'; processorRef: string; failureCode?: string }>;

  getPaymentState(paymentRef: string): Promise<CanonicalPaymentState>;   // reconciliation
}
```

`getPaymentState` exists specifically so reconciliation (§7) never depends on
having received a webhook.

---

## 3. Canonical events

Processor-neutral vocabulary. Adapters map into it; nothing downstream knows a
processor exists.

`payment.session_created` · `payment.authorized` · `payment.captured` ·
`payment.failed` · `payment.expired` · `payment.refunded` ·
`payment.partially_refunded` · `payment.disputed` · `payment.dispute_resolved`

Each carries: `orderId`, `paymentRef`, `processorEventId`, `amount`, `currency`,
`occurredAt`, `rawFingerprint` (hash of the verified payload — never the payload).

Unmappable processor events are recorded as
`attention_required(unmapped_payment_event)` — **never silently discarded.**

---

## 4. Non-negotiable rules

1. **Signature verification is mandatory.** Unverified webhook → reject, log,
   **no state change**, no order lookup. Verification precedes parsing.
2. **Amount and currency cross-check.** Webhook amount must equal
   `orders.total_cents` in the same currency. Mismatch →
   `attention_required(payment_amount_mismatch)`, never auto-confirm.
   A processor is authoritative about *money movement*, not about *what was owed*.
3. **Totals recomputed server-side** from current DB prices under lock
   (Contract 02 §4). Client-supplied totals are input, never authority.
4. **Idempotency keys are attempt-independent and deterministic:**
   `capture:{order_id}`, `refund:{order_id}:{refund_seq}`,
   `session:{order_id}:{attempt_epoch}`. A *retried* capture reuses the key so
   the processor collapses it — this is the Factory `sideEffectKey` doctrine
   verbatim: **a retried capture must never double-charge.**
5. **Webhook replay is expected, not exceptional.** `processor_event_id` carries
   a UNIQUE constraint; a duplicate is a no-op returning `200`.
6. **Return 200 fast.** Verify, persist the raw event, enqueue, respond. Long
   work inside the handler invites processor retry storms.
7. **Out-of-order delivery is normal.** `captured` may arrive before
   `authorized`. Handlers are written as state *convergence*, not sequence
   assumptions; a later-superseded event never regresses state.
8. **No instrument data ever.** No PAN, CVV, expiry, or full instrument detail
   in Everlume infrastructure — processor-hosted fields only, storing
   references. `payments` holds refs, amounts, and status.
9. **Secrets server-side only.** Adapter credentials come from environment
   config in the edge runtime. The repo secret-scan test extends to any
   deployed function bundle.
10. **Refunds are Manager+**, always produce a compensating rewards entry, and
    never mutate the original payment row.

---

## 5. `payments` schema sketch (normative, not applied)

```sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  adapter text not null,                       -- 'stripe' | 'fake' | …
  payment_ref text not null,                   -- processor-side id
  processor_event_id text unique,              -- replay defence
  status text not null check (status in
    ('pending','authorized','captured','failed','expired',
     'refunded','partially_refunded','disputed')),
  amount_cents integer not null check (amount_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  currency text not null,
  idempotency_key text not null,
  failure_code text,
  raw_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_cents <= amount_cents),
  unique (adapter, idempotency_key)
);
```

**RLS:** a customer may read only payments on their own orders, and only
non-sensitive columns; staff read all; **only the SECURITY DEFINER control
plane writes.** No client-side INSERT or UPDATE policy exists.

---

## 6. The `fake` adapter is a first-class deliverable

`FakeAdapter` implements the full interface deterministically and is
**required, not optional**. It must simulate: success, decline, expiry,
amount mismatch, duplicate webhook, out-of-order delivery, capture failure,
partial refund, and dispute.

This is what allows the entire commerce control plane — state machine,
reservation, evidence, rewards — to be **fully certified before G2 resolves**.
Deployment must be configured so `fake` can never be selected in production
(fail-closed on adapter name).

---

## 7. Reconciliation

A scheduled job compares local `payments` against `getPaymentState` for every
non-terminal payment and every payment touched in the last N days.

Any divergence — captured at processor but not locally, refund unknown locally,
amount drift — emits `reconciliation.mismatch_detected` and raises
`attention_required`. **Webhooks are an optimization; reconciliation is the
backstop.** A missed webhook must never mean permanently wrong money state.

---

## 8. Adapter selection (G2)

Selection is a **business/legal authority decision**, not an engineering one.
Per COMMAND, G2 exits only on **written processor acceptance for Everlume's
exact business model, catalog, claims, fulfillment model, and intended checkout
flow** — underwriting approval or equivalent explicit authorization.
**Signup success, sandbox access, or possession of API keys is not acceptance.**

Provider policy varies materially by model (prescription vs research framing,
card-present vs card-not-present, claim content), and policy changes over time.
The adapter boundary means a provider decision — or a later provider
*termination* — costs one adapter implementation, not a commerce rewrite. That
is the architectural insurance against G2, and the reason this contract exists.

---

## 9. Battery obligations

Contract 05 must prove, against `FakeAdapter`: unsigned/tampered webhook is
rejected with no state change; replayed webhook is a no-op; out-of-order events
converge correctly; amount mismatch raises attention and never confirms;
retried capture with the same key charges once; refund posts a compensating
ledger entry and never mutates; a customer cannot read another's payments;
staff cannot refund; and no adapter secret appears in any bundle.
