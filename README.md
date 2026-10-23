# Marin Links

Marin Links is a static MarinOS app that makes links and QR codes for approved Marin County web pages, and shows how often they are used. Links and QR codes are made in the browser. Every one goes through the County tracker, which counts the visits.

- **Audience:** County of Marin staff
- **Owner:** County of Marin
- **Repository:** `marin-links`
- **Status:** Alpha
- **Current release:** 0.1.0
- **Deployment target:** GitHub Pages

## Features

**Create**

- Choose **Link**, **Many links**, or **QR code**.
- Accepts a complete HTTPS URL, checked against an explicit allowlist. A public `?dest=any` mode allows any HTTPS hostname and keeps every other check.
- Tracking: Channel, Agency (the County list, with divisions), Campaign (saved ones or a new name), Send date, and extra tracking details with dropdowns for common values. Existing query strings and fragments are kept.
- Every web address gets a `via=qr` or `via=link` label, so Stats can tell printed codes from shared links.
- **Many links:** up to 100 web addresses at once, with a table of links, Copy all links, and Download CSV.
- **QR code:** a Marin logo from the Brand Center in the middle (A to Z list, read from the Brand Center), print size help, a note for crowded codes, and one Download button for PNG or SVG. PNG is made at the chosen print size.
- QR safety: high error correction, a four-module quiet zone, a white backing behind the logo, a conservative correction budget, and nothing layered over the logo.

**Stats**

- Visits over time, QR codes and links, top links, tracking details, and browsers, from the tracker's public API.
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
  tracker-config.js        Tracker addresses
  presets.js               Agencies, saved campaigns, and the backup list of logos
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
SPEC.md                    Authoritative 0.1.0 behavior
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

Run the component/CSP fixtures and full Marin Links workflow without localhost navigation:

```bash
bash scripts/check.sh --browser-in-memory
```

The Marin Links browser test independently decodes generated and downloaded PNG files and rasterized SVG files. It checks the Link, Many links, and QR code choices, the tracking labels, Brand Center logos, print sizes, Stats tabs and shared Stats links, exact-domain and subdomain rules, deceptive hostnames, HTTP rejection, long links, and dark mode. See [`docs/development.md`](docs/development.md) for test dependencies and manual review steps.

## QR dependency

The local QR matrix generator is based on **QRCode for JavaScript** by Kazuhiko Arase. It is permissively licensed under MIT. The source copy came from the vendored QR component in `qrcode-terminal` 0.12.0; the source-package Apache 2.0 license and the component MIT license are retained under `vendor/qrcode/`.

The local wrapper exposes the QR grid and Reed-Solomon block metadata needed by the center-image safety gate. The app does not load this library from a CDN. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Security and privacy

The web addresses, tracking choices, logo, and generated files are made in the browser and are not sent to a County server by the app. People who open a link or scan a code are counted by the County tracker, which is the purpose of the app. The page's Content Security Policy blocks outside scripts and allows network requests only to the tracker's API, the Brand Center, and the shared MarinOS information sources. See [`SECURITY.md`](SECURITY.md) and [`security.json`](security.json).

## Content standard

All user-facing instructions and validation messages should remain suitable for a nontechnical audience at about a sixth-grade reading level. Prefer short sentences, common words, and concrete examples. Developer documentation may use the technical terms needed to maintain the app.
