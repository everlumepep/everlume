# Everlume Locked Bottle Asset Pipeline

**Mission:** `EVERLUME-ASSET-LOCK-001`
**Status:** LOCAL ASSET LOCK COMPLETE / PREVIEW REVIEW REQUIRED

## Governing rule

No page is allowed to draw a bottle. Every storefront surface consumes a manifest-listed, versioned asset from `assets/products/locked-v1/`.

## Source and master

- Visual reference: `assets/products/labels/tirzepatide-20mg-bottle-locked-reference-v1.png`
- Reference SHA-256: recorded in `assets/products/locked-v1/manifest.json`
- Transparent bottle master: `assets/products/everlume-vial-master-v1.png`
- Master format: RGBA PNG with transparent background

The supplied reference image remains preserved as the visual lock. Its checkerboard is baked into an RGB PNG, so it is not used as a transparent compositing layer. The transparent RGBA master preserves the approved bottle geometry; final SKU labels are rendered into versioned SVG assets.

## Approved asset set

- 25 SKU-specific SVG bottle assets.
- Each asset embeds the transparent bottle master and contains the product name, dose, Everlume lockup, and research-use disclaimer.
- `SHA256SUMS` is the integrity index for the complete set.
- `manifest.json` is the source-of-truth mapping from SKU to asset.

## Consumers

- Hero: `index.html`
- Catalog cards: `app.js`
- Product detail: `js/product.js`
- Shared selection/configuration: `js/label-config.js`

No consumer is permitted to recreate the bottle or label with HTML/CSS.

## Verification

- Locked asset manifest test: PASS
- Asset hash test: PASS
- Full project test suite: 31/31 PASS
- Required-file validation: 53 files / 16 pages PASS
- Desktop, tablet, and mobile entry screenshots captured under `evidence/visual-regression/2026-08-24/`

## Release boundary

The asset lock is local and preview-bound. No remote push, preview deployment, production release, commerce activation, payment activation, or client delivery is implied until visual review and a separate release ruling are complete.
