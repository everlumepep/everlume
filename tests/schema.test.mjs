// Static safety checks over the SQL migrations and the repo:
// every table must enable RLS, the ledger must be append-only, and no
// service-role credential may ever appear in the codebase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../supabase/migrations/', import.meta.url).pathname;
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const sql = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

const createdTables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map(m => m[1]);

test('all directive tables exist in the migrations', () => {
  for (const table of [
    'profiles', 'compliance_policies', 'compliance_acceptances',
    'products', 'inventory', 'addresses', 'orders', 'order_items',
    'rewards_accounts', 'rewards_transactions', 'rewards_rules',
    'rewards_redemptions', 'referrals', 'audit_events'
  ]) {
    assert.ok(createdTables.includes(table), `missing table ${table}`);
  }
});

test('every created table enables row level security', () => {
  for (const table of createdTables) {
    assert.ok(
      sql.includes(`alter table public.${table} enable row level security`),
      `RLS not enabled on ${table}`
    );
  }
});

test('rewards ledger is append-only and balance is trigger-maintained', () => {
  assert.match(sql, /rewards_transactions is append-only/);
  assert.match(sql, /trg_apply_rewards_transaction/);
  assert.ok(!/create policy "[^"]*" on public\.rewards_accounts\s+for (all|insert|update)/.test(sql),
    'rewards_accounts must not be client-writable');
});

test('published rewards and subscriptions are modeled without client-side financial writes', () => {
  assert.match(sql, /create table if not exists public\.subscriptions/);
  assert.match(sql, /create table if not exists public\.store_credit_transactions/);
  assert.match(sql, /'referral_credit'[\s\S]*"credit_cents":1000[\s\S]*true/);
  assert.match(sql, /'seventh_purchase_reward'[\s\S]*"qualifying_purchases":6[\s\S]*true/);
  assert.ok(!/create policy "[^"]*" on public\.store_credit_transactions\s+for insert\s+to authenticated/.test(sql));
  assert.ok(!/create policy "[^"]*" on public\.subscriptions\s+for insert\s+to authenticated/.test(sql));
});

test('account deletion cannot be blocked by the append-only ledger', () => {
  // Regression guard for the defect fixed in migration 0007: a cascade delete
  // into an unconditionally-raising trigger made account closure impossible.
  assert.match(sql, /on delete set null[\s\S]*rewards_transactions|rewards_transactions[\s\S]*on delete set null/,
    'rewards_transactions must not cascade-delete into the immutability trigger');
  assert.match(sql, /delete refused/, 'deletes must still be refused explicitly');
  assert.match(sql, /\(to_jsonb\(new\) - 'user_id'\) = \(to_jsonb\(old\) - 'user_id'\)/,
    'the anonymization carve-out must compare full rows so it cannot be abused');
});

test('audit events cannot be written by clients', () => {
  assert.ok(!/create policy "[^"]*" on public\.audit_events\s+for (all|insert|update|delete)/.test(sql),
    'audit_events must have no client write policy');
});

test('no credential material (JWTs, Supabase secrets) anywhere in the repo source', () => {
  // Matches actual key material, not prose mentioning key names:
  // JWT prefix, Supabase secret/personal-access-token prefixes.
  // (built from parts so this file does not match its own pattern)
  const credential = new RegExp('eyJ' + 'hbGciOi|sb_' + 'secret_|sbp_' + '[0-9a-f]{20,}');
  const roots = ['js', 'account', 'command', 'supabase/migrations', 'tests'];
  const offenders = [];
  const scan = path => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (credential.test(readFileSync(full, 'utf8'))) offenders.push(full);
    }
  };
  const base = new URL('..', import.meta.url).pathname;
  for (const root of roots) scan(join(base, root));
  ['index.html', 'netlify.toml'].forEach(f => {
    if (credential.test(readFileSync(join(base, f), 'utf8'))) offenders.push(f);
  });
  assert.deepEqual(offenders, []);
});

test('seeded products all start in pending_review (no implied approval)', () => {
  const seed = readFileSync(join(dir, files.find(f => f.includes('seed_products'))), 'utf8');
  assert.ok(!seed.includes("'approved'"), 'seed must not pre-approve compliance status');
});

// The storefront renders from a fallback catalog in js/catalog.js until the
// Supabase project exists. If that fallback drifts from the migrations, the
// pre-backend site shows a catalog the database would not agree with — a
// silent divergence with no runtime symptom. This test pins them together.
test('fallback catalog matches the migrated catalog', () => {
  const catalogJs = readFileSync(new URL('../js/catalog.js', import.meta.url), 'utf8');
  const migrations = ['20260728000006_seed_products.sql', '20260730000009_catalog_reconciliation.sql', '20260820000010_client_confirmed_prices.sql', '20260824000011_client_approved_semax_lipo_c.sql']
    .map(f => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8'))
    .join('\n');

  const fallbackSkus = [...catalogJs.matchAll(/'(EL-[A-Z0-9-]+)'/g)].map(m => m[1]).sort();
  const migrationSkus = [...new Set([...migrations.matchAll(/'(EL-[A-Z0-9-]+)'/g)].map(m => m[1]))].sort();

  assert.ok(fallbackSkus.length > 0, 'fallback catalog has no SKUs');
  assert.equal(new Set(fallbackSkus).size, fallbackSkus.length, 'duplicate SKU in fallback catalog');

  // Every SKU the storefront can show must exist in the migrations. The reverse
  // is not required: archived products keep an inventory row but are correctly
  // absent from the customer-facing fallback.
  const orphans = fallbackSkus.filter(s => !migrationSkus.includes(s));
  assert.deepEqual(orphans, [], `fallback SKUs not present in any migration: ${orphans.join(', ')}`);

  for (const prefix of ['EL-TR', 'EL-RT']) {
    const found = fallbackSkus.filter(s => s.startsWith(prefix));
    assert.equal(found.length, 5, `${prefix} should have 5 formats, got ${found.length}`);
  }
});

test('fallback catalog publishes only client-confirmed prices and invents no inventory', () => {
  const catalogJs = readFileSync(new URL('../js/catalog.js', import.meta.url), 'utf8');
  for (const receipt of [
    /'semax'.*3000, 'approved'/,
    /'lipo-c'.*4500, 'approved'/
  ]) assert.match(catalogJs, receipt, 'approved client register missing from fallback');
  assert.match(catalogJs, /complianceStatus = 'pending_review'/,
    'unapproved fallback products must remain pending_review');
  assert.match(catalogJs, /quantity_on_hand:\s*0/,
    'fallback must not invent stock for approved products');
});

// The commerce switch must only ever CLOSE the purchase path. If it could open
// one, it would become the G1 bypass that G1 explicitly forbids.
test('commerce flag is an additional gate, never a bypass', () => {
  const catalogJs = readFileSync(new URL('../js/catalog.js', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');

  assert.match(config, /COMMERCE_ENABLED:\s*runtime\.COMMERCE_ENABLED === true/,
    'COMMERCE_ENABLED must require an explicit true runtime gate');

  // The flag must ADD a refusal reason, not short-circuit the other checks.
  assert.match(catalogJs, /if \(!commerceEnabled\(\)\) reasons\.push\('commerce_closed'\)/,
    'flag must push a refusal reason');
  assert.ok(!/if \(commerceEnabled\(\)\)\s*return\s*\{\s*purchasable:\s*true/.test(catalogJs),
    'flag must never return purchasable directly');

  // Every original axis must still be evaluated after the flag check.
  for (const axis of [
    /product\.status !== 'active'/,
    /product\.compliance_status !== 'approved'/,
    /product\.price_cents === null/,
    /available\(product\) <= 0/
  ]) {
    assert.match(catalogJs, axis, 'an authorization axis was removed');
  }
});

test('cart and checkout refuse direct URL access when commerce is closed', () => {
  const cartPage = readFileSync(new URL('../js/cart-page.js', import.meta.url), 'utf8');
  const checkout = readFileSync(new URL('../js/checkout.js', import.meta.url), 'utf8');
  assert.match(cartPage, /commerceEnabled\(\)/, 'bag page does not check the commerce flag');
  assert.match(checkout, /commerceEnabled\(\)/, 'checkout does not check the commerce flag');
});

test('subscription creation is gated server-side and Pep Talk describes preview capabilities honestly', () => {
  const billing = readFileSync(new URL('../netlify/functions/create-subscription.mjs', import.meta.url), 'utf8');
  const helper = readFileSync(new URL('../netlify/functions/_billing.mjs', import.meta.url), 'utf8');
  const pepTalk = readFileSync(new URL('../js/pep-talk.js', import.meta.url), 'utf8');

  assert.match(helper, /process\.env\.BILLING_ENABLED === 'true'/,
    'billing authorization must be derived from a server environment variable');
  assert.match(billing, /if \(!billingEnabled\(\)\) return json\(503/,
    'the subscription endpoint must fail closed before authentication or Stripe calls');
  assert.match(pepTalk, /deterministic catalog guidance/i,
    'Pep Talk must identify its actual non-AI behavior');
  assert.match(pepTalk, /Subscriptions are not active on this preview/,
    'Pep Talk must not claim unavailable subscription functionality');
  assert.match(pepTalk, /Ordering is not active on this preview/,
    'Pep Talk must not claim unavailable order functionality');
});

test('COMMAND resolves only the signed-in staff profile', () => {
  const command = readFileSync(new URL('../js/command.js', import.meta.url), 'utf8');
  assert.match(command, /\.eq\('id',\s*session\.user\.id\)/,
    'COMMAND identity lookup must target the session user; staff RLS can expose multiple profiles');
});

test('COMMAND dashboard is source-backed and keeps financial definitions explicit', () => {
  const command = readFileSync(new URL('../js/command.js', import.meta.url), 'utf8');
  for (const source of ["from('orders')", "from('inventory')", "from('products')", "count('profiles')", "count('inquiries'"]) {
    assert.ok(command.includes(source), `dashboard source missing: ${source}`);
  }
  assert.match(command, /payment_status === 'captured'/,
    'revenue and AOV must be limited to captured payments');
  assert.match(command, /Last 14 days/,
    'dashboard must expose a bounded movement window');
  assert.match(command, /Live from Supabase/,
    'dashboard must identify source freshness');
  assert.match(command, /unavailable sources display an em dash rather than sample data/,
    'dashboard must disclose unavailable-source behavior');
});
