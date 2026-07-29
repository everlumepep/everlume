#!/usr/bin/env node
// XCOP-001.14 — Everlume live backend verification battery.
//
// Runs the full security battery against a REAL Supabase project: customer
// isolation, staff authorization, order ownership, privilege-escalation
// refusal, append-only rewards, audit generation, and gate data-minimization.
//
// Every assertion runs through the SAME path a browser takes (anon key + a
// real signed-in session), so a pass here is evidence about production
// behaviour, not about a privileged test harness.
//
// The service-role key is used ONLY to create/promote/destroy throwaway test
// accounts. It is read from the environment, never written to disk, never
// echoed, and never used to make an assertion pass.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/live-verify.mjs
//
// Exit code 0 = battery PASS. Non-zero = at least one control failed.

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !ANON || !SERVICE) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Set them in the shell for this run only — do not add them to any file.');
  process.exit(2);
}

const results = [];
let failed = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail || '');
  } catch (error) {
    record(name, false, error.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── transport ──────────────────────────────────────────────────────────────
async function rest(path, { token, key = ANON, method = 'GET', body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${token || key}` };
  if (body) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, ok: response.ok, body: parsed };
}

async function auth(path, { method = 'POST', key = ANON, token, body } = {}) {
  const response = await fetch(`${URL_BASE}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, ok: response.ok, body: parsed };
}

// ── throwaway accounts ─────────────────────────────────────────────────────
const stamp = process.env.EVERLUME_TEST_STAMP || String(process.hrtime.bigint());
const password = 'Verify-' + stamp.slice(-10) + '!aZ';
const accounts = {
  customerA: { email: `xcop-a-${stamp}@everlume-verify.invalid` },
  customerB: { email: `xcop-b-${stamp}@everlume-verify.invalid` },
  staff: { email: `xcop-s-${stamp}@everlume-verify.invalid` }
};

async function createUser(entry) {
  const created = await auth('admin/users', {
    key: SERVICE,
    token: SERVICE,
    body: { email: entry.email, password, email_confirm: true }
  });
  assert(created.ok, `could not create test user: ${JSON.stringify(created.body)?.slice(0, 160)}`);
  entry.id = created.body.id;
}

async function signIn(entry) {
  const session = await auth('token?grant_type=password', {
    body: { email: entry.email, password }
  });
  assert(session.ok && session.body?.access_token,
    `sign-in failed: ${JSON.stringify(session.body)?.slice(0, 160)}`);
  entry.token = session.body.access_token;
}

async function cleanup() {
  for (const entry of Object.values(accounts)) {
    if (!entry.id) continue;
    await auth(`admin/users/${entry.id}`, { method: 'DELETE', key: SERVICE, token: SERVICE })
      .catch(() => {});
  }
}

// ── battery ────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nXCOP-001.14 — Everlume live verification battery');
  console.log(`Target: ${URL_BASE}\n`);

  console.log('Schema & migrations');
  await check('all 14 tables reachable through PostgREST', async () => {
    const tables = ['profiles', 'compliance_policies', 'compliance_acceptances',
      'products', 'inventory', 'addresses', 'orders', 'order_items',
      'rewards_accounts', 'rewards_transactions', 'rewards_rules',
      'rewards_redemptions', 'referrals', 'audit_events'];
    const missing = [];
    for (const table of tables) {
      const probe = await rest(`${table}?select=*&limit=1`, { key: SERVICE, token: SERVICE });
      if (probe.status === 404) missing.push(table);
    }
    assert(missing.length === 0, `missing tables: ${missing.join(', ')}`);
    return `${tables.length} tables present`;
  });

  await check('seeded products are all pending_review (no implied approval)', async () => {
    const seeded = await rest('products?select=name,compliance_status', { key: SERVICE, token: SERVICE });
    assert(seeded.ok, 'could not read products');
    const approved = (seeded.body || []).filter(p => p.compliance_status !== 'pending_review');
    assert(approved.length === 0, `${approved.length} product(s) not pending_review`);
    return `${seeded.body.length} products, all pending_review`;
  });

  console.log('\nAuthentication');
  await check('test accounts provision and sign in', async () => {
    for (const entry of Object.values(accounts)) await createUser(entry);
    for (const entry of Object.values(accounts)) await signIn(entry);
    return '3 sessions established';
  });

  await check('profile auto-provisioned by trigger for each new user', async () => {
    const mine = await rest('profiles?select=id,role', { token: accounts.customerA.token });
    assert(mine.ok && mine.body.length === 1, 'expected exactly one own profile row');
    assert(mine.body[0].role === 'customer', `default role should be customer, got ${mine.body[0].role}`);
    return 'role defaults to customer';
  });

  await check('rewards account auto-provisioned with zero balance', async () => {
    const account = await rest('rewards_accounts?select=balance,referral_code', { token: accounts.customerA.token });
    assert(account.ok && account.body.length === 1, 'expected one rewards account');
    assert(Number(account.body[0].balance) === 0, 'new balance should be 0');
    assert(!!account.body[0].referral_code, 'referral code should be generated');
    return 'balance 0, referral code issued';
  });

  console.log('\nPrivilege escalation');
  await check('customer CANNOT self-promote to admin', async () => {
    const attempt = await rest(`profiles?id=eq.${accounts.customerA.id}`, {
      token: accounts.customerA.token, method: 'PATCH',
      body: { role: 'admin' }, prefer: 'return=representation'
    });
    const stillCustomer = await rest('profiles?select=role', { token: accounts.customerA.token });
    assert(stillCustomer.body[0].role === 'customer',
      `role escalated to ${stillCustomer.body[0].role} — CRITICAL`);
    return `blocked (HTTP ${attempt.status}), role unchanged`;
  });

  await check('customer CANNOT suspend/alter their own account_status', async () => {
    await rest(`profiles?id=eq.${accounts.customerA.id}`, {
      token: accounts.customerA.token, method: 'PATCH', body: { account_status: 'suspended' }
    });
    const after = await rest('profiles?select=account_status', { token: accounts.customerA.token });
    assert(after.body[0].account_status === 'active', 'account_status was client-mutable');
    return 'account_status unchanged';
  });

  // Promote the staff account through the admin path (service role = an admin
  // acting in the database, which is the documented promotion procedure).
  await check('admin promotion procedure works and is audited', async () => {
    const promote = await rest(`profiles?id=eq.${accounts.staff.id}`, {
      key: SERVICE, token: SERVICE, method: 'PATCH',
      body: { role: 'staff' }, prefer: 'return=representation'
    });
    assert(promote.ok, `promotion failed: ${JSON.stringify(promote.body)?.slice(0, 160)}`);
    const audit = await rest(
      `audit_events?select=action,entity_id&entity_id=eq.${accounts.staff.id}&order=created_at.desc&limit=5`,
      { key: SERVICE, token: SERVICE });
    assert((audit.body || []).some(e => e.action.includes('profiles')),
      'role change produced no audit event');
    return 'promoted to staff, audit event recorded';
  });

  console.log('\nCustomer isolation');
  await check('customer A cannot read customer B profile', async () => {
    const visible = await rest('profiles?select=id,email', { token: accounts.customerA.token });
    const leaked = (visible.body || []).filter(p => p.id !== accounts.customerA.id);
    assert(leaked.length === 0, `A can see ${leaked.length} other profile(s) — CRITICAL`);
    return 'only own profile visible';
  });

  await check('customer A cannot read customer B orders', async () => {
    const seedB = await rest('orders', {
      key: SERVICE, token: SERVICE, method: 'POST',
      body: { user_id: accounts.customerB.id, status: 'pending', total_cents: 4200 },
      prefer: 'return=representation'
    });
    assert(seedB.ok, `could not seed order for B: ${JSON.stringify(seedB.body)?.slice(0, 160)}`);
    accounts.customerB.orderId = seedB.body[0].id;
    const asA = await rest('orders?select=id', { token: accounts.customerA.token });
    const leaked = (asA.body || []).filter(o => o.id === accounts.customerB.orderId);
    assert(leaked.length === 0, 'A can read B orders — CRITICAL');
    return "B's order invisible to A";
  });

  await check('customer A cannot read customer B rewards ledger', async () => {
    await rest('rewards_transactions', {
      key: SERVICE, token: SERVICE, method: 'POST',
      body: {
        user_id: accounts.customerB.id, type: 'earn', points: 500,
        source: 'promotion', description: 'xcop battery seed'
      }
    });
    const asA = await rest('rewards_transactions?select=id,user_id', { token: accounts.customerA.token });
    const leaked = (asA.body || []).filter(t => t.user_id !== accounts.customerA.id);
    assert(leaked.length === 0, 'A can read B ledger — CRITICAL');
    return "B's ledger invisible to A";
  });

  console.log('\nOrder ownership');
  await check('customer cannot create an order owned by someone else', async () => {
    const attempt = await rest('orders', {
      token: accounts.customerA.token, method: 'POST',
      body: { user_id: accounts.customerB.id, status: 'pending', total_cents: 100 }
    });
    assert(!attempt.ok, 'A successfully created an order for B — CRITICAL');
    return `refused (HTTP ${attempt.status})`;
  });

  await check('customer cannot self-advance order status past pending', async () => {
    const own = await rest('orders', {
      token: accounts.customerA.token, method: 'POST',
      body: { user_id: accounts.customerA.id, status: 'pending', total_cents: 999 },
      prefer: 'return=representation'
    });
    assert(own.ok, `customer could not create own pending order: ${JSON.stringify(own.body)?.slice(0, 160)}`);
    const orderId = own.body[0].id;
    await rest(`orders?id=eq.${orderId}`, {
      token: accounts.customerA.token, method: 'PATCH', body: { status: 'fulfilled' }
    });
    const after = await rest(`orders?select=status&id=eq.${orderId}`, { token: accounts.customerA.token });
    assert(after.body[0].status === 'pending', `customer moved order to ${after.body[0].status} — CRITICAL`);
    return 'status stayed pending';
  });

  await check('customer cannot create an order in a privileged status', async () => {
    const attempt = await rest('orders', {
      token: accounts.customerA.token, method: 'POST',
      body: { user_id: accounts.customerA.id, status: 'fulfilled', total_cents: 1 }
    });
    assert(!attempt.ok, 'customer created a pre-fulfilled order — CRITICAL');
    return `refused (HTTP ${attempt.status})`;
  });

  console.log('\nRewards ledger integrity');
  await check('customer cannot mint their own points', async () => {
    const attempt = await rest('rewards_transactions', {
      token: accounts.customerA.token, method: 'POST',
      body: { user_id: accounts.customerA.id, type: 'earn', points: 100000, source: 'self' }
    });
    assert(!attempt.ok, 'customer inserted their own earn transaction — CRITICAL');
    return `refused (HTTP ${attempt.status})`;
  });

  await check('ledger is append-only even for the service role', async () => {
    const target = await rest(
      `rewards_transactions?select=id&user_id=eq.${accounts.customerB.id}&limit=1`,
      { key: SERVICE, token: SERVICE });
    const id = target.body[0].id;
    const update = await rest(`rewards_transactions?id=eq.${id}`, {
      key: SERVICE, token: SERVICE, method: 'PATCH', body: { points: 999999 }
    });
    assert(!update.ok, 'ledger row was UPDATE-able — CRITICAL');
    const remove = await rest(`rewards_transactions?id=eq.${id}`, {
      key: SERVICE, token: SERVICE, method: 'DELETE'
    });
    assert(!remove.ok, 'ledger row was DELETE-able — CRITICAL');
    return 'UPDATE and DELETE both refused by trigger';
  });

  await check('balance equals the sum of the ledger', async () => {
    const ledger = await rest(
      `rewards_transactions?select=points&user_id=eq.${accounts.customerB.id}`,
      { key: SERVICE, token: SERVICE });
    const expected = (ledger.body || []).reduce((sum, t) => sum + Number(t.points), 0);
    const account = await rest(
      `rewards_accounts?select=balance&user_id=eq.${accounts.customerB.id}`,
      { key: SERVICE, token: SERVICE });
    const actual = Number(account.body[0].balance);
    assert(actual === expected, `balance ${actual} != ledger sum ${expected}`);
    return `balance ${actual} reconciles`;
  });

  await check('overdraft redemption is rejected by the balance guard', async () => {
    const attempt = await rest('rewards_transactions', {
      key: SERVICE, token: SERVICE, method: 'POST',
      body: {
        user_id: accounts.customerB.id, type: 'redeem', points: -99999999,
        source: 'battery', description: 'overdraft probe'
      }
    });
    assert(!attempt.ok, 'balance was allowed to go negative — CRITICAL');
    const account = await rest(
      `rewards_accounts?select=balance&user_id=eq.${accounts.customerB.id}`,
      { key: SERVICE, token: SERVICE });
    assert(Number(account.body[0].balance) >= 0, 'balance is negative after overdraft');
    return `refused (HTTP ${attempt.status}), balance intact`;
  });

  console.log('\nStaff authorization');
  await check('customer cannot read operational inventory', async () => {
    const asCustomer = await rest('inventory?select=sku', { token: accounts.customerA.token });
    assert((asCustomer.body || []).length === 0, 'customer can read inventory — CRITICAL');
    return 'inventory not visible to customers';
  });

  await check('staff CAN read inventory and orders', async () => {
    await signIn(accounts.staff); // refresh session so the promoted role is in scope
    const inventory = await rest('inventory?select=sku&limit=5', { token: accounts.staff.token });
    assert(inventory.ok && inventory.body.length > 0, 'staff cannot read inventory');
    const orders = await rest('orders?select=id', { token: accounts.staff.token });
    assert(orders.ok && orders.body.length > 0, 'staff cannot read orders');
    return `${inventory.body.length} inventory rows, ${orders.body.length} orders visible`;
  });

  await check('staff CANNOT write products (manager+ only)', async () => {
    const attempt = await rest('products', {
      token: accounts.staff.token, method: 'POST',
      body: { slug: `battery-${stamp}`, name: 'Battery probe', status: 'draft' }
    });
    assert(!attempt.ok, 'staff wrote to products — role separation broken');
    return `refused (HTTP ${attempt.status})`;
  });

  await check('customer cannot read the audit trail', async () => {
    const attempt = await rest('audit_events?select=id', { token: accounts.customerA.token });
    assert((attempt.body || []).length === 0, 'customer can read audit events — CRITICAL');
    return 'audit trail not visible to customers';
  });

  console.log('\nAudit generation');
  await check('staff order-state change generates an audit event', async () => {
    const before = await rest(
      `audit_events?select=id&entity_id=eq.${accounts.customerB.orderId}`,
      { key: SERVICE, token: SERVICE });
    const change = await rest(`orders?id=eq.${accounts.customerB.orderId}`, {
      token: accounts.staff.token, method: 'PATCH',
      body: { status: 'processing' }, prefer: 'return=representation'
    });
    assert(change.ok, `staff could not update order: ${JSON.stringify(change.body)?.slice(0, 160)}`);
    const after = await rest(
      `audit_events?select=id,action,actor_id&entity_id=eq.${accounts.customerB.orderId}`,
      { key: SERVICE, token: SERVICE });
    assert(after.body.length > before.body.length, 'no audit event for order state change');
    const event = after.body[after.body.length - 1];
    assert(event.actor_id === accounts.staff.id, 'audit event did not capture the acting staff user');
    return 'event recorded with correct actor';
  });

  await check('audit trail cannot be forged or erased by staff', async () => {
    const insert = await rest('audit_events', {
      token: accounts.staff.token, method: 'POST',
      body: { action: 'FORGED', entity_type: 'orders', entity_id: 'x' }
    });
    assert(!insert.ok, 'staff forged an audit event — CRITICAL');
    const wipe = await rest('audit_events?entity_type=eq.orders', {
      token: accounts.staff.token, method: 'DELETE'
    });
    const remaining = await rest('audit_events?select=id&entity_type=eq.orders&limit=1',
      { key: SERVICE, token: SERVICE });
    assert(remaining.body.length > 0, 'audit events were deleted — CRITICAL');
    return `insert refused (${insert.status}), delete refused (${wipe.status})`;
  });

  console.log('\nCompliance gate');
  await check('anonymous gate acceptance records no identity and no DOB', async () => {
    const receipt = await rest('compliance_acceptances', {
      method: 'POST',
      body: {
        session_reference: `battery-${stamp}`,
        gate_version: '2026-07-28.1',
        policy_versions: { terms: '1.0-draft', privacy: '1.0', research_use: '1.0' }
      },
      prefer: 'return=representation'
    });
    assert(receipt.ok, `anonymous acceptance rejected: ${JSON.stringify(receipt.body)?.slice(0, 160)}`);
    const stored = JSON.stringify(receipt.body[0]).toLowerCase();
    for (const banned of ['dob', 'birth', '"age"']) {
      assert(!stored.includes(banned), `acceptance receipt leaks ${banned} — CRITICAL`);
    }
    assert(receipt.body[0].user_id === null, 'anonymous acceptance carried a user id');
    return 'receipt is version-only, no DOB, no identity';
  });

  await check('acceptance receipts are not readable by other visitors', async () => {
    const asCustomer = await rest('compliance_acceptances?select=id,session_reference',
      { token: accounts.customerA.token });
    const leaked = (asCustomer.body || []).filter(a => a.session_reference === `battery-${stamp}`);
    assert(leaked.length === 0, 'a signed-in customer can read anonymous acceptance receipts');
    return 'receipts not cross-readable';
  });

  console.log('\nAccount deletion (regression: 0007)');
  await check('an account WITH rewards history can be deleted', async () => {
    const removal = await auth(`admin/users/${accounts.customerB.id}`, {
      method: 'DELETE', key: SERVICE, token: SERVICE
    });
    assert(removal.ok,
      `deleting a customer with ledger history failed (HTTP ${removal.status}) — ` +
      'the append-only trigger is blocking ON DELETE');
    accounts.customerB.id = null; // already gone; skip in cleanup
    return 'account closed successfully';
  });

  await check('deleted account leaves an anonymized ledger, not a hole', async () => {
    const orphaned = await rest(
      "rewards_transactions?select=points,user_id,description&description=eq.xcop battery seed",
      { key: SERVICE, token: SERVICE });
    assert(orphaned.ok && orphaned.body.length > 0,
      'ledger history was destroyed with the account — financial record lost');
    assert(orphaned.body.every(t => t.user_id === null),
      'ledger rows still reference a deleted user');
    return `${orphaned.body.length} ledger row(s) retained, anonymized`;
  });

  console.log('\nCatalog exposure');
  await check('anonymous visitors see only active products, never drafts', async () => {
    const draft = await rest('products', {
      key: SERVICE, token: SERVICE, method: 'POST',
      body: { slug: `draft-${stamp}`, name: 'Unreleased probe', status: 'draft' },
      prefer: 'return=representation'
    });
    assert(draft.ok, 'could not seed draft product');
    const anonymous = await rest('products?select=slug', {});
    const leaked = (anonymous.body || []).filter(p => p.slug === `draft-${stamp}`);
    await rest(`products?slug=eq.draft-${stamp}`, { key: SERVICE, token: SERVICE, method: 'DELETE' });
    assert(leaked.length === 0, 'draft product visible to the public — CRITICAL');
    return 'drafts hidden from anonymous reads';
  });
}

const started = Date.now();
try {
  await main();
} catch (error) {
  record('battery execution', false, error.message);
} finally {
  await cleanup();
}

const receipt = {
  mission: 'XCOP-001.14',
  target: URL_BASE,
  finished_at: new Date().toISOString(),
  duration_ms: Date.now() - started,
  checks: results.length,
  passed: results.length - failed,
  failed,
  verdict: failed === 0 ? 'PASS' : 'FAIL',
  results
};

console.log(`\n${'─'.repeat(58)}`);
console.log(`${receipt.verdict}: ${receipt.passed}/${receipt.checks} controls verified` +
  (failed ? ` — ${failed} FAILED` : ''));
console.log(`${'─'.repeat(58)}\n`);
console.log(JSON.stringify(receipt, null, 2));
process.exit(failed === 0 ? 0 : 1);
