import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/gate.js', import.meta.url), 'utf8');

test('first arrival plays the intro before deciding whether consent is required', () => {
  assert.match(source, /const playIntro = !introSeen\(\)/);
  assert.match(source, /if \(requiresConsent \|\| playIntro\) openGate\(\{ requiresConsent, playIntro \}\)/);
  assert.ok(source.indexOf('if (playIntro)') < source.indexOf("form.addEventListener('submit'"));
});

test('intro is session-scoped while consent remains independently versioned', () => {
  assert.match(source, /sessionStorage\.getItem\(INTRO_STORAGE_KEY\)/);
  assert.match(source, /sessionStorage\.setItem\(INTRO_STORAGE_KEY, 'true'\)/);
  assert.match(source, /needsReconsent\(readStored\(\), config\)/);
});

test('first-time visitors see the confirmation after the intro', () => {
  assert.match(source, /if \(requiresConsent\) revealGate\(\); else revealSite\(\);/);
  assert.match(source, /panel\.setAttribute\('inert', ''\)/);
  assert.match(source, /panel\.removeAttribute\('inert'\)/);
});

test('post-confirmation reveal supersedes intro and panel-arrival states', () => {
  assert.match(source, /overlay\.classList\.remove\('is-intro', 'is-ready'\);\s*overlay\.classList\.add\('is-entering'\)/);
});
