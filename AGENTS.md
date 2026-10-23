# Working on Marin Links

## Architecture

Marin Links is a static, browser-only MarinOS app. It starts from `marin-app-template` 2.0.9 and pins Marin App Shell 1.12.2. There is no app server, database, API, build pipeline, or runtime package manager.

The main workflow lives in `index.html`, app behavior in `assets/app.js`, app styling in `assets/app.css`, and the destination policy in `assets/authorized-domains.js`. Image preparation is in `assets/qr-image.js`; QR structure inspection, sizing, checking, and rendering are in `assets/qr-safety.js`. The QR engine is vendored under `vendor/qrcode/`.

## Non-negotiable behavior

- Accept a complete HTTPS URL. Do not replace it with a domain picker.
- Parse URLs with the native `URL` API.
- Compare normalized hostnames against the structured allowlist. Never use `startsWith`, `includes`, or a regular expression that can accept `approved.example.evil.test`.
- Allow subdomains only when `allowSubdomains` is explicitly `true`.
- Reject credentials and nonstandard ports in destination URLs.
- Keep all link, image, PNG, and SVG work in the browser. Do not add telemetry, uploads, URL shorteners, redirect services, or QR APIs.
- Preserve existing query parameters and fragments. Append complete tracking name/value pairs with `URLSearchParams`.
- Keep the tracking-name control as a searchable curated selector. The predefined names and descriptions are auditable in `assets/app.js`; use Custom for any other validated name.
- Treat example values such as `flyer` as placeholders only. Never insert a placeholder into a URL.
- Prevent duplicate names among helper rows. Do not rewrite or remove query parameters already present in the pasted destination.
- Keep white as the default QR background. Transparent output may remove the fill, but it must keep the four-module quiet-zone space, the light-background warning, high error correction, protected QR structures, per-block correction budgets, and the dark-color contrast gate.
- Preserve center-image proportions and trim only transparent outer margins. Do not return to square cropping.
- Do not replace the automatic safety gate with one fixed image percentage.
- Keep the QR color controls hidden in 0.2.1 while retaining their inputs, validation, rendering, and feature flag for later use.
- Keep the final URL visible as text. The QR image must never be the only representation of the destination.
- Keep SVG out of the center-image input unless a separate security design and sanitization implementation is approved. SVG output must remain generated locally, script-free, and free of external resources.

## User-facing content

Write for a nontechnical audience at about a sixth-grade reading level. Use short sentences and common words. Explain terms such as tracking details with a concrete example. Avoid developer terms such as hostname, query string, MIME type, error correction, and client-side in the interface.

## MarinOS boundaries

- Keep the five shell component hosts and the `#start[data-tab-section]` route structure.
- Load `vendor/marinos/marinos.js` before all app scripts.
- Do not edit `vendor/marinos/`; its manifest hashes must pass.
- Do not restyle shell-owned header, banner, footer, navigation, feedback, or information-section layout from `assets/app.css`.
- Keep the static CSP/referrer block synchronized with `security.json` by running `python3 scripts/sync-security-meta.py --write` after a reviewed policy change.
- Keep runtime dependencies local and document their licenses.

## Testing

Before finishing a change, run:

```bash
bash scripts/check.sh
bash scripts/check.sh --browser-in-memory
```

Also run `bash scripts/check.sh --browser` in an environment where Chromium can navigate to localhost. Review keyboard use, 320 CSS pixel reflow, light and dark modes, actual phone scanning, printed output, transparent-background placement, PNG clipboard support, PNG download, and SVG download.

Changes to rendering, colors, error correction, quiet-zone sizing, or center-image sizing must retain independent decode tests for plain, square-image, wide-image, long-link, downloaded PNG, opaque-background, transparent-background, and rasterized SVG output.

## Versioning

`TEMPLATE_VERSION` remains the scaffold provenance. App releases belong in `CHANGELOG.md`; do not bump the template version for normal Marin Links changes. Keep `project.status` in `marin.yml` current as the app moves from alpha to beta or live.
