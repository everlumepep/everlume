// XCOP-001 E6 — production certification battery.
//
// Runs the PUBLIC half of the E6 checklist against a live host. Dependency-free.
//
//   node scripts/certify.mjs https://deploy-preview-2--everlume1.netlify.app
//   node scripts/certify.mjs https://myeverlume.com
//
// The BACKEND half (authentication, RLS, customer isolation, order creation,
// inventory impact, audit events) is NOT covered here — it needs a provisioned
// Supabase project and lives in scripts/live-verify.mjs. This script reports
// that boundary rather than quietly implying full certification.
//
// Exit 0 = every public check passed. Exit 1 = at least one failed.

const target = (process.argv[2] || '').replace(/\/$/, '');
if (!target) {
  console.error('usage: node scripts/certify.mjs https://host');
  process.exit(2);
}

const results = [];
let failed = 0;

function record(group, name, ok, detail = '') {
  results.push({ group, name, ok, detail });
  if (!ok) failed++;
  console.log(`  ${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path) {
  const url = `${target}/${path.replace(/^\//, '')}`;
  const res = await fetch(url, { redirect: 'follow' });
  const body = res.headers.get('content-type')?.includes('text') || path.endsWith('.js')
    ? await res.text() : '';
  return { status: res.status, headers: res.headers, body, url };
}

async function expectStatus(group, path, want, label) {
  try {
    const r = await get(path);
    record(group, label || path, r.status === want, `HTTP ${r.status}${r.status === want ? '' : ` (want ${want})`}`);
    return r;
  } catch (e) {
    record(group, label || path, false, e.message);
    return null;
  }
}

console.log(`\nXCOP-001 E6 — public certification`);
console.log(`Target: ${target}\n`);

// ── A. Canonical surfaces reachable ────────────────────────────────────────
console.log('A. Public surfaces');
const PAGES = [
  '', 'index.html', 'product.html?slug=tirzepatide-10mg', 'cart.html', 'checkout.html',
  'account/', 'account/signin.html', 'account/reset.html',
  'privacy.html', 'terms.html', 'research-use.html', 'shipping.html', 'refund.html',
  'contact.html', '404.html', 'robots.txt'
];
for (const p of PAGES) await expectStatus('A', p, 200);

// ── B. Internal surfaces refused ───────────────────────────────────────────
console.log('\nB. Deployment boundary (must all 404)');
const INTERNAL = [
  'command', 'command/', 'command/index.html', 'js/command.js',
  'everlume-research-catalog.png', 'everlume-built.zip',
  'docs/commerce/README.md', 'docs/commerce/03-payment-adapter-contract.md',
  'supabase/migrations/20260728000003_commerce.sql',
  'supabase/migrations/20260730000008_commerce_state_and_ops.sql',
  'scripts/live-verify.mjs', 'scripts/certify.mjs', 'tests/schema.test.mjs',
  'ARCHITECTURE.md', 'CLIENT_HANDOFF.md', 'README.md',
  'package.json', 'package-lock.json', 'validate.mjs', '.gitignore'
];
for (const p of INTERNAL) await expectStatus('B', p, 404);

// ── C. Security headers ────────────────────────────────────────────────────
console.log('\nC. Security headers');
{
  const r = await get('');
  const need = {
    'content-security-policy': /default-src 'self'/,
    'x-frame-options': /DENY/i,
    'x-content-type-options': /nosniff/i,
    'referrer-policy': /strict-origin/i,
    'permissions-policy': /camera=/i
  };
  for (const [h, re] of Object.entries(need)) {
    const v = r.headers.get(h);
    record('C', h, Boolean(v && re.test(v)), v ? v.slice(0, 48) : 'absent');
  }
  const csp = r.headers.get('content-security-policy') || '';
  record('C', 'CSP forbids inline script', !/script-src[^;]*'unsafe-inline'/.test(csp),
    /script-src[^;]*'unsafe-inline'/.test(csp) ? 'unsafe-inline present' : "script-src 'self'");
}

// ── D. Cacheability (a reviewer must not see stale assets) ─────────────────
console.log('\nD. Asset freshness');
for (const asset of ['premium-theme.css', 'app.js', 'js/catalog.js']) {
  const r = await get(asset);
  const cc = r.headers.get('cache-control') || '';
  record('D', asset, /must-revalidate|no-cache|max-age=0/.test(cc), cc || 'no cache-control');
}

// ── E. Indexing posture ────────────────────────────────────────────────────
console.log('\nE. Controlled-preview posture');
{
  const robots = await get('robots.txt');
  record('E', 'robots.txt disallows crawling', /Disallow:\s*\//.test(robots.body), robots.body.trim().split('\n').slice(0, 2).join(' | '));
  for (const p of ['', 'cart.html', 'checkout.html', 'shipping.html']) {
    const r = await get(p);
    record('E', `noindex on /${p}`, /name="robots"\s+content="noindex/.test(r.body), '');
  }
}

// ── F. Responsive + accessibility basics ───────────────────────────────────
console.log('\nF. Responsive & accessibility');
for (const p of ['', 'cart.html', 'checkout.html', 'product.html']) {
  const r = await get(p);
  const viewport = /name="viewport"[^>]*width=device-width/.test(r.body);
  const skip = /class="skip-link"/.test(r.body);
  const lang = /<html lang="/.test(r.body);
  record('F', `/${p || 'index'} viewport · skip-link · lang`, viewport && skip && lang,
    [viewport ? 'viewport' : 'NO viewport', skip ? 'skip' : 'NO skip', lang ? 'lang' : 'NO lang'].join(' · '));
}

// ── G. Commerce authorization posture ──────────────────────────────────────
console.log('\nG. Commerce authorization (G1 / D-III)');
{
  const cat = await get('js/catalog.js');
  record('G', 'catalog ships nothing approved',
    !/compliance_status:\s*'approved'/.test(cat.body),
    "no hard-coded 'approved' product");
  const publishedPrices = [...cat.body.matchAll(/,\s*(6500|9800|6000|9000|11500|4500)\]/g)];
  record('G', 'catalog ships only client-confirmed prices',
    publishedPrices.length === 6, 'six exact product/format prices');
  record('G', 'authorization requires all axes to agree',
    /compliance_status !== 'approved'/.test(cat.body) && /price_cents === null/.test(cat.body),
    'status · compliance · price · stock');

  const checkout = await get('js/checkout.js');
  record('G', 'no simulated card capture in checkout',
    !/card number|cardnumber|cvv|cvc/i.test(checkout.body),
    'no card fields');
  record('G', 'payment state is explicit',
    /PENDING_PROVIDER/.test(checkout.body), 'PENDING_PROVIDER default');

  const cart = await get('js/cart.js');
  record('G', 'cart stores no prices (browser declares no financial truth)',
    !/unitCents:\s*line\./.test(cart.body) && /recomputed|never prices/i.test(cart.body),
    'slugs + quantities only');
}

// ── H. Forms ───────────────────────────────────────────────────────────────
console.log('\nH. Forms');
{
  const idx = await get('');
  // Netlify STRIPS data-netlify and netlify-honeypot at deploy time — that is
  // how it registers the form. Asserting those attributes on the deployed HTML
  // tests the source, not the running site, and fails against a working form.
  // What survives and actually functions: the form name and the honeypot field.
  const formName = /name=["']research-inquiry["']/.test(idx.body);
  const honeypotField = /name=["']bot-field["']/.test(idx.body);
  record('H', 'inquiry form registered with honeypot field',
    formName && honeypotField,
    `${formName ? 'name ✓' : 'name ✗'} · ${honeypotField ? 'bot-field ✓' : 'bot-field ✗'}`);
  record('H', 'research-use acknowledgement is required',
    /research-use-acknowledgment[^>]*required|required[^>]*research-use-acknowledgment/.test(idx.body)
      || /name="research-use-acknowledgment"[\s\S]{0,120}required/.test(idx.body), '');
  const blueprint = await get('forms 2.html');
  record('H', 'form registration blueprint deployed', blueprint.status === 200, `HTTP ${blueprint.status}`);
}

// ── Summary ────────────────────────────────────────────────────────────────
const byGroup = {};
for (const r of results) {
  byGroup[r.group] = byGroup[r.group] || { pass: 0, fail: 0 };
  r.ok ? byGroup[r.group].pass++ : byGroup[r.group].fail++;
}
console.log(`\n${'─'.repeat(62)}`);
for (const [g, s] of Object.entries(byGroup)) {
  console.log(`  ${g}: ${s.pass}/${s.pass + s.fail}${s.fail ? `  — ${s.fail} FAILED` : ''}`);
}
console.log(`${'─'.repeat(62)}`);
console.log(`PUBLIC CERTIFICATION: ${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
console.log(`
NOT COVERED (requires a provisioned Supabase project — E3):
  authentication · RLS · customer isolation · order creation ·
  inventory impact · audit events        → scripts/live-verify.mjs

PAYMENTS: this battery cannot certify a payment path. Until a processor is
approved and credentials exist, the correct status is STORE COMPLETE —
payment underwriting pending, which is NOT the same as LIVE.
${'─'.repeat(62)}\n`);
process.exit(failed ? 1 : 0);
