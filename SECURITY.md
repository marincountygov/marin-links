# Security

## Report a security issue

Use the contact in [`.well-known/security.txt`](.well-known/security.txt). Include what you found, how to reproduce it, and the likely impact. Do not open a public issue for a security report.

## Data handling

Marin Links is a static browser app. The entered link, tracking values, center image, QR canvas, PNG, and SVG stay in browser memory. The app does not send them to a Marin server, a QR service, analytics, local storage, or IndexedDB.

The shared MarinOS App Shell still requests its catalog, Accessibility, Tech, Security, and Updates information from the sources listed in `security.json`. Those requests do not contain the QR destination, center image, or generated files.

## Destination policy

The app parses the full URL and checks the normalized hostname against `assets/authorized-domains.js`. Exact matching and explicit subdomain rules prevent deceptive suffixes such as `marincounty.gov.example.com`.

This allowlist controls the behavior of the official unmodified tool. It is not a universal security boundary because browser JavaScript can be changed and other QR generators exist. Users must still review the final link and scan-test the code.

## Image handling

Center images are limited to PNG, JPEG, and WebP files of at most 2 MB and 4,096 pixels on either side. SVG is not accepted as a center-image input. Images are decoded locally from a data URL and drawn to the QR canvas; they are not uploaded.

When an SVG QR file is exported, any center image is converted to a local PNG data URL and embedded inside the SVG. The exported SVG contains no script or external image reference. Prepared images larger than 1,600 pixels on their longest side are reduced before embedding.

## QR reliability controls

The app uses a white background by default, requires at least 7:1 foreground contrast against white, adds a four-module quiet zone, uses high error correction, and limits the center-image footprint. These controls reduce scanning failures but do not replace testing on a phone and at the final print size.

The optional transparent background removes the white fill but keeps the quiet-zone space. The center-image safety backing remains white. The app warns users to place transparent output only on a light, plain background. It cannot inspect the future surface behind the exported code.

## Content Security Policy

`security.json` is the policy source. `scripts/sync-security-meta.py` writes the CSP and referrer-policy meta tags near the start of `index.html`.

The CSP allows:

- same-origin scripts, styles, fonts, and application files;
- `data:` images for the favicon and user-selected local image previews;
- the shared MarinOS catalog, Accessibility, Tech, and GitHub Updates sources.

It does not allow external scripts, inline scripts, inline styles, plugins, or arbitrary network destinations.

After an approved policy change, run:

```bash
python3 scripts/sync-security-meta.py --write
bash scripts/check.sh
```

GitHub Pages cannot provide every response header. The documented exceptions for frame protection, MIME-sniffing protection, and Permissions Policy remain in `security.json`.
