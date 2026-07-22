# Everlume

Canonical source for the Everlume research catalog website.

## Local preview

Serve the repository root with any static web server, for example:

```bash
npx serve .
```

Run the dependency-free release validation with:

```bash
node validate.mjs
```

## Deployment

The site is configured for Netlify through `netlify.toml`. The publish directory is the repository root.

The controlled preview intentionally blocks search indexing through page metadata and `robots.txt`. Remove those controls only after explicit launch approval.

## Pages

- `/` — research catalog and inquiry
- `/research-use.html` — research-use policy
- `/privacy.html` — inquiry privacy notice
- `/404.html` — branded not-found page

## Content posture

The public experience uses a research-inquiry workflow. Products are presented for laboratory research and educational purposes only, not for human or veterinary use.
