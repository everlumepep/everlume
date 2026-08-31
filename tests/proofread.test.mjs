import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = ['index.html','catalog.html','contact.html','privacy.html','refund.html','research-use.html','shipping.html','terms.html','product.html','cart.html','checkout.html','account/index.html','account/signin.html','account/reset.html','command/index.html','ops-dashboard/index.html','js/account.js','js/auth.js','js/checkout.js','js/gate.js','js/pep-talk.js','js/product.js','ops-dashboard/ops.js'];
const copy = files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

test('customer-facing copy contains no known misspellings or inconsistent policy variants', () => {
  const prohibited = /acknowledgement|authorisation|unauthorised|gramat|mispell|repetet|pewople|waebsite|navigaate|recieve|occured|seperate|definately|cancelled|fulfilment|catalogue|organisation/gi;
  assert.doesNotMatch(copy, prohibited);
  assert.doesNotMatch(copy, /Effective [A-Z][a-z]+ \d{1,2}, \d{4}\. This/);
});

test('public pages contain no draft placeholders', () => {
  assert.doesNotMatch(copy, /lorem ipsum|TODO|FIXME|insert copy here|coming soon copy/gi);
});
