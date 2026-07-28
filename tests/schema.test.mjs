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
