# Marin Links development

## Local server

From the repository root:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. No application build step is required.

## Source ownership

- `index.html`: workflow markup and user-facing content.
- `assets/app.js`: Create tab. URL validation, tracking fields, QR and link output, many links, print size help, downloads.
- `assets/stats.js`: tabs and the Stats tab. Read-only report requests, Chart.js charts, CSV, and shared Stats links.
- `assets/tracker-config.js`: trusted server root, application source path, and derived routes.
- `assets/short-links-api.js`: Marin Links Server v0.4.5 capability, creation, response-validation, and retry-key adapter.
- `assets/presets.js`: saved campaigns and the backup list of Marin logos. Add a saved campaign here.
- `data/agencies.json`: the master list of agencies, departments, and divisions. After a change, run `python3 scripts/build-agencies.py` to rebuild `assets/agencies.js`. See `data/README.md`.
- `assets/app.css`: styles for this app only.
- `assets/authorized-domains.js`: destination policy.
- `assets/qr-image.js`: local logo preparation and transparent-edge trimming.
- `assets/qr-safety.js`: QR structure mapping, automatic sizing, checking, and rendering.
- `vendor/qrcode/`: reviewed local QR dependency. `vendor/chart.min.js`: local Chart.js.
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

- Python 3.9 or newer;
- Playwright for Python;
- Chromium or Chrome;
- OpenCV (`cv2`) and NumPy;
- `pyzbar` plus the system ZBar library for the most reliable decode check. OpenCV is the fallback decoder.

Install the packages with `python -m pip install -r tests/requirements.txt` and the browser with `python -m playwright install chromium`; `scripts/check.sh` tells you which one is missing. The in-memory Short workflow draws SVG exports in the browser, so it needs nothing extra. It mocks capability, creation, and Stats requests; it never sends a live POST or opens a live Short URL. The tests cover exact v0.4.5 JSON and headers, 200/201 replay handling, lost responses, temporary failures, rate limits, partial batches, strict returned URLs, and separate overall/per-code reports. The in-memory shell fixture does not verify HTTP asset loading, defer timing, home-link document reload, same-origin CSP loading, or Referer delivery. Run the full local-HTTP suite before release.

The workflow test independently decodes the generated canvas, downloaded PNG, and rasterized SVG. It checks opaque and transparent backgrounds, SVG output with and without a center image, square and wide images, transparent trimming, long-link QR structures, center-image size limits, and the retained hidden color implementation.

## Center-image sizing

The constants in `assets/qr-safety.js` are release controls, not general design suggestions. Changes to width, height, area, padding, safety reduction, raster check sizes, or correction-budget fractions require:

- a code review of the QR block mapping;
- browser decode tests for short and long links;
- square, wide, tall, and transparent images;
- physical phone and print scanning.

The QR library wrapper exposes `QRRSBlock` and `QRUtil` only so the app can inspect the encoder's original structure. Do not replace this with a rough percentage-only rule.

## Background and SVG output

White is the default background. The Background choice (White or Transparent) is switched off (`FEATURES.backgroundOption`). When it is on and Transparent is selected, `assets/qr-safety.js` clears the alpha-capable canvas instead of painting white. The four-module quiet zone still exists as transparent space. Keep the plain-language note that transparent output needs a light, plain surface. The logo backing must remain white.

## Logos from the Brand Center

The Logo dropdown reads `https://marincountygov.github.io/marin-brand/brands.json`, which the Brand Center generator writes. `assets/presets.js` keeps a backup list for when the list cannot be loaded. Only files under `.../marin-brand/brands/` are used. When a brand is added to the Brand Center, it appears here on its own. Update the backup list now and then.

## Stats and the tracker

`assets/stats.js` calls the server's public read-only routes. Tracked-link reports use `/s/api/v1/summary`, `/daily`, `/links`, `/parameters`, `/parameters/values`, and `/agents`. Short reports use `/s/api/v1/short-links/summary` and `/s/api/v1/short-links/{known-code}/stats`. Do not add a public code catalogue or mix Long and Short counts. The tracked API takes one filter pair at a time, which is why that report filters by agency only. The QR codes and links chart reads the `via` label that Create adds. Keep the shared Stats parameters (`view`, `period`, `agency`, `link`, `detail`, `report`, `code`) in step with `statsAddress()`.

`MarinQrSafety.toSvg()` must use the same checked model and center-image plan as the canvas. Keep QR modules as vector paths. Any center image must be embedded as a local PNG data URL, never an external reference. Keep the 1,600-pixel longest-side limit unless print tests justify a reviewed change. Exported SVG files must remain script-free.

Rendering changes require tests that:

- inspect opaque and transparent PNG alpha values;
- parse white and transparent SVG files;
- reject scripts and external image links;
- rasterize and decode SVG files with and without center images.

## Hidden features

`FEATURES.qrColorPicker` in `assets/app.js` is `false` for 0.2.0. The HTML color field also has `hidden` so it stays unavailable if JavaScript fails. Keep the inputs, validation, contrast gate, rendering path, and tests in place until the feature is approved for release. Enabling it later should require changing the feature flag and reviewing the user-facing help text, not rebuilding the color system.

## Manual review

For each release, verify:

1. Paste every allowed base domain and at least one permitted subdomain.
2. Reject HTTP, credentials, ports, deceptive suffixes, and a subdomain of `marincountygov.github.io`.
3. Add tracking to a link that already has a query and fragment. Try Channel, Agency, Campaign (saved and new), Send date, and an extra detail with a dropdown value and "Something else". Verify that example placeholders are not inserted and the send date joins a "which version" value.
4. Use only the keyboard, including filtering and selecting parameter names, opening details, adding/removing tracking rows, choosing a file, and running every action.
5. Review at 320 CSS pixels and 200% zoom without horizontal scrolling.
6. Review light, dark, forced-colors, and reduced-motion settings.
7. Download PNG at each print size and SVG in the supported County browsers. Check the smallest print size note and the crowded code note.
8. Try Add many web addresses with good and bad addresses, Copy all links, and Download CSV. Open the CSV in a spreadsheet.
9. Scan a plain QR and a QR with each Marin logo on at least two phone camera apps.
10. Print each PNG and SVG at its planned size and scan the printed copy.
11. Open the Network panel. Confirm Long preview, QR preview/export, copy, and Stats loading never send the entered destination. Confirm only the explicit Short action sends the completed destination to the configured County service. Confirm no file, API key, or cookie is sent.
12. In Short mode, confirm typing and switching controls make no POST. Test one Link, one QR, and an Add many web addresses batch with mocked responses. Confirm an uncertain retry keeps the same request key and a changed form gets a new key.
13. On Stats, review Tracked links, All Short URLs, and One Short URL separately. Test Copy link, suppression, a missing code, and CSV output without private destinations.
14. Review all user-facing text for a nontechnical audience at about a sixth-grade reading level.

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

The intended URL is `https://marincountygov.github.io/marin-links/`. Publish the repository through the approved GitHub Pages process. Keep `.nojekyll` so `.well-known/security.txt` is deployed. Pages deploys from the `main` branch, root folder. Confirm the published CSP, security file, App Shell information sections, the Logo list, Stats, and PNG/SVG downloads after deployment.
