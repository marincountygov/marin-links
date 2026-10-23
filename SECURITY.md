# Security

## Report a security issue

Use the contact in [`.well-known/security.txt`](.well-known/security.txt). Include what you found, how to reproduce it, and the likely impact. Do not open a public issue for a security report.

## Data handling

Marin Links is a static browser app. The web addresses, tracking choices, logo, QR canvas, PNG, SVG, and CSV files stay in browser memory. The app does not send them to a County server, a QR service, analytics, local storage, or IndexedDB.

Every link and QR code points to the County tracker, which counts each visit and then sends the person to the destination. The tracker holds the destination, the tracking labels, and an estimate of visitors, as described by its own documentation. The Stats tab reads the tracker's public, read-only API with `GET` requests. The app never opens the redirect address itself, because that would count a visit.

The page also loads the Brand Center's brand list and logo images, and the shared MarinOS App Shell information sources listed in `security.json`. None of those requests contain the web addresses or generated files.

## Destination policy

The app parses the full URL and checks the normalized hostname against `assets/authorized-domains.js`. Exact matching and explicit subdomain rules prevent deceptive suffixes such as `marincounty.gov.example.com`.

This allowlist controls the behavior of the official unmodified tool. It is not a universal security boundary because browser JavaScript can be changed and other QR generators exist. Users must still review the final link and scan-test the code.

## Logo handling

Logos come only from the Brand Center, at addresses that start with the Brand Center brands folder, and must be PNG, JPEG, or WebP files of at most 2 MB and 4,096 pixels on either side. Uploading a logo is switched off. SVG is not accepted as a logo input. Logos are drawn to the QR canvas and are not uploaded anywhere.

When an SVG QR file is exported, any center image is converted to a local PNG data URL and embedded inside the SVG. The exported SVG contains no script or external image reference. Prepared images larger than 1,600 pixels on their longest side are reduced before embedding.

## QR reliability controls

The app uses a white background by default, requires at least 7:1 foreground contrast against white, adds a four-module quiet zone, uses high error correction, and limits the center-image footprint. These controls reduce scanning failures but do not replace testing on a phone and at the final print size.

The page also tells people the smallest width to print a code, and warns when a code is crowded.

## Content Security Policy

`security.json` is the policy source. `scripts/sync-security-meta.py` writes the CSP and referrer-policy meta tags near the start of `index.html`.

The CSP allows:

- same-origin scripts, styles, fonts, and application files;
- `data:` images for the favicon, and images from the Brand Center brands folder;
- network requests to the tracker's API, the Brand Center brand list, and the shared MarinOS catalog, Accessibility, Tech, and GitHub Updates sources.

It does not allow external scripts, inline scripts, inline styles, plugins, or arbitrary network destinations.

After an approved policy change, run:

```bash
python3 scripts/sync-security-meta.py --write
bash scripts/check.sh
```

GitHub Pages cannot provide every response header. The documented exceptions for frame protection, MIME-sniffing protection, and Permissions Policy remain in `security.json`.
