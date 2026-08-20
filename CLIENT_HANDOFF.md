# Everlume Website — Client Handoff

## Current release posture

The site is a controlled, no-index preview for a laboratory-research supplier. It does not include checkout, dosing or administration guidance, consumer benefit claims, or public pricing.

## Delivery certification — 2026-08-20

- Canonical repository: `everlumepep/everlume`
- Live controlled preview: `https://myeverlume.com`
- Core tests and static validation: **20/20 passed**
- Offline PostgreSQL migration and invariant battery: **39/39 passed**
- Live public certification: **60/60 passed**
- Public deployment boundary: internal source, migrations, tests, and handoff documents return **404**
- Security posture: CSP, frame denial, MIME protection, referrer policy, permissions policy, noindex, and robots controls verified live

The client delivery is **store complete / inquiry live**. Transactional commerce is not approved for launch. The remaining launch dependencies require external authority or credentials:

1. provision and connect the Everlume Supabase project, then run `npm run verify:live`;
2. obtain legal approval for the Terms & Conditions currently marked draft;
3. obtain payment-processor approval and credentials before changing `PAYMENT_STATE` or enabling commerce;
4. approve products, pricing, and inventory individually—never by bypassing the authorization gates.

## Netlify configuration

- Repository: `everlumepep/everlume`
- Production branch: `main`
- Build command: none
- Publish directory: `.`
- Form name: `research-inquiry`

After deployment, confirm the form appears in **Netlify → Forms** and configure notification recipients there. Submit one clearly marked test inquiry, confirm receipt, and delete the test record afterward.

## Controlled-preview controls

The release deliberately includes:

- `noindex`, `nofollow`, and `noarchive` page metadata;
- `robots.txt` with `Disallow: /`;
- Netlify preview `X-Robots-Tag` behavior;
- no analytics or advertising pixels;
- no public checkout.

Do not remove these controls until launch is approved. At launch, update the canonical domain, social metadata, business contact details, and privacy notice before changing indexability.

## Inquiry-data boundaries

The form collects name, organization, email, material of interest, intended research use, and research-use acknowledgment. It warns visitors not to submit medical or payment information.

If accounts, payments, analytics, advertising pixels, shipping integrations, or additional personal information are added, the privacy notice and security configuration must be reviewed again.

## Release verification

Run:

```bash
node validate.mjs
```

After Netlify deploys, verify:

1. homepage, policy, privacy, and 404 pages return successfully;
2. `assets/everlume-mark-v3.svg` loads;
3. styles and scripts load without browser-console errors;
4. mobile menu opens, closes, and responds to Escape;
5. product filters and inquiry buttons work;
6. one test form submission reaches Netlify Forms;
7. security headers remain present;
8. preview pages remain excluded from indexing.

## Brand assets

The production website uses `assets/everlume-mark-v3.svg`. Stacked and horizontal V3 logo files remain source assets for social, collateral, and future layouts but are not required by the deployed website.
