import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'ops-dashboard/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'ops-dashboard/ops.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ops-dashboard/ops.css'), 'utf8');

test('operations surface is private-by-default and has every governed module', () => {
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(html, /NO CLIENT DATA LOADED/);
  for (const view of ['overview', 'orders', 'inventory', 'income', 'expenses', 'catalog', 'exceptions', 'handoffs', 'affiliates', 'shipping']) {
    assert.match(html, new RegExp(`data-view="${view}"`));
  }
});

test('shipping module is client-controlled, thermal-ready, and cannot purchase postage', () => {
  assert.match(html, /data-view="shipping"/);
  assert.match(js, /Shippo Starter/);
  assert.match(js, /4 × 6/);
  assert.match(js, /No monthly subscription fee/);
  assert.match(js, /Manual workspace ready/);
  assert.match(js, /API order sync/);
  assert.match(js, /Pickup or arranged drop-off/);
  assert.match(js, /Automatic mileage approval/);
  assert.match(js, /sender\/return address/);
  assert.match(js, /does not store a password or payment method/);
  assert.match(js, /Production fulfillment/);
  assert.doesNotMatch(js, /SHIPPO_API|SHIPPO_TOKEN|shippo_token|createLabel\s*\(|purchaseLabel\s*\(/i);
});

test('equal Everlume ownership is separate from system access', () => {
  assert.match(js, /Denisha Phillips/);
  assert.match(js, /Veronicah Williams/);
  assert.match(js, /Co-owner · 50%/);
  assert.match(js, /Ownership does not automatically grant a separate system session/);
});

test('dashboard loads the shared Supabase runtime without privileged credentials', () => {
  for (const source of ['runtime-config.js', 'vendor/supabase.js', 'config.js', 'supabase-client.js', 'ops.js']) {
    assert.match(html, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const table of ['profiles', 'products', 'inventory', 'orders', 'order_items', 'order_exceptions', 'affiliate_applications', 'affiliate_commissions', 'audit_events']) {
    assert.match(js, new RegExp(`from\\('${table}'\\)`));
  }
  assert.doesNotMatch(js, /service_role|SUPABASE_SERVICE|STRIPE_SECRET|WEBHOOK_SECRET/);
});

test('authentication, staff authorization, and fail-closed behavior are explicit', () => {
  assert.match(js, /client\.auth\.getSession\(\)/);
  assert.match(js, /\['staff', 'manager', 'admin'\]\.includes\(profile\.role\)/);
  assert.match(js, /Sign in required/);
  assert.match(js, /Access restricted/);
  assert.match(js, /No fallback client records were shown/);
  assert.match(html, /read-only operations desk/i);
});

test('dashboard permits only the governed affiliate review action and no commerce writes', () => {
  assert.doesNotMatch(js, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/);
  assert.match(js, /\.rpc\('review_affiliate_application'/);
  assert.doesNotMatch(js, /requestPayout|createPayout|payout_account|bank_account|status:\s*['"]paid/i);
  assert.doesNotMatch(js, /dose calculator|injection|reconstitution|prescrib|treatment/i);
  assert.match(js, /Counts are never inferred/);
  assert.match(js, /cannot enable commerce or change inventory/);
});

test('responsive and accessibility safeguards remain present', () => {
  assert.match(html, /Skip to dashboard/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('operational totals derive from live records rather than hardcoded activity', () => {
  assert.match(js, /data\.income\.filter/);
  assert.match(js, /data\.inventory\.reduce/);
  assert.match(js, /data\.exceptions\.filter/);
  assert.match(js, /ordersResult\.data/);
  assert.doesNotMatch(js, /SYN-\d+|fixture\.orders|fixture\.inventory_snapshot/);
});

test('filter, local export, freshness, and release boundaries are present', () => {
  assert.match(js, /table-search/);
  assert.match(js, /Export visible CSV/);
  assert.match(js, /Refreshed/);
  assert.match(js, /Production release/);
  assert.match(js, /Commerce release/);
  assert.match(js, /Semax is recorded at \$30/);
  assert.match(js, /Lipo C is recorded at \$45/);
  assert.doesNotMatch(js, /navigator\.sendBeacon|WebSocket|EventSource/);
});
