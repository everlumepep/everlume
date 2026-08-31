import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('checkout offers a manually confirmed local handoff without promising a radius', () => {
  const html = read('checkout.html');
  const js = read('js/checkout.js');
  assert.match(html, /Local pickup or arranged drop-off/);
  assert.match(html, /does not guarantee local eligibility or a delivery radius/);
  assert.match(html, /name="local_postal"/);
  assert.match(js, /updateDeliveryFields/);
  assert.match(js, /Confirmed after local review/);
});

test('client-approved abbreviations are public presentation only', () => {
  const catalog = read('js/catalog.js');
  const home = read('index.html');
  assert.match(catalog, /name: `TR-\$\{dose\}`/);
  assert.match(catalog, /name: `RT-\$\{dose\}`/);
  assert.match(catalog, /never changes publication or commerce approval/);
  assert.doesNotMatch(home, />Tirzepatide<|>Retatrutide<|alt="[^"]*(Tirzepatide|Retatrutide)/);
});
