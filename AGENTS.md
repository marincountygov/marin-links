# Working on Marin Links

## Architecture

Marin Links is a static MarinOS app that makes links and QR codes for approved Marin County web pages, and shows how often they are used. It started from `marin-app-template` and pins a Marin App Shell release (see `marin.yml`). There is no app server, database, or build step.

Every link and QR code goes through the County tracker (`https://misc.marinhhs.org/marin-qr-tracker/`). The tracker counts a visit and then sends the person to the real page. The Stats tab reads the tracker's public, read-only JSON API.

Files:

- `index.html`: markup and user-facing text for the Create and Stats tabs.
- `assets/app.js`: Create tab. URL checks, tracking fields, QR and link output, many links, print size help, downloads.
- `assets/stats.js`: tabs and the Stats tab. Tracker requests, Chart.js charts, CSV, and shareable Stats links.
- `assets/tracker-config.js`: tracker addresses.
- `assets/presets.js`: saved campaigns and the backup list of Marin logos.
- `data/agencies.json`: the master list of agencies, departments, and divisions (see `data/README.md`). `assets/agencies.js` is generated from it by `scripts/build-agencies.py`. Edit the JSON, never the generated file. Never rename or reuse an id.
- `assets/authorized-domains.js`: destination allowlist.
- `assets/qr-image.js`, `assets/qr-safety.js`: logo preparation, sizing, scan-safety checks, PNG and SVG output.
- `vendor/qrcode/`, `vendor/chart.min.js`: local libraries. `vendor/marinos/`: App Shell, never edited in place.

## Non-negotiable behavior

- Accept a complete HTTPS URL. Parse it with the native `URL` API and compare the normalized hostname against the structured allowlist. Never use `startsWith`, `includes`, or a regular expression that can accept `approved.example.evil.test`.
- Allow subdomains only when `allowSubdomains` is explicitly `true`. Reject credentials and nonstandard ports.
- Every link and QR code is the tracker address with the destination in its `d` parameter. Never call the redirect address from the app: a visit counts.
- Add the `via` label (`qr` or `link`) to every destination. Keep the send date, channel, campaign, and agency labels in one place (`collectParameters`).
- The only network requests the app makes are the tracker's read-only API (`GET` under `/api/v1/`), the Brand Center brand list and logo images, and the shared App Shell information sources. Keep `security.json` in step with any change.
- Logos come only from the Brand Center, at addresses that start with the Brand Center brands folder. Uploading a logo is switched off (`FEATURES.logoUpload`). Keep that code, but do not turn it on without approval.
- Preserve existing query parameters and fragments. Append labels with `URLSearchParams`.
- Keep the QR color picker and the Background choice switched off (`FEATURES`) while keeping their code.
- Do not add analytics, uploads, URL shorteners, or any QR service. Do not store anything about the person using the app.
- The Source label defaults to `marin-county`. Channel, Source, Campaign, and Content each end with "Add a new one"; a typed value is changed to lowercase words joined by hyphens and is not saved. Source, Channel, Campaign, and Content are not offered again in "Add a tracking detail".
- The optional address under a QR code (PNG and SVG) is the destination page without scheme, labels, or fragment, in camel case. It is plain text and is never tracked. A Short link prints the link itself under the code instead (the address option is switched off then).
- Keep the final link visible as text. The QR image must never be the only way to read the destination.
- QR safety: keep high error correction, the four-module quiet zone, the white backing behind a logo, the correction budget per block, and the decode tests. Finder, timing, format, and version modules are restored over a logo. Alignment modules are not, so nothing is layered over the logo.
- Stats must say what it counts. A visit is one time a link was opened. Estimated visitors is a guess. Neither is an exact count of people or scans. Numbers the tracker holds back show "Too few visits to show."
- Escape cell values that start with `=`, `+`, `-`, or `@` in every CSV the app makes.

## User-facing content

Write for a nontechnical audience at about a sixth-grade reading level. Use short sentences and common words. Avoid developer terms in the interface. Do not mention any tool used to build the app in the interface, commits, pull requests, or files.

## MarinOS boundaries

- Keep the five shell component hosts and the `#start[data-tab-section]` route structure. The Create and Stats tabs are inside `#start`.
- Load `vendor/marinos/marinos.js` before all app scripts.
- Do not edit `vendor/marinos/`; its manifest hashes must pass.
- Do not restyle shell-owned header, banner, footer, navigation, feedback, or information-section layout from `assets/app.css`.
- Keep the static CSP block in step with `security.json`: run `python3 scripts/sync-security-meta.py --write` after a reviewed policy change.
- Keep runtime libraries local and document their licenses.
- Do not add this app to the MarinOS catalog unless asked to by name.

## Testing

Before finishing a change, run:

```bash
bash scripts/check.sh
bash scripts/check.sh --browser-in-memory
```

Also run `bash scripts/check.sh --browser` where Chromium can reach localhost. Review keyboard use, 320 CSS pixel reflow, light and dark modes, actual phone scanning, printed output, and the downloads.

Changes to QR rendering, error correction, quiet zone, or logo sizing must keep independent decode tests for a plain code, square and wide logos, a long link, downloaded PNG, and rasterized SVG.

## Versioning

`TEMPLATE_VERSION` is the starter version and stays as it is. Record app changes in `CHANGELOG.md`. Keep `project.status` in `marin.yml` current.
