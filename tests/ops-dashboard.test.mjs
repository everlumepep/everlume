import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'ops-dashboard/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'ops-dashboard/ops.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ops-dashboard/ops.css'), 'utf8');

test('synthetic dashboard surface is present and explicitly local-only', () => {
  assert.match(html, /SYNTHETIC DATA · LOCAL ONLY/);
  assert.match(html, /noindex,nofollow,noarchive/);
  for (const view of ['overview','orders','inventory','income','expenses','catalog','exceptions','handoffs']) {
    assert.match(html, new RegExp(`data-view="${view}"`));
  }
});

test('fixture contains traceable operational domains and no client records', () => {
  for (const token of ['orders','inventory','income','expenses','catalog','exceptions','handoffs','audit','fixture.orders','fixture.inventory_snapshot','fixture.catalog_registry']) assert.match(js, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(js, /fabricated fixture only/);
  assert.doesNotMatch(js, /fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|supabase|googleapis|stripe/i);
});

test('read-only and unsafe calculator boundaries are enforced in the prototype', () => {
  assert.match(html, /Read-only preview/);
  assert.match(js, /disabled/);
  assert.doesNotMatch(js, /dose calculator|injection|reconstitution|prescrib|treatment/i);
  assert.match(js, /negative available stock/);
  assert.match(js, /joint decision remains pending/i);
});

test('responsive and accessibility safeguards exist', () => {
  assert.match(html, /Skip to dashboard/);
  assert.match(html, /aria-label="Dashboard role"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('operational totals are derived from source records rather than hardcoded metrics', () => {
  assert.match(js, /const received=data\.income\.filter/);
  assert.match(js, /const expensesTotal=data\.expenses\.reduce/);
  assert.match(js, /const available=data\.inventory\.reduce/);
  assert.match(js, /const openExceptions=data\.exceptions\.filter/);
  assert.doesNotMatch(js, /metrics:\{revenue:/);
});

test('filter, controlled export, freshness, and audit evidence are present', () => {
  assert.match(html, /Local fixture healthy/);
  assert.match(html, /EVD-SYN-20260824/);
  assert.match(js, /table-search/);
  assert.match(js, /Export synthetic CSV/);
  assert.match(js, /Reviewer export is blocked/);
  assert.match(js, /synthetic\.export/);
  assert.match(js, /fixture current/);
  assert.doesNotMatch(js, /navigator\.sendBeacon|WebSocket|EventSource/);
});
