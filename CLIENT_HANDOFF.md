# Everlume Website — Client Handoff

## Current release posture

The active product branch is a controlled, no-index preview for a laboratory-research supplier. It includes photographic catalog presentation, six client-confirmed public prices, format selection, a local saved-research list, deterministic Pep Talk catalog guidance, and implemented account/subscription/rewards/COMMAND surfaces. The latter surfaces remain explicitly unavailable until a dedicated Everlume Supabase backend is provisioned and verified. Commerce remains closed: no product is approved or stocked, the storefront commerce flag is false, and payment-processor approval is unverified.

The authoritative current completion board is [`docs/RELEASE-CERTIFICATION.md`](docs/RELEASE-CERTIFICATION.md).

## Delivery certification — 2026-08-20

- Canonical repository: `everlumepep/everlume`
- Certified PR preview: `https://deploy-preview-4--everlume1.netlify.app`
- Current production (older `main` build): `https://myeverlume.com`
- Scoped working-tree tests and static validation: **22/22 passed**, 50 files and 15 pages checked
- Offline PostgreSQL migration and invariant battery: **41/41 passed**
- PR preview public certification: **60/60 passed**
- Production public certification: **59/60 failed** (source drift)
- Public deployment boundary: internal source, migrations, tests, and handoff documents return **404**
- Security posture: CSP, frame denial, MIME protection, referrer policy, permissions policy, noindex, and robots controls verified live

The PR preview is **controlled-preview ready at the network boundary**, not production-ready. Production still deploys `main` at `65a2ac8` and fails the active-branch catalog check (59/60). Transactional commerce is not approved for launch. The remaining launch dependencies require external authority or credentials:

1. commit and preview-deploy the scoped P0/P1 fixes, then repeat certification;
2. provision and connect a dedicated Everlume Supabase project, then run `npm run verify:live`;
3. complete real-browser desktop, tablet, mobile, keyboard, console, and performance checks;
4. obtain legal approval for the Terms & Conditions currently marked draft;
5. obtain payment-processor approval and credentials before changing `PAYMENT_STATE` or enabling commerce;
6. approve products, pricing, and inventory individually—never by bypassing the authorization gates.

## Netlify configuration

- Repository: `everlumepep/everlume`
- Production branch: `main`
- Build command: `node scripts/build-config.mjs`
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
