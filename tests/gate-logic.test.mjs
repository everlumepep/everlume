import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDob, ageOn, evaluateGate, needsReconsent, makeGateRecord } from '../js/gate-logic.mjs';

const config = {
  MIN_AGE: 18,
  GATE_VERSION: '2026-07-28.1',
  POLICY_VERSIONS: { terms: '1.0-draft', privacy: '1.0', research_use: '1.0' }
};
const NOW = new Date(Date.UTC(2026, 6, 28)); // 2026-07-28
const allAcks = { terms: true, compliance: true };

test('parseDob accepts a valid date and rejects impossible ones', () => {
  assert.ok(parseDob('4', '30', '1990'));
  assert.equal(parseDob('2', '30', '1990'), null);   // no Feb 30 rollover
  assert.equal(parseDob('13', '01', '1990'), null);
  assert.equal(parseDob('0', '10', '1990'), null);
  assert.equal(parseDob('1', '1', '1899'), null);
  assert.equal(parseDob('a', 'b', 'c'), null);
  assert.equal(parseDob('', '', ''), null);
});

test('ageOn handles pre- and post-birthday correctly', () => {
  assert.equal(ageOn(parseDob('7', '28', '2008'), NOW), 18); // birthday today
  assert.equal(ageOn(parseDob('7', '29', '2008'), NOW), 17); // birthday tomorrow
  assert.equal(ageOn(parseDob('1', '1', '2000'), NOW), 26);
});

test('adult with all acknowledgements passes', () => {
  const result = evaluateGate({ month: '1', day: '15', year: '1990', acks: allAcks }, config, NOW);
  assert.deepEqual(result, { ok: true, underage: false, reasons: [] });
});

test('18th birthday today passes; 17-year-old is refused as underage', () => {
  assert.equal(evaluateGate({ month: '7', day: '28', year: '2008', acks: allAcks }, config, NOW).ok, true);
  const minor = evaluateGate({ month: '7', day: '29', year: '2008', acks: allAcks }, config, NOW);
  assert.equal(minor.ok, false);
  assert.equal(minor.underage, true);
});

test('future and absurd dates are invalid, not underage', () => {
  const future = evaluateGate({ month: '1', day: '1', year: '2030', acks: allAcks }, config, NOW);
  assert.equal(future.ok, false);
  assert.equal(future.underage, false);
  assert.ok(future.reasons.includes('invalid_dob'));
  const ancient = evaluateGate({ month: '1', day: '1', year: '1890', acks: allAcks }, config, NOW);
  assert.ok(ancient.reasons.includes('invalid_dob'));
});

test('each missing acknowledgement blocks entry', () => {
  for (const missing of ['terms', 'compliance']) {
    const acks = { ...allAcks, [missing]: false };
    const result = evaluateGate({ month: '1', day: '15', year: '1990', acks }, config, NOW);
    assert.equal(result.ok, false);
    assert.ok(result.reasons.includes('missing_ack_' + missing), missing);
  }
});

test('configurable minimum age is honored', () => {
  const config21 = { ...config, MIN_AGE: 21 };
  const result = evaluateGate({ month: '1', day: '15', year: '2007', acks: allAcks }, config21, NOW);
  assert.equal(result.underage, true);
});

test('needsReconsent: fresh visitor, malformed, stale versions all require the gate', () => {
  assert.equal(needsReconsent(null, config), true);
  assert.equal(needsReconsent('garbage', config), true);
  assert.equal(needsReconsent({}, config), true);
  const valid = makeGateRecord(config, NOW);
  assert.equal(needsReconsent(valid, config), false);
  assert.equal(needsReconsent({ ...valid, gateVersion: 'old' }, config), true);
  assert.equal(needsReconsent(
    { ...valid, policyVersions: { ...valid.policyVersions, terms: '0.9' } }, config), true);
  const bumpedPolicy = { ...config, POLICY_VERSIONS: { ...config.POLICY_VERSIONS, privacy: '2.0' } };
  assert.equal(needsReconsent(valid, bumpedPolicy), true);
});

test('the gate record retains no date of birth (data minimization)', () => {
  const record = makeGateRecord(config, NOW);
  const serialized = JSON.stringify(record).toLowerCase();
  for (const banned of ['dob', 'birth', 'day', 'month', 'year', 'age"']) {
    assert.ok(!serialized.includes(banned), `record leaks ${banned}`);
  }
  assert.deepEqual(Object.keys(record).sort(),
    ['acceptedAt', 'gateVersion', 'minAgeMet', 'policyVersions']);
});
