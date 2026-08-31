import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';

const required = [
  'index.html',
  'catalog.html',
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
  'js/catalog.js',
  'js/cart.js',
  'js/cart-page.js',
  'js/product.js',
  'js/checkout.js',
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
  'cart.html',
  'product.html',
  'checkout.html',
  'shipping.html',
  'refund.html',
  'contact.html',
  'robots.txt',
  'netlify.toml',
  'assets/everlume-logo-client-master.png',
  'assets/everlume-logo-client-lockup.png',
  'assets/everlume-logo-client-monogram.png',
  'supabase/migrations/20260728000001_profiles_and_roles.sql',
  'supabase/migrations/20260728000002_compliance.sql',
  'supabase/migrations/20260728000003_commerce.sql',
  'supabase/migrations/20260728000004_rewards.sql',
  'supabase/migrations/20260728000005_audit.sql',
  'supabase/migrations/20260728000006_seed_products.sql',
  'supabase/migrations/20260728000007_ledger_account_deletion.sql',
  'scripts/live-verify.mjs',
  'scripts/verify-migrations.mjs',
  'scripts/certify.mjs'
];

const errors = [];
for (const file of required) {
  if (!existsSync(file)) errors.push(`Missing required file: ${file}`);
}

const pages = [
  'index.html', 'catalog.html', 'research-use.html', 'privacy.html', 'terms.html', '404.html',
  'cart.html', 'product.html', 'checkout.html', 'shipping.html', 'refund.html', 'contact.html',
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

// The controlled release is inquiry-only and intentionally ships no prices.
// Do not let promotional copy imply that a public price catalog exists while
// commerce and product authorization remain closed.
for (const phrase of ['price catalog', 'introductory pricing', 'straightforward pricing']) {
  if (publicCopy.includes(phrase)) errors.push(`Pricing promise contradicts inquiry-only release: ${phrase}`);
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
const SITE = /^(index|catalog|404|privacy|terms|research-use|forms 2|cart|product|checkout|shipping|refund|contact)\.html$|^account\/|^command\/|^ops-dashboard\/(index\.html|ops\.css|ops\.js)$|^assets\/|^js\/|^vendor\/|^(styles|logo|premium-theme|gate|portal)\.css$|^(app|boot|policy)\.js$|^favicon\.svg$|^robots\.txt$|^netlify\.toml$/;
// Every non-site file must be refused by a forced 404 redirect. Without
// force = true Netlify serves the static file and the rule never fires, so the
// flag is checked explicitly rather than assumed from the rule's presence.
const blocked = [...netlify.matchAll(/\[\[redirects\]\]([\s\S]*?)(?=\[\[|$)/g)]
  .map(match => match[1])
  .filter(block => /status\s*=\s*404/.test(block) && /force\s*=\s*true/.test(block))
  .map(block => block.match(/from\s*=\s*"([^"]+)"/)?.[1])
  .filter(Boolean);

// Netlify splats match whole path segments only: "/dir/*" works, "/*.md" does not.
// Extension globs are deliberately unsupported here — treating them as matches once
// produced a false pass while three markdown files stayed reachable in production.
const isBlocked = file => blocked.some(pattern => {
  const rule = pattern.replace(/^\//, '');
  if (rule.endsWith('/*')) return file.startsWith(rule.slice(0, -1));
  return file === rule;
});

// Netlify does not serve dotfiles; verified against the live host (.gitignore → 404).
const exposed = tracked.filter(f => !SITE.test(f) && !isBlocked(f) && !f.startsWith('.'));
for (const file of exposed) {
  errors.push(
    `Non-site file would be published: ${file} — publish = "." serves every tracked ` +
    `file; add a [[redirects]] rule with status = 404 and force = true, or move the ` +
    `site into its own publish directory`
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
