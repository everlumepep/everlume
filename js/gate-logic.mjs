// Pure logic for the Everlume entry compliance gate.
// No DOM, no storage — fully unit-testable. The browser wiring lives in gate.js.

export const GATE_STORAGE_KEY = 'everlume.gate';

export function parseDob(month, day, year) {
  const m = Number(month), d = Number(day), y = Number(year);
  if (!Number.isInteger(m) || !Number.isInteger(d) || !Number.isInteger(y)) return null;
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject rollovers like Feb 30 → Mar 2.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export function ageOn(dob, now) {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// Evaluates a gate submission. Returns { ok, underage, reasons } and never
// includes the date of birth in its result — callers must not persist it.
export function evaluateGate(input, config, now = new Date()) {
  const reasons = [];
  const dob = parseDob(input.month, input.day, input.year);
  if (!dob) reasons.push('invalid_dob');
  else if (dob > now) reasons.push('invalid_dob');

  let underage = false;
  if (dob && dob <= now) {
    const age = ageOn(dob, now);
    if (age > 130) reasons.push('invalid_dob');
    else if (age < config.MIN_AGE) { underage = true; reasons.push('underage'); }
  }

  for (const ack of ['age', 'terms', 'privacy', 'compliance']) {
    if (!input.acks || !input.acks[ack]) reasons.push('missing_ack_' + ack);
  }

  return { ok: reasons.length === 0, underage, reasons };
}

// A stored pass record must match the current gate + policy versions exactly;
// anything else (missing, malformed, stale) requires re-consent.
export function needsReconsent(stored, config) {
  if (!stored || typeof stored !== 'object') return true;
  if (stored.gateVersion !== config.GATE_VERSION) return true;
  const pv = stored.policyVersions;
  if (!pv || typeof pv !== 'object') return true;
  for (const key of Object.keys(config.POLICY_VERSIONS)) {
    if (pv[key] !== config.POLICY_VERSIONS[key]) return true;
  }
  return stored.minAgeMet !== true;
}

// Data minimization: the pass record proves the gate was completed and under
// which versions — it deliberately contains no date of birth and no age.
export function makeGateRecord(config, now = new Date()) {
  return {
    gateVersion: config.GATE_VERSION,
    policyVersions: { ...config.POLICY_VERSIONS },
    minAgeMet: true,
    acceptedAt: now.toISOString()
  };
}
