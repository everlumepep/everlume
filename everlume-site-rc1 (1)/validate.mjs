import { existsSync, readFileSync } from 'node:fs';

const required = [
  'index.html',
  'research-use.html',
  'privacy.html',
  '404.html',
  'styles.css',
  'logo.css',
  'premium-theme.css',
  'app.js',
  'boot.js',
  'policy.js',
  'robots.txt',
  'netlify.toml',
  'assets/everlume-mark-v3.svg'
];

const errors = [];
for (const file of required) {
  if (!existsSync(file)) errors.push(`Missing required file: ${file}`);
}

const pages = ['index.html', 'research-use.html', 'privacy.html', '404.html'];
for (const page of pages) {
  if (!existsSync(page)) continue;
  const html = readFileSync(page, 'utf8');
  const references = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:)/.test(reference)) continue;
    const path = reference.split('?')[0];
    if (!existsSync(path)) errors.push(`${page} references missing file: ${path}`);
  }
  if (!/name="robots" content="noindex,nofollow/.test(html)) {
    errors.push(`${page} is missing controlled-preview robots metadata`);
  }
}

const publicCopy = ['index.html', 'app.js']
  .map(file => readFileSync(file, 'utf8'))
  .join('\n')
  .toLowerCase();

for (const phrase of ['weight loss', 'starter kit', 'syringe', 'dosage guide', 'injection site']) {
  if (publicCopy.includes(phrase)) errors.push(`Consumer-use phrase remains in public copy: ${phrase}`);
}

const netlify = readFileSync('netlify.toml', 'utf8');
if (!netlify.includes('Content-Security-Policy')) errors.push('Netlify CSP header is missing');
if (!netlify.includes('X-Content-Type-Options')) errors.push('Netlify content-type protection is missing');

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Everlume validation passed: ${required.length} required files and ${pages.length} pages checked.`);
