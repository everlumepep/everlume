// XCOP-001.14 — offline migration + invariant verification.
//
// Runs the seven Everlume migrations against REAL Postgres (PGlite = PG16
// compiled to WASM), with a shim standing in for the parts Supabase's
// platform provides: the auth schema, auth.uid(), and the default grants to
// the anon/authenticated roles.
//
// This is NOT a substitute for live certification against the real project.
// It cannot test GoTrue, PostgREST, or webhook paths. What it CAN prove is
// that the migrations apply cleanly and that the database-level invariants
// (triggers, constraints, RLS) actually hold — none of which has ever been
// executed.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let PGlite;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  console.error('This harness needs PGlite (in-process Postgres):\n');
  console.error('  npm install\n');
  console.error('The core suite (npm test) stays dependency-free; only this');
  console.error('offline migration harness requires it.');
  process.exit(2);
}

const MIG_DIR = new URL('../supabase/migrations/', import.meta.url).pathname;
const results = [];
let failed = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}
async function check(name, fn) {
  try { record(name, true, (await fn()) || ''); }
  catch (e) { record(name, false, String(e.message).split('\n')[0].slice(0, 150)); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function expectFailure(db, sql, label) {
  try { await db.exec(sql); throw new Error(`__NO_ERROR__ ${label}`); }
  catch (e) {
    if (String(e.message).startsWith('__NO_ERROR__')) throw new Error(`${label} was ALLOWED but must be refused`);
    return String(e.message).split('\n')[0];
  }
}

const db = await PGlite.create();

// ── Shim: what the Supabase platform provides, not the migrations ─────────
await db.exec(`
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  -- auth.uid() reads a session setting, mirroring how Supabase derives it
  -- from the request JWT.
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
`);

console.log('\nXCOP-001.14 — offline migration & invariant verification');
console.log('Engine: PGlite (PostgreSQL 16, in-process)\n');

console.log('Migrations');
const files = readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort();
for (const file of files) {
  await check(`apply ${file}`, async () => {
    await db.exec(readFileSync(join(MIG_DIR, file), 'utf8'));
    return 'clean';
  });
}

// Supabase grants these by default; the migrations assume them.
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant all on all sequences in schema public to anon, authenticated;
`);

const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const many = async (sql, params) => (await db.query(sql, params)).rows;

console.log('\nProvisioning triggers');
let userA, userB, staff;
await check('new auth user auto-provisions a profile with role=customer', async () => {
  userA = (await one(`insert into auth.users (email, raw_user_meta_data)
                      values ('a@test.invalid', '{"first_name":"Ada"}'::jsonb) returning id`)).id;
  userB = (await one(`insert into auth.users (email) values ('b@test.invalid') returning id`)).id;
  staff = (await one(`insert into auth.users (email) values ('s@test.invalid') returning id`)).id;
  const p = await one(`select role, first_name from public.profiles where id = $1`, [userA]);
  assert(p, 'no profile created');
  assert(p.role === 'customer', `role=${p.role}`);
  assert(p.first_name === 'Ada', 'first_name not carried from metadata');
  return 'profile created, metadata carried';
});

await check('profile auto-provisions a rewards account (balance 0 + referral code)', async () => {
  const r = await one(`select balance, referral_code from public.rewards_accounts where user_id = $1`, [userA]);
  assert(r, 'no rewards account');
  assert(Number(r.balance) === 0, `balance=${r.balance}`);
  assert(r.referral_code?.length === 8, `referral_code=${r.referral_code}`);
  return `balance 0, code ${r.referral_code}`;
});

console.log('\nRewards ledger invariants');
await check('earn transaction updates the cached balance', async () => {
  await db.query(`insert into public.rewards_transactions (user_id, type, points, source, description)
                  values ($1,'earn',500,'promotion','harness')`, [userA]);
  const r = await one(`select balance from public.rewards_accounts where user_id=$1`, [userA]);
  assert(Number(r.balance) === 500, `balance=${r.balance}`);
  return 'balance 500';
});

await check('ledger UPDATE is refused (append-only)', async () => {
  const m = await expectFailure(db,
    `update public.rewards_transactions set points = 99999 where user_id = '${userA}'`, 'ledger update');
  assert(/append-only/.test(m), `unexpected error: ${m}`);
  return m.slice(0, 60);
});

await check('ledger DELETE is refused (append-only)', async () => {
  const m = await expectFailure(db,
    `delete from public.rewards_transactions where user_id = '${userA}'`, 'ledger delete');
  assert(/append-only/.test(m), `unexpected error: ${m}`);
  return m.slice(0, 60);
});

await check('overdraft redemption is refused by the balance guard', async () => {
  const m = await expectFailure(db,
    `insert into public.rewards_transactions (user_id, type, points, source)
     values ('${userA}','redeem',-99999,'harness')`, 'overdraft');
  assert(/negative/.test(m), `unexpected error: ${m}`);
  const r = await one(`select balance from public.rewards_accounts where user_id=$1`, [userA]);
  assert(Number(r.balance) === 500, 'balance changed despite refusal');
  return 'balance intact at 500';
});

await check('REGRESSION 0007 — account WITH rewards history can be deleted', async () => {
  await db.query(`delete from auth.users where id = $1`, [userA]);
  const gone = await one(`select count(*)::int c from auth.users where id=$1`, [userA]);
  assert(gone.c === 0, 'user still present');
  return 'deletion succeeded (pre-0007 this raised and blocked)';
});

await check('deleted account leaves an anonymized ledger, not a hole', async () => {
  const rows = await many(`select user_id, points from public.rewards_transactions where description='harness'`);
  assert(rows.length > 0, 'ledger history destroyed with the account');
  assert(rows.every(r => r.user_id === null), 'rows still reference a deleted user');
  const acct = await one(`select count(*)::int c from public.rewards_accounts where user_id=$1`, [userA]);
  assert(acct.c === 0, 'rewards account survived the cascade');
  return `${rows.length} ledger row(s) retained + anonymized; account cascaded`;
});

console.log('\nCommerce triggers & constraints');
// The count is incidental and moves whenever the client revises the catalog.
// The invariant that must never move: nothing arrives purchasable.
await check('every catalogued product is pending_review; only client-confirmed rows carry prices', async () => {
  const r = await one(`select count(*)::int total,
    count(*) filter (where compliance_status <> 'pending_review')::int bad_status,
    count(*) filter (where price_cents is not null)::int priced from public.products`);
  assert(r.total > 0, 'catalog is empty — the seed did not apply');
  assert(r.bad_status === 0, `${r.bad_status} product(s) not pending_review`);
  assert(r.priced === 8, `expected 8 confirmed prices, found ${r.priced}`);
  return `${r.total} products, 0 approved, 8 priced`;
});

await check('0009 — SKUs follow the client convention and are unique', async () => {
  const rows = await many(`select sku from public.inventory order by sku`);
  const bad = rows.filter(r => !/^EL-[A-Z0-9-]+$/.test(r.sku));
  assert(bad.length === 0, `non-conforming sku(s): ${bad.map(b => b.sku).join(', ')}`);
  assert(new Set(rows.map(r => r.sku)).size === rows.length, 'duplicate sku');
  for (const [name, prefix] of [['Tirzepatide', 'EL-TR'], ['Retatrutide', 'EL-RT']]) {
    const f = await many(
      `select i.sku from public.inventory i join public.products p on p.id = i.product_id
        where p.name = $1 order by i.sku`, [name]);
    assert(f.length === 5, `expected 5 ${name} formats, got ${f.length}`);
    for (const mg of [10, 20, 30, 40, 50]) {
      assert(f.some(x => x.sku === `${prefix}${mg}`), `missing ${prefix}${mg}`);
    }
  }
  return `${rows.length} SKUs · Tirzepatide and Retatrutide both EL-TR/RT 10–50`;
});

await check('inventory status derives from quantity vs threshold', async () => {
  const inv = await one(`select id, sku from public.inventory limit 1`);
  await db.query(`update public.inventory set quantity_on_hand=100, reorder_threshold=5 where id=$1`, [inv.id]);
  let s = await one(`select status from public.inventory where id=$1`, [inv.id]);
  assert(s.status === 'ok', `expected ok, got ${s.status}`);
  await db.query(`update public.inventory set quantity_on_hand=3 where id=$1`, [inv.id]);
  s = await one(`select status from public.inventory where id=$1`, [inv.id]);
  assert(s.status === 'low', `expected low, got ${s.status}`);
  await db.query(`update public.inventory set quantity_on_hand=0 where id=$1`, [inv.id]);
  s = await one(`select status from public.inventory where id=$1`, [inv.id]);
  assert(s.status === 'out', `expected out, got ${s.status}`);
  return 'ok → low → out derived correctly';
});

await check('order number is auto-assigned from the sequence', async () => {
  const o = await one(`insert into public.orders (user_id, total_cents) values ($1, 1234)
                       returning order_number`, [userB]);
  assert(/^EL-\d+$/.test(o.order_number), `order_number=${o.order_number}`);
  return o.order_number;
});

await check('audit events are generated for protected changes', async () => {
  const before = (await one(`select count(*)::int c from public.audit_events`)).c;
  await db.query(`update public.products set name = name where slug = 'bpc-157'`);
  const after = (await one(`select count(*)::int c from public.audit_events`)).c;
  assert(after > before, 'product modification produced no audit event');
  return `${after - before} event(s) recorded`;
});

console.log('\nRow level security (as the authenticated role)');
await check('customer sees only their own profile', async () => {
  await db.exec(`set role authenticated;`);
  await db.query(`select set_config('test.uid', $1, false)`, [userB]);
  const rows = await many(`select id from public.profiles`);
  await db.exec(`reset role;`);
  assert(rows.length === 1 && rows[0].id === userB,
    `customer sees ${rows.length} profile(s)`);
  return 'exactly 1 row visible';
});

await check('customer CANNOT self-promote to admin', async () => {
  await db.exec(`set role authenticated;`);
  await db.query(`select set_config('test.uid', $1, false)`, [userB]);
  let refused = false, msg = '';
  try { await db.query(`update public.profiles set role='admin' where id=$1`, [userB]); }
  catch (e) { refused = true; msg = String(e.message).split('\n')[0]; }
  await db.exec(`reset role;`);
  const r = await one(`select role from public.profiles where id=$1`, [userB]);
  assert(r.role === 'customer', `ESCALATED to ${r.role}`);
  return refused ? msg.slice(0, 70) : 'silently ignored, role unchanged';
});

await check('customer cannot read operational inventory', async () => {
  await db.exec(`set role authenticated;`);
  await db.query(`select set_config('test.uid', $1, false)`, [userB]);
  const rows = await many(`select sku from public.inventory`);
  await db.exec(`reset role;`);
  assert(rows.length === 0, `customer sees ${rows.length} inventory row(s)`);
  return 'inventory hidden';
});

await check('customer cannot read the audit trail', async () => {
  await db.exec(`set role authenticated;`);
  await db.query(`select set_config('test.uid', $1, false)`, [userB]);
  const rows = await many(`select id from public.audit_events`);
  await db.exec(`reset role;`);
  assert(rows.length === 0, `customer sees ${rows.length} audit row(s)`);
  return 'audit trail hidden';
});

await check('role promotion is refused while ANY JWT context is present', async () => {
  await db.query(`select set_config('test.uid', $1, false)`, [userB]);   // customer context
  const m = await expectFailure(db,
    `update public.profiles set role='staff' where id='${staff}'`, 'promotion under customer JWT');
  assert(/only an admin/.test(m), `unexpected: ${m}`);
  return 'blocked even as the postgres superuser — defence in depth';
});

await check('staff CAN read inventory once promoted via the service path', async () => {
  // Service/migration context: no JWT, so auth.uid() is null — the documented
  // promotion procedure.
  await db.query(`select set_config('test.uid', '', false)`);
  await db.query(`update public.profiles set role='staff' where id=$1`, [staff]);
  await db.exec(`set role authenticated;`);
  await db.query(`select set_config('test.uid', $1, false)`, [staff]);
  const rows = await many(`select sku from public.inventory`);
  await db.exec(`reset role;`);
  assert(rows.length > 0, 'staff cannot read inventory');
  return `${rows.length} rows visible to staff`;
});

await check('anonymous visitor sees only active products', async () => {
  await db.query(`insert into public.products (slug, name, status) values ('probe-draft','Draft probe','draft')`);
  await db.exec(`set role anon;`);
  await db.query(`select set_config('test.uid', '', false)`);
  const rows = await many(`select slug from public.products where slug='probe-draft'`);
  await db.exec(`reset role;`);
  assert(rows.length === 0, 'draft product visible to anonymous');
  return 'drafts hidden from public reads';
});

await check('anonymous gate acceptance is insertable and carries no DOB', async () => {
  await db.exec(`set role anon;`);
  await db.query(`select set_config('test.uid', '', false)`);
  await db.query(`insert into public.compliance_acceptances (session_reference, gate_version, policy_versions)
                  values ('harness','2026-07-28.1','{"terms":"1.0-draft"}'::jsonb)`);
  await db.exec(`reset role;`);
  const row = await one(`select * from public.compliance_acceptances where session_reference='harness'`);
  const blob = JSON.stringify(row).toLowerCase();
  for (const banned of ['dob', 'birth']) assert(!blob.includes(banned), `receipt leaks ${banned}`);
  assert(row.user_id === null, 'anonymous acceptance carried a user id');
  return 'version-only receipt, no identity';
});


// ── 0008: three-machine state, invariants, inquiries, audited adjustment ────
await check('0008 — order carries three independent state machines', async () => {
  const cols = await many(`select column_name from information_schema.columns
    where table_name='orders' and column_name in
      ('commercial_status','payment_status','fulfillment_status')`);
  assert(cols.length === 3, `expected 3 state columns, got ${cols.length}`);
  return 'commercial · payment · fulfillment';
});

await check('0008 — INVARIANT: cannot ship without captured payment', async () => {
  const o = await one(`insert into public.orders (commercial_status, payment_status, fulfillment_status)
                       values ('confirmed','authorized','ready') returning id`);
  await expectFailure(db,
    `update public.orders set fulfillment_status='fulfilled' where id='${o.id}'`,
    'shipped while payment was merely authorized');
  return 'refused: fulfilled requires payment_status = captured';
});

await check('0008 — INVARIANT: no physical work on an unconfirmed order', async () => {
  await expectFailure(db,
    `insert into public.orders (commercial_status, payment_status, fulfillment_status)
     values ('pending','none','processing')`,
    'processing accepted on a pending order');
  return 'refused: processing requires commercial_status = confirmed';
});

await check('0008 — INVARIANT: failed payment cannot coexist with work in flight', async () => {
  await expectFailure(db,
    `insert into public.orders (commercial_status, payment_status, fulfillment_status)
     values ('confirmed','failed','ready')`,
    'failed payment accepted alongside ready fulfillment');
  return 'refused: failed/expired payment blocks in-flight fulfillment';
});

await check('0008 — adjust_inventory refuses without a reason', async () => {
  const inv = await one(`select sku from public.inventory limit 1`);
  await expectFailure(db,
    `select public.adjust_inventory('${inv.sku}', 5, '   ')`,
    'adjustment accepted with a blank reason');
  return 'refused: reason is mandatory';
});

await check('0008 — adjust_inventory refuses to drive stock negative', async () => {
  const inv = await one(`select sku from public.inventory limit 1`);
  await expectFailure(db,
    `select public.adjust_inventory('${inv.sku}', -9999, 'harness underflow probe')`,
    'adjustment drove stock below zero');
  return 'refused: would go below zero';
});

await check('0008 — adjust_inventory requires manager (refused as a customer)', async () => {
  const inv = await one(`select sku from public.inventory limit 1`);
  await db.query(`select set_config('test.uid', $1, false)`, [userB]);
  const m = await expectFailure(db,
    `select public.adjust_inventory('${inv.sku}', 5, 'customer attempt')`,
    'a customer adjusted stock');
  await db.query(`select set_config('test.uid', '', false)`);
  assert(/manager or admin/.test(m), `unexpected refusal: ${m}`);
  return 'refused: manager or admin required';
});

await check('0008 — adjust_inventory writes an audit row in the same transaction', async () => {
  // Promote with NO JWT context present: the role-protection trigger refuses
  // role changes whenever auth.uid() is set, even for the superuser.
  await db.query(`select set_config('test.uid', '', false)`);
  await db.query(`update public.profiles set role='manager' where id=$1`, [staff]);
  await db.query(`select set_config('test.uid', $1, false)`, [staff]);
  const inv = await one(`select sku, quantity_on_hand from public.inventory limit 1`);
  const before = await one(`select count(*)::int n from public.audit_events where action='inventory.adjusted'`);
  await db.query(`select public.adjust_inventory('${inv.sku}', 7, 'harness receipt')`);
  const after = await one(`select count(*)::int n from public.audit_events where action='inventory.adjusted'`);
  const row = await one(`select quantity_on_hand from public.inventory where sku='${inv.sku}'`);
  assert(after.n === before.n + 1, 'no audit row written');
  assert(row.quantity_on_hand === inv.quantity_on_hand + 7, 'stock not adjusted');
  const ev = await one(`select metadata from public.audit_events
                        where action='inventory.adjusted' order by created_at desc limit 1`);
  assert(String(ev.metadata.reason) === 'harness receipt', 'reason not recorded in audit');
  assert(ev.metadata.delta === 7, 'delta not recorded in audit');
  await db.query(`select set_config('test.uid', '', false)`);
  return `on hand ${inv.quantity_on_hand} → ${row.quantity_on_hand}, audit recorded with reason + delta`;
});

await check('0008 — anonymous can submit an inquiry but cannot read any back', async () => {
  await db.exec(`set role anon;`);
  await db.query(`select set_config('test.uid', '', false)`);
  await db.query(`insert into public.inquiries (name, email, message)
                  values ('Harness','h@example.test','probe')`);
  const seen = await many(`select id from public.inquiries`);
  await db.exec(`reset role;`);
  assert(seen.length === 0, `anonymous read back ${seen.length} inquiry row(s)`);
  return 'insert allowed, read refused';
});

console.log(`\n${'─'.repeat(60)}`);
console.log(`${failed === 0 ? 'PASS' : 'FAIL'}: ${results.length - failed}/${results.length} checks` +
  (failed ? ` — ${failed} FAILED` : ''));
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed ? 1 : 0);
