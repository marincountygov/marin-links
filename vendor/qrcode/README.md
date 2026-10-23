# QRCode for JavaScript

Marin QR vendors a local browser bundle of the QR matrix implementation known
as QRCode for JavaScript.

- Original component: QRCode for JavaScript
- Original copyright: 2009 Kazuhiko Arase
- Component license: MIT (`LICENSE.txt`)
- Source copy: `qrcode-terminal` 0.12.0 `vendor/QRCode/`
- Source-package notice: Apache 2.0 plus the component MIT notice
  (`SOURCE-PACKAGE-LICENSE.txt`)
- Local export: `window.MarinQrCode`
- Exposed members: `QRCode`, `QRErrorCorrectLevel`, `QRRSBlock`, and `QRUtil`
- Runtime network requests: none

The small module loader at the top and bottom of `qrcode.js` is a Marin QR
packaging change. The 0.1.1 wrapper also exposes the original component's
Reed-Solomon block table and QR utilities. Marin QR uses that metadata to map
protected QR structures and set conservative center-image limits; it does not
change the encoder algorithms. Line endings and trailing whitespace were also
normalized. The source modules are bundled so the static app needs no CDN,
package manager, or runtime module loader.
