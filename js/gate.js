// Everlume entry compliance gate — browser wiring.
// Loaded as <script type="module"> on gated pages (the storefront). Policy
// pages (terms, privacy, research-use) are intentionally NOT gated so the
// documents the gate references stay readable before acceptance.
import {
  GATE_STORAGE_KEY,
  evaluateGate,
  needsReconsent,
  makeGateRecord
} from './gate-logic.mjs';

const config = window.EVERLUME_CONFIG;

function readStored() {
  try { return JSON.parse(localStorage.getItem(GATE_STORAGE_KEY)); }
  catch { return null; }
}

function recordAcceptance(record) {
  // Anonymous visitors: local pass record only (no DOB retained anywhere).
  // If Supabase is configured, also log a versioned acceptance receipt keyed
  // by an opaque session reference — still no DOB, no identity.
  localStorage.setItem(GATE_STORAGE_KEY, JSON.stringify(record));
  const client = window.everlumeSupabase;
  if (!client) return;
  let ref = localStorage.getItem('everlume.session_ref');
  if (!ref) {
    ref = crypto.randomUUID();
    localStorage.setItem('everlume.session_ref', ref);
  }
  client.from('compliance_acceptances').insert({
    session_reference: ref,
    gate_version: record.gateVersion,
    policy_versions: record.policyVersions
  }).then(() => {}, () => {});
}

function template() {
  return `
  <div class="gate-scrim"></div>
  <div class="gate-reveal" aria-hidden="true"><span>EL</span><strong>EVERLUME</strong><small>ELEVATE · RENEW · GLOW</small></div>
  <div class="gate-panel" role="dialog" aria-modal="true" aria-labelledby="gateTitle">
    <p class="gate-brand">EVERLUME</p>
    <h2 id="gateTitle">Adult Access &amp; Product Acknowledgement</h2>
    <p class="gate-lead">This site presents laboratory research materials. Please confirm your date of birth and review the acknowledgements below to continue.</p>
    <form id="gateForm" novalidate>
      <fieldset class="gate-dob">
        <legend>Date of birth</legend>
        <label>Month<input name="month" inputmode="numeric" autocomplete="bday-month" maxlength="2" placeholder="MM" required></label>
        <label>Day<input name="day" inputmode="numeric" autocomplete="bday-day" maxlength="2" placeholder="DD" required></label>
        <label>Year<input name="year" inputmode="numeric" autocomplete="bday-year" maxlength="4" placeholder="YYYY" required></label>
      </fieldset>
      <label class="gate-check"><input type="checkbox" name="age"> <span>I confirm I am ${config.MIN_AGE} years of age or older.</span></label>
      <label class="gate-check"><input type="checkbox" name="terms"> <span>I have read and agree to the <a href="terms.html">Terms &amp; Conditions</a>.</span></label>
      <label class="gate-check"><input type="checkbox" name="privacy"> <span>I acknowledge the <a href="privacy.html">Privacy Policy</a>.</span></label>
      <label class="gate-check"><input type="checkbox" name="compliance"> <span>I acknowledge the <a href="research-use.html">Research-Use &amp; Compliance Notice</a>: products are for laboratory research only and are not for human or veterinary use.</span></label>
      <p class="gate-error" id="gateError" role="alert" aria-live="assertive"></p>
      <button class="btn btn-dark gate-enter" type="submit">Enter Everlume</button>
      <p class="gate-note">Your date of birth is checked in your browser and is not stored or transmitted.</p>
    </form>
    <div class="gate-refusal" id="gateRefusal" hidden>
      <h3>We're unable to provide access.</h3>
      <p>Everlume is available only to visitors who meet the minimum age requirement.</p>
    </div>
  </div>`;
}

function messageFor(reasons) {
  if (reasons.includes('invalid_dob')) return 'Please enter a valid date of birth.';
  if (reasons.some(r => r.startsWith('missing_ack'))) return 'Please review and confirm each acknowledgement to continue.';
  return 'Please complete the form to continue.';
}

function openGate() {
  const overlay = document.createElement('div');
  overlay.id = 'el-gate';
  overlay.innerHTML = template();
  document.body.appendChild(overlay);
  document.documentElement.classList.add('gate-open');

  const form = overlay.querySelector('#gateForm');
  const error = overlay.querySelector('#gateError');
  const refusal = overlay.querySelector('#gateRefusal');
  const focusables = () => overlay.querySelectorAll('a[href], button, input');
  overlay.querySelector('input[name="month"]').focus();

  // Keep keyboard focus inside the dialog until the gate is resolved.
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...focusables()].filter(el => !el.closest('[hidden]'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const result = evaluateGate({
      month: data.get('month'), day: data.get('day'), year: data.get('year'),
      acks: {
        age: data.get('age') === 'on',
        terms: data.get('terms') === 'on',
        privacy: data.get('privacy') === 'on',
        compliance: data.get('compliance') === 'on'
      }
    }, config);

    if (result.underage) {
      form.hidden = true;
      refusal.hidden = false;
      refusal.querySelector('h3').focus?.();
      return;
    }
    if (!result.ok) {
      error.textContent = messageFor(result.reasons);
      return;
    }
    recordAcceptance(makeGateRecord(config));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finishEntry = () => {
      overlay.remove();
      document.documentElement.classList.remove('gate-open');
      document.documentElement.classList.remove('gate-entering');
      document.querySelector('#main-content')?.focus();
    };
    if (reducedMotion) return finishEntry();

    form.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    overlay.classList.add('is-entering');
    document.documentElement.classList.add('gate-entering');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(finishEntry, 1550);
  });
}

if (needsReconsent(readStored(), config)) openGate();
