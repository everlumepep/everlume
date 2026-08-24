import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outDir = path.join(root, 'assets/products/locked-v1');
const basePath = path.join(root, 'assets/products/everlume-vial-master-v1.png');
const referencePath = path.join(root, 'assets/products/labels/tirzepatide-20mg-bottle-locked-reference-v1.png');
fs.mkdirSync(outDir, { recursive: true });

const products = [
  ['tirzepatide-10mg','TIRZEPATIDE','10MG'], ['tirzepatide-20mg','TIRZEPATIDE','20MG'],
  ['tirzepatide-30mg','TIRZEPATIDE','30MG'], ['tirzepatide-40mg','TIRZEPATIDE','40MG'],
  ['tirzepatide-50mg','TIRZEPATIDE','50MG'], ['retatrutide-10mg','RETATRUTIDE','10MG'],
  ['retatrutide-20mg','RETATRUTIDE','20MG'], ['retatrutide-30mg','RETATRUTIDE','30MG'],
  ['retatrutide-40mg','RETATRUTIDE','40MG'], ['retatrutide-50mg','RETATRUTIDE','50MG'],
  ['tesamorelin','TESAMORELIN','10MG'], ['selank-10mg','SELANK','10MG'],
  ['kisspeptin-5mg','KISSPEPTIN','5MG'], ['semax','SEMAX',''], ['ghk-cu','GHK-CU','50MG/100MG'],
  ['glutathione-1200mg','GLUTATHIONE','1200MG'], ['klow-blend','KLOW BLEND','BLEND'],
  ['kpv','KPV','10MG'], ['bpc-157','BPC-157','10MG'], ['tb-500','TB-500',''],
  ['nad-plus-1000mg','NAD+','1000MG'], ['mots-c','MOTS-C','10MG'], ['ss31-10mg','SS-31','10MG'],
  ['5-am','5-AM','5MG'], ['l-carnitine-600mg','L-CARNITINE','600MG/10ML']
];

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));
const base = fs.readFileSync(basePath).toString('base64');
const refHash = crypto.createHash('sha256').update(fs.readFileSync(referencePath)).digest('hex');

function asset(slug, name, dose) {
  const title = `${name}${dose ? ` ${dose}` : ''}`;
  const doseY = dose.includes('/') ? 930 : 918;
  const nameSize = name.length > 12 ? 42 : 48;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1122" height="1402" viewBox="0 0 1122 1402" role="img" aria-labelledby="title desc">
  <title id="title">Everlume ${esc(title)}</title>
  <desc id="desc">${esc(title)}. For research purposes only.</desc>
  <image x="0" y="0" width="1122" height="1402" preserveAspectRatio="none" href="data:image/png;base64,${base}"/>
  <g aria-hidden="true" text-anchor="middle">
    <text x="561" y="688" fill="#a88451" font-family="Cormorant Garamond, Georgia, serif" font-size="84" letter-spacing="4">EL</text>
    <text x="561" y="748" fill="#a88451" font-family="Jost, Arial, sans-serif" font-size="27" letter-spacing="10">EVERLUME</text>
    <line x1="426" y1="780" x2="696" y2="780" stroke="#a88451" stroke-width="2" opacity=".62"/>
    <text x="561" y="${dose ? 866 : 900}" fill="#2d2925" font-family="Cormorant Garamond, Georgia, serif" font-size="${nameSize}" font-weight="600" letter-spacing="1.5">${esc(name)}</text>
    ${dose ? `<text x="561" y="${doseY}" fill="#2d2925" font-family="Cormorant Garamond, Georgia, serif" font-size="42" font-weight="600" letter-spacing="2">${esc(dose)}</text>` : ''}
    <text x="561" y="1018" fill="#2d2925" font-family="Jost, Arial, sans-serif" font-size="18" font-weight="600" letter-spacing="3">FOR RESEARCH</text>
    <text x="561" y="1045" fill="#2d2925" font-family="Jost, Arial, sans-serif" font-size="18" font-weight="600" letter-spacing="3">PURPOSES ONLY</text>
  </g>
  </svg>\n`.replace(/^[ \t]+$/gm, '');
}

const manifest = {
  version: 'locked-v1',
  sourceReference: 'assets/products/labels/tirzepatide-20mg-bottle-locked-reference-v1.png',
  sourceReferenceSha256: refHash,
  bottleMaster: 'assets/products/everlume-vial-master-v1.png',
  policy: 'No page may draw a bottle; pages consume only manifest-listed assets.',
  assets: {}
};
for (const [slug, name, dose] of products) {
  const file = `${slug}.svg`;
  fs.writeFileSync(path.join(outDir, file), asset(slug, name, dose));
  manifest.assets[slug] = { file: `assets/products/locked-v1/${file}`, name, dose };
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const files = fs.readdirSync(outDir).filter(file => file.endsWith('.svg')).sort();
const sums = files.map(file => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(outDir, file))).digest('hex')}  ${file}`).join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), sums);
console.log(`Generated ${files.length} locked SVG bottle assets in ${path.relative(root, outDir)}`);
