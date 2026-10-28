# Working on Marin Links

## Architecture

Marin Links is a static MarinOS app that makes links and QR codes for approved Marin County web pages, and shows how often they are used. It started from `marin-app-template` and pins a Marin App Shell release (see `marin.yml`). There is no app server, database, or build step.

Long links and QR codes use the configured Marin Links Server `/?d=` tracker. Short links are registered only through an explicit JSON POST. The Stats tab reads public aggregates from both types of links.

Files:

- `index.html`: markup and user-facing text for the Create and Stats tabs.
- `assets/app.js`: Create tab. URL checks, tracking fields, QR and link output, many links, print size help, downloads.
- `assets/stats.js`: tabs and the Stats tab. Read-only report requests, Chart.js charts, CSV, and shareable Stats links.
- `assets/tracker-config.js`: one trusted server root, application source path, and derived Long/Short/Stats routes.
- `assets/short-links-api.js`: Marin Links Server v0.4.5 anonymous creation adapter, capability hint, strict response checks, error mapping, and cryptographic retry keys.
- `assets/presets.js`: saved campaigns and the backup list of Marin logos.
- `data/agencies.json`: the master list of agencies, departments, and divisions (see `data/README.md`). `assets/agencies.js` is generated from it by `scripts/build-agencies.py`. Edit the JSON, never the generated file. Never rename or reuse an id.
- `assets/authorized-domains.js`: destination allowlist.
- `assets/qr-image.js`, `assets/qr-safety.js`: logo preparation, sizing, scan-safety checks, PNG and SVG output.
- `vendor/qrcode/`, `vendor/chart.min.js`: local libraries. `vendor/marinos/`: App Shell, never edited in place.

## Non-negotiable behavior

- Accept a complete HTTPS URL. Parse it with the native `URL` API and compare the normalized hostname against the structured allowlist. Never use `startsWith`, `includes`, or a regular expression that can accept `approved.example.evil.test`.
- Allow subdomains only when `allowSubdomains` is explicitly `true`. Reject credentials and nonstandard ports.
- Long tracked links use the configured server root with `?d=`; Short links use the exact validated server-issued `short_url`. Never build a Short URL from a code, wrap it in `?d=`, or fetch it to test it, since that would count a visit.
- Add the `via` label (`qr` or `link`) to every destination. Keep the send date, channel, campaign, and agency labels in one place (`collectParameters`).
- Automatic network requests remain read-only. Only an explicit Short creation action makes JSON POST requests to the configured Marin Links Server. Never submit on typing, preview, Type/Length changes, tab changes, copy, export, restore, or Stats loading. Keep `security.json` in step.
- Treat capabilities as advice, not proof that this browser is allowed. Use the configured HTTPS root as the trust boundary. A capability response must not silently change the Short URL host or path.
- For one unchanged request, keep one cryptographically random idempotency key in page memory and reuse it for manual retries. A changed payload gets a new key. Do not promise exactly-once creation across network/IP changes or beyond server retention.
- Add many web addresses must send at most one POST at a time, preserve input order and confirmed results, stop after `403`, `429`, `503`, or global quota errors, and retry only unfinished rows with their original payload and key.
- Logos come only from the Brand Center, at addresses that start with the Brand Center brands folder. Uploading a logo is switched off (`FEATURES.logoUpload`). Keep that code, but do not turn it on without approval.
- Preserve existing query parameters and fragments. Append labels with `URLSearchParams`.
- Keep the QR color picker and the Background choice switched off (`FEATURES`) while keeping their code.
- Do not add analytics, external QR services, browser-persistent identifiers, authentication keys, or automatic URL creation. Do not store anything about the person using the app. Server creation is anonymous under County source/IP policy; do not treat the source claim as authentication.
- The Source label defaults to `marin-county`. Channel, Source, Campaign, and Content each end with "Add a new one"; a typed value is changed to lowercase words joined by hyphens and is not saved. Source, Channel, Campaign, and Content are not offered again in "Add a tracking detail".
- The optional address under a QR code (PNG and SVG) is the destination page without scheme, labels, or fragment, in camel case. It is plain text and is never tracked. A Short link prints the link itself under the code instead, and the address option is disabled while Short is selected.
- Keep the final link visible as text. The QR image must never be the only way to read the destination.
- QR safety: keep high error correction, the four-module quiet zone, the white backing behind a logo, the correction budget per block, and the decode tests. Finder, timing, format, and version modules are restored over a logo. Alignment modules are not, so nothing is layered over the logo.
- Stats must say what it counts. A visit is one time a link was opened. Estimated visitors is a guess. Neither is an exact count of people or scans. Keep Long reports, overall Short URL reports, and one-known-code reports separate. Numbers the tracker holds back show "Too few visits to show."
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

Also run `bash scripts/check.sh --browser` where Chromium can reach localhost. All Short creation tests must use route mocks or an explicitly isolated development backend. Never send test creation requests to the live service, and never follow a live Short URL during validation. Review keyboard use, 320 CSS pixel reflow, light and dark modes, actual phone scanning, printed output, and the downloads.

Changes to QR rendering, error correction, quiet zone, or logo sizing must keep independent decode tests for a plain code, square and wide logos, a long link, downloaded PNG, and rasterized SVG.

## Versioning

`TEMPLATE_VERSION` is the starter version and stays as it is. Record app changes in `CHANGELOG.md`. Keep `project.status` in `marin.yml` current.
