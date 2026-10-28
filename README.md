# Marin Links

Marin Links is a static MarinOS app that makes links and QR codes for approved Marin County web pages, and shows how often they are used. Long tracking links and QR images are made in the browser. Choosing Short and clicking **Create short link** sends the completed destination and selected marketing details to Marin Links Server (`https://l.marinhhs.org/`), which returns a registered short URL. Only a confirmed server response can be copied or used in a QR code.

- **Audience:** County of Marin staff
- **Owner:** County of Marin
- **Repository:** `marin-links`
- **Status:** Alpha
- **Current release:** 0.2.0
- **Deployment target:** GitHub Pages

## Features

**Create**

- Choose **Link** or **QR code**. With Link, tick **Add many web addresses** to make links for a list.
- Accepts a complete HTTPS URL, checked against an explicit allowlist. A public `?dest=any` mode allows any HTTPS hostname and keeps every other local check. It does not bypass the server allowlist for Short registration.
- Tracking: Channel, Source, Agency (the County list, with divisions), Campaign, Content, Send date, and extra tracking details. Existing query strings and fragments are kept.
- Every web address gets a `via=qr` or `via=link` label, so Stats can tell printed codes from shared links.
- **Length:** Long creates a tracking redirect locally. Short requires clicking **Create short link**; it registers the destination on the server and returns a stable short URL.
- **Add many web addresses:** up to 100 web addresses at once. Short mode creates them one at a time with progress, per-row errors, Stop, safe Retry remaining, Copy all, and Download CSV. Server limits may stop a batch early.
- **QR code:** a Marin logo from the Brand Center in the middle (A to Z list, read from the Brand Center), print size help, a note for crowded codes, and one Download button for PNG or SVG. PNG is made at the chosen print size.
- QR safety: high error correction, a four-module quiet zone, a white backing behind the logo, a conservative correction budget, and nothing layered over the logo.

**Stats**

- **Tracked links**: visits over time, QR codes and links, top links, tracking details, and browsers from the server's public API.
- **Short URLs**: overall visits, estimated visitors, and the current active Short URL count; enter a known short code or server URL to view its daily, browser and approximate geographic breakdowns. The public API does not enumerate short URLs.
- Filter by time, agency, or link. Copy link shares the choices. Download CSV saves the numbers.
- Estimated visitors is a guess, not a count of people. Numbers the tracker holds back show "Too few visits to show."

## Authorized destinations

The source of truth is [`assets/authorized-domains.js`](assets/authorized-domains.js).

| Domain | Exact domain | Subdomains |
|---|---:|---:|
| `marincounty.gov` | Yes | Yes |
| `marinhhs.org` | Yes | Yes |
| `marincountygov.github.io` | Yes | No |
| `marinmap.org` | Yes | Yes |
| `marinfair.org` | Yes | Yes |
| `marincultural.org` | Yes | Yes |

Validation compares parsed hostnames. It does not use substring or prefix matching, so a hostname such as `marincounty.gov.example.com` is rejected in the default mode.

### Any HTTPS link mode

Open `https://marincountygov.github.io/marin-links/?dest=any` to enable the optional public mode. The app then accepts HTTPS links from any hostname. It still requires HTTPS and rejects embedded credentials and nonstandard ports. It does not visit, load, or redirect to the entered link.

Only one `dest` parameter with the exact value `any` activates this mode. Names and values are case-sensitive, repeated `dest` parameters do not activate it, and other parameters are ignored. For example, `?dest=ANY`, `?Dest=any`, and `?dest=any&dest=any` keep County-only restrictions.

The link in the app's About page explains this mode in plain language. When active, the destination field displays an **Any HTTPS link** message and hides the County-only website list. There is no in-app toggle. This mode is not a secret permission or access-control feature: anyone can use the published query parameter. It changes the allowed QR payload, not the QR format, rendering, or download options.

The allowlist is a governance default for the official tool, not a universal QR security boundary. A user can use another generator, change browser code, or open the public unrestricted mode.

## Logo safety

The app uses several safeguards together:

1. It generates the QR code at high error correction.
2. It maps QR data modules to their Reed-Solomon blocks.
3. It restores finder, timing, format, and version modules above the logo and white backing. Alignment marks are not restored, so nothing is layered over the logo.
4. It tests candidate sizes at two raster scales.
5. It limits changed codewords to 65% of each block's mathematical correction capacity.
6. It reduces the largest passing size before the final check and export.

This gate is conservative, but it cannot model every camera, printer, paper, surface, or lighting condition. The interface still tells users to scan the final code with a phone before sharing it. Automated release tests independently decode canvas, PNG, and SVG output.

## SVG output

The SVG keeps the QR modules as vector shapes. A chosen logo remains raster data and is embedded inside the SVG as a local PNG data URL. The file has no script or external image link. Large prepared images are reduced to at most 1,600 pixels on their longest side before embedding to control file size.

## Run locally

No build step or Node runtime is required for the app itself.

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. Use HTTP rather than `file://` because the shared App Shell reads local security and application metadata.

## Project structure

```text
assets/
  app.css                  Marin Links layout and styles
  app.js                   Create tab: validation, tracking, QR, links, many links, downloads
  stats.js                 Tabs and the Stats tab: tracker requests, charts, CSV, shared links
  tracker-config.js        Configurable serverRoot (default https://l.marinhhs.org/) and GitHub Pages sourcePath
  short-links-api.js       Anonymous JSON POST adapter, response validation, idempotent retry handling
  agencies.js              Agency list (generated from data/agencies.json, do not edit)
  presets.js               Saved campaigns and the backup list of logos
  authorized-domains.js    Auditable destination allowlist
  qr-image.js              Local logo preparation and transparent-edge trim
  qr-safety.js             QR mapping, safety checks, PNG rendering, and SVG output
vendor/
  marinos/                 Pinned Marin App Shell
  qrcode/                  Local QR matrix library and license files
  chart.min.js             Local Chart.js and its license
index.html                 App workflow and plain-language content
marin.yml                  MarinOS project metadata
security.json              Machine-readable security configuration
SPEC.md                    Current frontend behavior and integration requirements
```

Do not edit `vendor/marinos/` in place. Adopt a reviewed shell release through the App Shell installer and update `platform.shell` to match its manifest.

## Validation and tests

Run the static and syntax checks:

```bash
bash scripts/check.sh
```

Run local-HTTP browser tests when the environment permits Chromium to reach localhost:

```bash
bash scripts/check.sh --browser
```

Run the component/CSP fixtures and the mocked Short creation, batch, and reporting workflow without localhost navigation:

```bash
bash scripts/check.sh --browser-in-memory
```

The full HTTP Marin Links browser test independently decodes generated and downloaded PNG files and rasterized SVG files. It checks the Link, Add many web addresses, and QR code choices, the tracking labels, Brand Center logos, print sizes, Stats tabs and shared Stats links, exact-domain and subdomain rules, deceptive hostnames, HTTP rejection, long links, and dark mode. The new offline Short integration test additionally decodes its QR PNG/SVG exports. See [`docs/development.md`](docs/development.md) for test dependencies and manual review steps.

## QR dependency

The local QR matrix generator is based on **QRCode for JavaScript** by Kazuhiko Arase. It is permissively licensed under MIT. The source copy came from the vendored QR component in `qrcode-terminal` 0.12.0; the source-package Apache 2.0 license and the component MIT license are retained under `vendor/qrcode/`.

The local wrapper exposes the QR grid and Reed-Solomon block metadata needed by the center-image safety gate. The app does not load this library from a CDN. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Security and privacy

Long link previews and QR files remain in the browser. Creating a Short link explicitly sends the completed destination, selected tracking details and source path to Marin Links Server. That server privately stores the destination. No API key, cookies, or persistent browser identifiers are used by Marin Links. People who open a link or scan a code are counted by the County tracker, which is the purpose of the app. The page's Content Security Policy blocks outside scripts and allows network requests only to the tracker's API, the Brand Center, and the shared MarinOS information sources. See [`SECURITY.md`](SECURITY.md) and [`security.json`](security.json).

## Content standard

All user-facing instructions and validation messages should remain suitable for a nontechnical audience at about a sixth-grade reading level. Prefer short sentences, common words, and concrete examples. Developer documentation may use the technical terms needed to maintain the app.

## Short-link integration (v0.2.0)

The only deployment-specific frontend settings are in `assets/tracker-config.js`:

```js
const serverRoot = "https://l.marinhhs.org/";
const sourcePath = "/marin-links/";
```

The frontend derives the API at `{serverRoot}s/api/v1/` and tracked redirects at `{serverRoot}?d=...`. Moving the server to another hostname or URL subdirectory requires editing `serverRoot` only. The server-issued `short_url` is never constructed by the frontend.

**Server administrator setup:** Enable `short_links.creation.public_enabled`. Register both supported frontend locations in `allowed_sources`: `https://marincountygov.github.io/marin-links/` and `https://misc.marinhhs.org/marin-links/`. The frontend sends `/marin-links/` as its source path at either location. Set any County/VPN client-IP allowlist, and populate `public_allowlisted.allowed_hosts` with destinations that may be used. These checks are enforced by Marin Links Server. Source paths and browser origins are not authentication; IP restrictions apply to the users' public/VPN egress IP addresses, not GitHub Pages. CLI and capability-key methods remain independent.

No link is registered when typing, previewing, copying, exporting, or loading Stats. The explicit Create action uses a cryptographically random retry key that stays in page memory. An unchanged retry reuses the same key. Retry protection is limited by the server's retention rules and by the browser staying on the same network; it is not a permanent, worldwide exactly-once promise. The server may stop a large batch because of its current limits. Completed rows remain available for copy and CSV export.

The frontend contract is verified against Marin Links Server v0.4.5. The public reports **do not prove unique people or QR scans**. The overall Short URL report and the report for one known code are shown separately. Short URLs and Long `?d=` redirect counts are not combined, and there is no public short-link catalogue. See [`docs/SPEC-SHORT-API-REBUILD-v1.1.md`](docs/SPEC-SHORT-API-REBUILD-v1.1.md) for the current contract.
