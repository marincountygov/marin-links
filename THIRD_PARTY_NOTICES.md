# Third-party notices

## Marin App Shell

This app vendors Marin App Shell 1.12.2 under `vendor/marinos/`. Its release manifest records the shell version, Marin UI baseline, companion icons, file sizes, and SHA-256 hashes.

Retain the notices distributed with that release:

- `vendor/marinos/licenses/MARIN_APP_SHELL_LICENSE.txt`
- `vendor/marinos/licenses/LUCIDE_LICENSE.txt`
- `vendor/marinos/licenses/OPEN_SANS_OFL.txt`

`vendor/marinos/marinos.css` includes Pico CSS and its embedded MIT attribution. Local font licenses are also retained under `vendor/fonts/`.

## QRCode for JavaScript

Marin Links vendors the QR matrix implementation known as **QRCode for JavaScript**.

- Copyright: 2009 Kazuhiko Arase
- Component license: MIT
- Local license: `vendor/qrcode/LICENSE.txt`
- Local browser bundle: `vendor/qrcode/qrcode.js`

The source copy was obtained from the QR component vendored by `qrcode-terminal` 0.12.0. That source package is Apache 2.0 and includes the QR component's MIT notice. Marin Links retains the complete source-package notice in `vendor/qrcode/SOURCE-PACKAGE-LICENSE.txt` in addition to the MIT license.

The local bundle adds a small module loader and exposes `window.MarinQrCode`. Marin QR 0.1.1 and later expose the component's Reed-Solomon block table and QR utility module so the app can inspect the generated QR structure and apply its local center-image safety gate. The QR algorithms themselves are unchanged. The bundle makes no runtime network request.

## Chart.js

- Chart.js 4.5.1 — MIT License

Vendored Chart.js bundle (`vendor/chart.min.js`) is used for rendering stats charts. See `vendor/CHART_LICENSE.md`.
