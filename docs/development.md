# Marin Links development

## Local server

From the repository root:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. No application build step is required.

## Source ownership

- `index.html`: workflow markup and user-facing content.
- `assets/app.js`: URL validation, searchable tracking selector, workflow state, and export.
- `assets/app.css`: workflow-only styles.
- `assets/authorized-domains.js`: destination policy.
- `assets/qr-image.js`: local image preparation and transparent-edge trimming.
- `assets/qr-safety.js`: QR structure mapping, automatic sizing, checking, and rendering.
- `vendor/qrcode/`: reviewed local QR dependency.
- `vendor/marinos/`: installed App Shell release; do not edit.

## Change the allowlist

Edit only `assets/authorized-domains.js`. An entry has this form:

```js
Object.freeze({ domain: "example.marincounty.gov", allowSubdomains: false })
```

Use a lowercase hostname with no protocol, path, port, wildcard, or trailing dot. Set `allowSubdomains` to `true` only after the policy owner approves every site below that domain. Add browser tests for both an allowed case and a deceptive near-match.

## Automated checks

Static checks:

```bash
bash scripts/check.sh
```

Full local-HTTP browser checks:

```bash
bash scripts/check.sh --browser
```

In-memory browser fixtures for environments that block Chromium from localhost:

```bash
bash scripts/check.sh --browser-in-memory
```

The browser workflow test needs:

- Python 3;
- Playwright for Python;
- Chromium or Chrome;
- OpenCV (`cv2`) and NumPy;
- `pyzbar` plus the system ZBar library for the most reliable decode check. OpenCV is the fallback decoder.

The in-memory shell fixture does not verify HTTP asset loading, defer timing, home-link document reload, same-origin CSP loading, or Referer delivery. Run the full local-HTTP suite or test the deployed app before release.

The workflow test independently decodes the generated canvas, downloaded PNG, and rasterized SVG. It checks opaque and transparent backgrounds, SVG output with and without a center image, square and wide images, transparent trimming, long-link QR structures, center-image size limits, and the retained hidden color implementation.

## Center-image sizing

The constants in `assets/qr-safety.js` are release controls, not general design suggestions. Changes to width, height, area, padding, safety reduction, raster check sizes, or correction-budget fractions require:

- a code review of the QR block mapping;
- browser decode tests for short and long links;
- square, wide, tall, and transparent images;
- physical phone and print scanning.

The QR library wrapper exposes `QRRSBlock` and `QRUtil` only so the app can inspect the encoder's original structure. Do not replace this with a rough percentage-only rule.

## Background and SVG output

White is the default background. When the checkbox is selected, `assets/qr-safety.js` clears the alpha-capable canvas instead of painting white. The four-module quiet zone still exists as transparent space. Do not remove the plain-language warning that transparent output needs a light, plain surface. The center-image backing must remain white.

`MarinQrSafety.toSvg()` must use the same checked model and center-image plan as the canvas. Keep QR modules as vector paths. Any center image must be embedded as a local PNG data URL, never an external reference. Keep the 1,600-pixel longest-side limit unless print tests justify a reviewed change. Exported SVG files must remain script-free.

Rendering changes require tests that:

- inspect opaque and transparent PNG alpha values;
- parse white and transparent SVG files;
- reject scripts and external image links;
- rasterize and decode SVG files with and without center images.

## Hidden QR color feature

`FEATURES.qrColorPicker` in `assets/app.js` is `false` for 0.2.1. The HTML color field also has `hidden` so it stays unavailable if JavaScript fails. Keep the inputs, validation, contrast gate, rendering path, and tests in place until the feature is approved for release. Enabling it later should require changing the feature flag and reviewing the user-facing help text, not rebuilding the color system.

## Manual review

For each release, verify:

1. Paste every allowed base domain and at least one permitted subdomain.
2. Reject HTTP, credentials, ports, deceptive suffixes, and a subdomain of `marincountygov.github.io`.
3. Add tracking values to a link that already has a query and fragment. Filter the parameter list by typing, test Custom, and verify that example placeholders are not inserted.
4. Use only the keyboard, including filtering and selecting parameter names, opening details, adding/removing tracking rows, choosing a file, and running every action.
5. Review at 320 CSS pixels and 200% zoom without horizontal scrolling.
6. Review light, dark, forced-colors, and reduced-motion settings.
7. Download PNG and SVG output in the supported County browsers.
8. Check white and transparent output. Place transparent output on the exact light, plain background planned for use.
9. Scan a plain QR, a square-image QR, and a wide-image QR on at least two phone camera apps.
10. Print each PNG and SVG at its planned size and scan the printed copy.
11. Confirm that no link, tracking value, image, PNG, or SVG leaves the browser in the Network panel.
12. Review all user-facing text for a nontechnical audience at about a sixth-grade reading level.

## Security metadata

After a reviewed `security.json` change:

```bash
python3 scripts/sync-security-meta.py --write
python3 scripts/sync-security-meta.py --check
```

Keep `.well-known/security.txt` dates and contacts aligned with `security.json`.

## QR dependency updates

Do not replace the QR library only because a newer package exists. First review:

- license and transitive dependencies;
- browser-only use without a CDN;
- Content Security Policy impact;
- URL byte encoding;
- versions 1 through 40 and high error correction;
- matrix equivalence or decode coverage;
- center-image and long-link scan tests;
- third-party notices and provenance.

Update `vendor/qrcode/README.md`, license files, `THIRD_PARTY_NOTICES.md`, and browser decode tests in the same change.

## Deployment

The intended URL is `https://marincountygov.github.io/marin-links/`. Publish the repository through the approved GitHub Pages process. Keep `.nojekyll` so `.well-known/security.txt` is deployed. Confirm the published CSP, security file, App Shell information sections, clipboard behavior, transparent output, and PNG/SVG downloads after deployment.
