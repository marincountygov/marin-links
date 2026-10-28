# Security

## Report a security issue

Use the contact in [`.well-known/security.txt`](.well-known/security.txt). Include what you found, how to reproduce it, and the likely impact. Do not open a public issue for a security report.

## Data handling

Long tracked links, previews, QR images, PNG, SVG, and CSV files are made locally. The app does not send the entered destination or tracking details while the user types or previews a Long link.

When the user selects **Short** and explicitly clicks **Create short link** (or **Create short links**), the browser sends a JSON `POST` containing the completed HTTPS destination and selected non-sensitive marketing details to `https://l.marinhhs.org/s/api/v1/short-links` (configurable). Marin Links Server stores the full destination privately so the Short URL can work later. The frontend does not use an API key or cookies, does not retain a persistent identifier, and does not store creation inputs in localStorage or IndexedDB. Retry keys and results exist only in page memory.

An unchanged manual retry reuses the same cryptographic key. This lowers duplicate risk when a response is lost. The server limits replay protection by source, a keyed form of the client IP address, and retention time. A network change can prevent the server from recognizing a replay, so the frontend does not promise permanent or global exactly-once creation.

The server validates destination hostnames, anonymous source path/Origin claims, optional County network/VPN egress IP ranges, rate limits and quotas. Source restrictions alone **do not authenticate a creator**. The frontend's `?dest=any` option does not override server authorization. Do not use this service for sensitive data.

The Stats tab issues public aggregate `GET` requests for Long redirect and Short URL traffic. The overall Short URL report and the report for one known code are separate. Entering a known code retrieves public aggregate statistics, not a private destination or a list of all Short URLs. Visits are redirect requests, not verified QR scans or unique people. The app never follows a Short URL itself.

The frontend fetches Brand Center logo images and MarinOS metadata as documented in `security.json`. It does not upload logo data or QR images.

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
- network requests to `https://l.marinhhs.org` for explicit Short creation and public Stats, plus the Brand Center brand list and shared MarinOS catalog, Accessibility, Tech, and GitHub Updates sources.

It does not allow external scripts, inline scripts, inline styles, plugins, or arbitrary network destinations.

After an approved policy change, run:

```bash
python3 scripts/sync-security-meta.py --write
bash scripts/check.sh
```

GitHub Pages cannot provide every response header. The documented exceptions for frame protection, MIME-sniffing protection, and Permissions Policy remain in `security.json`.
