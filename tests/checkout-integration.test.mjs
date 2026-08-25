import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const endpoint = fs.readFileSync(path.join(root,'netlify/functions/create-checkout-session.mjs'),'utf8');
const webhook = fs.readFileSync(path.join(root,'netlify/functions/stripe-webhook.mjs'),'utf8');
const checkout = fs.readFileSync(path.join(root,'js/checkout.js'),'utf8');
const migration = fs.readFileSync(path.join(root,'supabase/migrations/20260824000012_one_time_checkout.sql'),'utf8');
const billing = fs.readFileSync(path.join(root,'netlify/functions/_billing.mjs'),'utf8');

test('one-time checkout requires every server-side release gate',()=>{
  assert.match(endpoint,/billingEnabled\(\)/);
  assert.match(endpoint,/COMMERCE_ENABLED !== 'true'/);
  assert.match(endpoint,/PAYMENT_STATE !== 'APPROVED'/);
  assert.match(endpoint,/userFrom\(event\)/);
});

test('browser sends identities only to the server and cannot set prices',()=>{
  assert.match(checkout,/items:item[s]?\.map\(item=>\(\{slug:item\.slug,quantity:item\.qty\}\)\)/);
  assert.doesNotMatch(checkout,/unit_amount|price_cents|subtotal_cents/);
  assert.match(endpoint,/rpc\/create_checkout_order/);
});

test('server checkout uses hosted payment and idempotency',()=>{
  assert.match(endpoint,/checkout\.sessions\.create/);
  assert.match(endpoint,/mode:'payment'/);
  assert.match(endpoint,/idempotencyKey:`everlume-order-\$\{order\.order_id\}`/);
  assert.match(endpoint,/payment_intent_data/);
  assert.match(endpoint,/release_checkout_order/);
  assert.match(billing,/SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(billing,/SUPABASE_SERVICE_ROLE_KEY/);
});

test('signed webhooks capture or release one-time orders',()=>{
  assert.match(webhook,/constructEvent/);
  assert.match(webhook,/checkout\.session\.completed/);
  assert.match(webhook,/capture_checkout_order/);
  assert.match(webhook,/checkout\.session\.expired/);
  assert.match(webhook,/release_checkout_order/);
});

test('database contract prices, reserves, captures, and releases atomically',()=>{
  for(const token of ['create_checkout_order','inventory_reservations','for update','capture_checkout_order','release_checkout_order','quantity_reserved','payment.captured']) assert.match(migration,new RegExp(token));
  assert.match(migration,/grant execute[\s\S]*service_role/);
  assert.match(migration,/revoke all[\s\S]*anon,authenticated/);
});
