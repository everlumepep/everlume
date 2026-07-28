import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';

const required = [
  'index.html',
  'research-use.html',
  'privacy.html',
  'terms.html',
  '404.html',
  'styles.css',
  'logo.css',
  'premium-theme.css',
  'gate.css',
  'portal.css',
  'app.js',
  'boot.js',
  'policy.js',
  'js/config.js',
  'js/gate-logic.mjs',
  'js/gate.js',
  'js/supabase-client.js',
  'js/auth.js',
  'js/reset.js',
  'js/account.js',
  'js/command.js',
  'vendor/supabase.js',
  'account/index.html',
  'account/signin.html',
  'account/reset.html',
  'command/index.html',
  'robots.txt',
  'netlify.toml',
  'assets/everlume-mark-v3.svg',
  'supabase/migrations/20260728000001_profiles_and_roles.sql',
  'supabase/migrations/20260728000002_compliance.sql',
  'supabase/migrations/20260728000003_commerce.sql',
  'supabase/migrations/20260728000004_rewards.sql',
  'supabase/migrations/20260728000005_audit.sql',
  'supabase/migrations/20260728000006_seed_products.sql',
  'supabase/migrations/20260728000007_ledger_account_deletion.sql',
  'scripts/live-verify.mjs',
  'scripts/verify-migrations.mjs'
];

const errors = [];
for (const file of required) {
  if (!existsSync(file)) errors.push(`Missing required file: ${file}`);
}

const pages = [
  'index.html', 'research-use.html', 'privacy.html', 'terms.html', '404.html',
  'account/index.html', 'account/signin.html', 'account/reset.html', 'command/index.html'
];
for (const page of pages) {
  if (!existsSync(page)) continue;
  const html = readFileSync(page, 'utf8');
  const references = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:)/.test(reference)) continue;
    let path = normalize(join(dirname(page), reference.split('?')[0]));
    if (path.endsWith('/') || path === '.') path = join(path, 'index.html');
    if (!existsSync(path)) errors.push(`${page} references missing file: ${path}`);
  }
  if (!/name="robots" content="noindex,nofollow/.test(html)) {
    errors.push(`${page} is missing controlled-preview robots metadata`);
  }
}

const publicCopy = ['index.html', 'app.js', 'js/gate.js', 'terms.html']
  .map(file => readFileSync(file, 'utf8'))
  .join('\n')
  .toLowerCase();

for (const phrase of ['weight loss', 'starter kit', 'syringe', 'dosage guide', 'injection site', 'anti-aging', 'therapeutic']) {
  if (publicCopy.includes(phrase)) errors.push(`Consumer-use phrase remains in public copy: ${phrase}`);
}

const netlify = readFileSync('netlify.toml', 'utf8');
if (!netlify.includes('Content-Security-Policy')) errors.push('Netlify CSP header is missing');
if (!netlify.includes('X-Content-Type-Options')) errors.push('Netlify content-type protection is missing');
if (!/connect-src 'self' https:\/\/\*\.supabase\.co/.test(netlify)) errors.push('CSP connect-src missing Supabase origin');

// ── Publish-surface control ────────────────────────────────────────────────
// netlify.toml sets publish = "." — EVERY tracked file at the root is served
// publicly at the client's domain. A text scan of index.html cannot see what
// else is shipping, which is exactly how a price/claims catalog was published
// while this validator reported green.
const tracked = execSync('git ls-files -z', { encoding: 'buffer' })
  .toString('utf8').split('\0').filter(Boolean);

// Hard rule: no binary/media/archive assets outside assets/ may be published.
// This is the class that carries claims a text scanner cannot read.
const MEDIA = /\.(png|jpe?g|gif|webp|avif|pdf|zip|tgz|gz|psd|ai|sketch|fig|mp4|mov)$/i;
for (const file of tracked) {
  if (!MEDIA.test(file)) continue;
  if (file.startsWith('assets/')) continue;
  errors.push(
    `Publishable media outside assets/: ${file} — every root file is served ` +
    `publicly; images and archives can carry pricing or claims this validator cannot read`
  );
}

// Structural exposure: non-site files that ship because publish = "."
const SITE = /^(index|404|privacy|terms|research-use|forms 2)\.html$|^account\/|^command\/|^assets\/|^js\/|^vendor\/|^(styles|logo|premium-theme|gate|portal)\.css$|^(app|boot|policy)\.js$|^favicon\.svg$|^robots\.txt$|^netlify\.toml$/;
const exposed = tracked.filter(f => !SITE.test(f));
if (exposed.length) {
  console.warn(
    `\n⚠  ${exposed.length} non-site file(s) would be published at the client domain ` +
    `because netlify.toml sets publish = "." :`
  );
  const byTop = {};
  for (const f of exposed) {
    const top = f.includes('/') ? f.split('/')[0] + '/' : f;
    byTop[top] = (byTop[top] || 0) + 1;
  }
  for (const [top, n] of Object.entries(byTop).sort((a, b) => b[1] - a[1])) {
    console.warn(`   ${String(n).padStart(4)}  ${top}`);
  }
  console.warn(
    `   Fix is a publish-directory restructure (move the site into its own\n` +
    `   folder and set publish to it) — a deployment change, pending decision.\n`
  );
}

const config = readFileSync('js/config.js', 'utf8');
if (/eyJhbGciOi|sb_secret_/.test(config)) errors.push('config.js must never contain secret key material');

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Everlume validation passed: ${required.length} required files and ${pages.length} pages checked.`);
