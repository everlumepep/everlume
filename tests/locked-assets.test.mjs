import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const dir = path.join(root, 'assets/products/locked-v1');
const expected = [
  'tirzepatide-10mg','tirzepatide-20mg','tirzepatide-30mg','tirzepatide-40mg','tirzepatide-50mg',
  'retatrutide-10mg','retatrutide-20mg','retatrutide-30mg','retatrutide-40mg','retatrutide-50mg',
  'tesamorelin','selank-10mg','kisspeptin-5mg','semax','ghk-cu','glutathione-1200mg','klow-blend',
  'kpv','bpc-157','tb-500','nad-plus-1000mg','mots-c','ss31-10mg','5-am','l-carnitine-600mg'
];

test('locked asset manifest contains every catalog SKU and no missing files', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(Object.keys(manifest.assets).length, expected.length);
  for (const slug of expected) {
    assert.ok(manifest.assets[slug], `missing manifest entry: ${slug}`);
    const file = path.join(root, manifest.assets[slug].file);
    assert.ok(fs.existsSync(file), `missing locked asset: ${slug}`);
    assert.match(fs.readFileSync(file, 'utf8'), /<svg[\s\S]*<image[\s\S]*data:image\/png;base64/);
  }
});

test('locked asset hashes match the approved SHA256SUMS index', () => {
  const sums = fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n');
  assert.equal(sums.length, expected.length);
  for (const line of sums) {
    const [hash, file] = line.split(/\s+/);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex');
    assert.equal(actual, hash, `hash mismatch: ${file}`);
  }
});
