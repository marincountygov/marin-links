# Marin Links

Marin Links is a static MarinOS app that creates QR codes for approved Marin County links. The link, tracking values, optional center image, PNG, and SVG are processed only in the user's browser.

- **Audience:** County of Marin staff
- **Owner:** County of Marin
- **Repository:** `marin-links`
- **Status:** Alpha
- **Current release:** 0.1.0
- **Deployment target:** GitHub Pages

## Features

- Accepts a complete pasted HTTPS URL.
- Parses the hostname with the browser `URL` API and checks it against an explicit allowlist by default.
- Supports a public `?dest=any` mode for any HTTPS hostname while retaining all other link safety checks.
- Adds optional query parameters from a searchable, curated list without dropping an existing query string or fragment.
- Supports a validated custom parameter name when the curated list does not include the needed name.
- Shows contextual example values as placeholders only; it never inserts those examples automatically.
- Supports an optional local PNG, JPEG, or WebP center image.
- Trims transparent image margins and preserves the visible image's proportions.
- Automatically finds a large, conservative center-image size for the current QR grid.
- Keeps QR finder, timing, format, and version patterns intact. A logo may cover the center alignment marks, so nothing is layered over it.
- Checks changed QR codewords against a conservative share of each Reed-Solomon block's correction capacity before export is enabled.
- Uses the default dark QR color. The color controls are retained in code but hidden for this release.
- Uses a white background by default, with an optional transparent background for light, plain surfaces.
- Generates a high-resolution PNG with a four-module quiet zone and high error correction.
- Generates a local SVG with vector QR modules and an embedded local copy of any center image.
- Downloads PNG or SVG, copies PNG in supported browsers, and copies the final URL.
- Uses no app backend, database, CDN, analytics service, or runtime QR API.

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

## Center-image safety

The app uses several safeguards together:

1. It generates the QR code at high error correction.
2. It maps QR data modules to their Reed-Solomon blocks.
3. It restores protected QR structures above the image and white backing.
4. It tests candidate sizes at two raster scales.
5. It limits changed codewords to 65% of each block's mathematical correction capacity.
6. It reduces the largest passing size before the final check and export.

This gate is conservative, but it cannot model every camera, printer, paper, surface, or lighting condition. The interface still tells users to scan the final code with a phone before sharing it. Automated release tests independently decode canvas, PNG, and SVG output.

## Transparent output

White remains the safest default. When **Transparent background** is selected, the PNG alpha channel and SVG background are transparent while the four-module quiet zone remains present as empty space. A center image keeps its white safety backing. Transparent QR codes must be placed on a light, plain background and tested in their final use.

## SVG output

The SVG keeps the QR modules as vector shapes. A chosen center image remains raster data and is embedded inside the SVG as a local PNG data URL. The file has no script or external image link. Large prepared images are reduced to at most 1,600 pixels on their longest side before embedding to control file size.

## Run locally

No build step or Node runtime is required for the app itself.

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. Use HTTP rather than `file://` because the shared App Shell reads local security and application metadata.

## Project structure

```text
assets/
  app.css                  Marin Links layout and workflow styles
  app.js                   Validation, workflow state, and export
  authorized-domains.js    Auditable destination allowlist
  qr-image.js              Local image preparation and transparent-edge trim
  qr-safety.js             QR mapping, safety checks, PNG rendering, and SVG output
vendor/
  marinos/                 Pinned Marin App Shell 1.12.2
  qrcode/                  Local QR matrix library and license files
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

The Marin Links browser test independently decodes generated and downloaded PNG files and rasterized SVG files. It checks opaque and transparent output, SVG files with and without center images, exact-domain and subdomain rules, deceptive hostnames, HTTP rejection, the searchable parameter selector, custom names, placeholders, duplicate prevention, the hidden color feature, center-image sizing, transparent trimming, long links, clipboard actions, responsive layout, and dark mode. See [`docs/development.md`](docs/development.md) for test dependencies and manual review steps.

## QR dependency

The local QR matrix generator is based on **QRCode for JavaScript** by Kazuhiko Arase. It is permissively licensed under MIT. The source copy came from the vendored QR component in `qrcode-terminal` 0.12.0; the source-package Apache 2.0 license and the component MIT license are retained under `vendor/qrcode/`.

The local wrapper exposes the QR grid and Reed-Solomon block metadata needed by the center-image safety gate. The app does not load this library from a CDN. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Security and privacy

The app does not send or store the entered link, tracking values, center image, PNG, or SVG. A static Content Security Policy blocks external scripts and allows network connections only for the shared MarinOS information features. See [`SECURITY.md`](SECURITY.md) and [`security.json`](security.json).

## Content standard

All user-facing instructions and validation messages should remain suitable for a nontechnical audience at about a sixth-grade reading level. Prefer short sentences, common words, and concrete examples. Developer documentation may use the technical terms needed to maintain the app.
