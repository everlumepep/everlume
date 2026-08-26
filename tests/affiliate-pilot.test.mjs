import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260826105743_affiliate_pilot.sql'), 'utf8');
const account = fs.readFileSync(path.join(root, 'js/account.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8');

test('affiliate pilot has application, approval, code, and pending estimate boundaries', () => {
  assert.match(migration, /create table public\.affiliate_applications/);
  assert.match(migration, /create table public\.affiliate_commissions/);
  assert.match(migration, /status in \('pending', 'approved', 'declined'\)/);
  assert.match(migration, /status in \('pending', 'void'\)/);
  assert.match(migration, /review_affiliate_application/);
  assert.match(migration, /affiliate_code text unique/);
  assert.match(migration, /new\.user_id := auth\.uid\(\)/);
  assert.match(migration, /select email into new\.email from auth\.users/);
  assert.match(migration, /enable row level security/g);
  assert.doesNotMatch(migration, /status in \([^)]*paid|payout_account|bank_account|tax_id/i);
});

test('customer surface captures affiliate links and never promises payout', () => {
  assert.match(auth, /affiliate_code: affiliateCode/);
  assert.match(account, /Submit application/);
  assert.match(account, /Your unique link/);
  assert.match(account, /Pending estimates are not payable balances/);
  assert.doesNotMatch(account, /Request payout|Connect bank|paid commission/i);
});
