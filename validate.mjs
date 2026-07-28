import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

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
  'scripts/live-verify.mjs'
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

const config = readFileSync('js/config.js', 'utf8');
if (/eyJhbGciOi|sb_secret_/.test(config)) errors.push('config.js must never contain secret key material');

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Everlume validation passed: ${required.length} required files and ${pages.length} pages checked.`);
