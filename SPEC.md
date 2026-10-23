# Marin Links 0.1.0 specification

Status: implemented

## Purpose

Marin Links helps County staff make reliable QR codes for approved Marin County links. It is a static MarinOS app. All app data and file generation stay in the browser.

## Primary workflow

1. The user pastes a complete HTTPS web address, including the domain.
2. JavaScript parses the URL and checks its normalized hostname against the allowlist.
3. The user may add tracking name/value pairs through a searchable parameter selector.
4. The user may choose a transparent output background.
5. The user may choose a local center image.
6. The app prepares the image, finds a conservative size for the current QR code, and checks the result.
7. The app shows the final URL and QR preview only after the latest result is ready.
8. The user may download PNG or SVG, copy the PNG, or copy the final link.

A QR code is shown only while every nonempty field is valid. Export actions remain disabled while a new result is being checked.

## Destination rules

| Domain | Subdomains allowed |
|---|---:|
| `marincounty.gov` | Yes |
| `marinhhs.org` | Yes |
| `marincountygov.github.io` | No |
| `marinmap.org` | Yes |

Additional rules:

- HTTPS is required.
- Embedded URL credentials are rejected.
- Nonstandard ports are rejected.
- Matching uses the parsed hostname, not string prefix or substring tests.
- Paths, existing query parameters, and fragments are preserved.

### Optional unrestricted mode (`?dest=any`)

- By default, the domain allowlist above applies unchanged.
- Opening the **application itself** with exactly one `dest=any` query parameter skips only the destination hostname allowlist. All other destination validations remain active, including HTTPS, credentials, and nonstandard ports.
- Match the parsed application query parameters using `URLSearchParams`. The name `dest` and value `any` are case-sensitive, and a repeated `dest` parameter never enables the override (including percent-encoded repeats). Other application parameters are ignored.
- The mode is fixed when the page loads. The `dest` parameter in a *pasted destination* has no effect on app mode.
- In unrestricted mode, show **Any HTTPS link** and plain-language help below the destination input. Hide the County-only website-list disclosure and include the status/help text in `aria-describedby`. The default UI remains unchanged.
- The About page provides a direct link to `https://marincountygov.github.io/marin-links/?dest=any` and explains how to use it, that HTTPS is required, and that users should check the destination.
- This public mode is not an authentication mechanism or authorization control; anyone can activate it. It must not fetch, preload, visit, or redirect to destination links.
- Tracking, QR correction and structure protection, local rendering, PNG/SVG output, clipboard, and privacy behavior are identical in both modes.

## Tracking details

Tracking is optional. Each row contains a searchable **Parameter name** selector and a **Value** field.

### Curated parameter names

The selector presents these options in this order:

| Group | Parameter | Short description |
|---|---|---|
| Campaign tracking | `utm_source` | Traffic source |
| Campaign tracking | `utm_medium` | Marketing channel |
| Campaign tracking | `utm_campaign` | Campaign name |
| Campaign tracking | `utm_content` | Link or placement variant |
| Campaign tracking | `utm_term` | Keyword or audience |
| General | `ref` | Referral source |
| General | `source` | Origin of visit |
| General | `campaign` | Campaign identifier |
| General | `event` | Event identifier |
| General | `location` | Location identifier |
| General | `lang` | Language preference |
| General | `category` | Content category |
| General | `topic` | Topic identifier |
| General | `id` | Record identifier |
| General | `form` | Form identifier |
| General | `program` | Program identifier |
| Other | Custom… | Enter a parameter name |

The first five names are established UTM conventions. The general names are common patterns; a destination only acts on a parameter when that site supports it.

### Selector interaction

- A new row starts with `utm_source` selected.
- The user can open the selector and type to filter names and descriptions.
- The selector supports pointer use, Arrow keys, Home, End, Enter, Escape, and direct typing from its trigger.
- Options are grouped as Campaign tracking, General, and Other.
- Selecting a different name clears the current Value and changes its placeholder.
- An untouched starter row with an empty Value is ignored so optional tracking never blocks the basic QR workflow.
- After a row has been changed or given input, a missing required part is an error.

### Value placeholders

Values are always empty by default. The app uses these examples only as placeholder text:

| Parameter | Placeholder |
|---|---|
| `utm_source` | `flyer` |
| `utm_medium` | `qr` |
| `utm_campaign` | `flu_2026` |
| `utm_content` | `poster_a` |
| `utm_term` | `seniors` |
| `ref` | `library` |
| `source` | `outreach` |
| `event` | `health_fair` |
| `location` | `novato` |
| `lang` | `es` |
| All other options | `Enter a value` |

Placeholder text is never serialized into the URL.

### Custom names and validation

- Selecting Custom… reveals a field labeled **Custom parameter name**.
- The literal selector value `custom` is never added to the URL.
- Custom names are trimmed and limited to 64 characters.
- A custom name must begin with a letter or number and may contain letters, numbers, underscores, hyphens, periods, or tildes.
- Each helper row must use a unique parameter name. The app rejects a duplicate among helper rows.
- Existing parameters in the pasted destination are preserved and are not rewritten or removed.
- Complete rows are appended with `URLSearchParams`.
- The app supports up to 20 rows.
- The interface explains tracking in plain language and includes UTM examples.

## Design and QR reliability

- Default QR foreground: `#1f1f1f`.
- The color picker and text field remain in the code but are hidden through the `FEATURES.qrColorPicker` flag.
- The hidden color controls are not visible, keyboard-focusable, or exposed in the accessibility tree.
- Existing color normalization and the 7:1 contrast gate against white remain functional for later reactivation.
- Error correction: high.
- Quiet zone: four modules.
- PNG backing canvas: approximately 2,048 pixels, with integer module sizes.
- Center image: optional PNG, JPEG, or WebP; 2 MB maximum; 4,096 pixels maximum on either side.
- SVG center images are not accepted.
- Fully transparent outer margins are removed in memory.
- The visible image's proportions are preserved. It is not cropped to a square.
- A white backing with one module of image padding is drawn behind the image.
- Maximum backing width and height are each 30% of the QR grid.
- Maximum backing area is 8% of the QR grid.
- Finder, timing, format, and version modules are restored above the image and backing. Alignment modules are not restored, so nothing is layered over the logo.
- Candidate sizes are checked at two raster scales.
- Changed codewords in each Reed-Solomon block may use no more than 65% of that block's mathematical correction capacity.
- The final image is reduced from the largest passing candidate and checked again.
- If no image size passes, the app does not enable export and asks the user to try a shorter link or another image.
- The interface tells users to scan-test the code before sharing it.

## Background option

- White is the default background.
- The user may select **Transparent background**.
- When selected, light QR modules and the four-module quiet zone use alpha transparency in the PNG and have no background rectangle in the SVG.
- The center-image safety backing remains white, including in transparent output.
- The preview uses a checker pattern so transparency is visible without changing the exported file.
- The app warns users to place a transparent QR code only on a light, plain background.
- The app does not attempt to inspect the future document or surface behind a transparent QR code.
- A background change invalidates the prior result and regenerates all output from the current checked model.

## Async update behavior

- URL, tracking, background, image, and retained color changes invalidate the prior QR result.
- Export buttons are disabled while a new result is prepared.
- A short status message is shown during the check.
- A result from an older request is discarded if the user changes a field before it finishes.
- The same checked QR model, center-image plan, color, and background choice are used for preview, PNG, SVG, and PNG copy.

## PNG export and clipboard

- Download creates `marin-links.png` from the rendered canvas.
- The PNG preserves alpha transparency when the background option is selected.
- There is no Copy PNG button. Copy link copies the link text.
- PNG copy uses the same background choice as the preview and download.
- When PNG copy is unavailable or fails, the app tells the user to download the PNG.
- Copy link uses the shared App Shell clipboard behavior.

## SVG export

- Download creates `marin-links.svg` locally in the browser.
- QR modules and the quiet-zone geometry are vector data.
- White output includes a white background rectangle; transparent output omits it.
- A center image is embedded as a local PNG data URL. It is never linked to an external file.
- Prepared center images larger than 1,600 pixels on their longest side are reduced before embedding. This limits file size while retaining ample print resolution for the allowed image footprint.
- The SVG preserves the same center-image size, white backing, rounded clipping, and protected QR modules as the PNG.
- The SVG contains a title and description naming the final URL.
- The SVG contains no script or external resource request.

## Privacy and network behavior

- The destination, tracking values, selected image, canvas, PNG, and SVG are not sent or stored.
- The QR library is local and permissively licensed.
- Image preparation, safety checks, PNG generation, and SVG generation use only local browser APIs.
- No app API, analytics, telemetry, URL shortener, redirect, or CDN is used.
- Shared App Shell information requests remain governed by `security.json`.

## Accessibility and content

- All fields have programmatic labels and help/error associations.
- Errors use text, `aria-invalid`, and alert semantics; color is not the only signal.
- Dynamic actions report results through the App Shell live region.
- The preview status is polite and the preview card uses `aria-busy` while a result is checked.
- The canvas has an image role and text alternative, and the final URL is always available as text.
- Parameter rows are keyboard operable and have numbered group/remove labels. The searchable selector exposes a labeled listbox, active option, selected option, and visible focus.
- The layout reflows to 320 CSS pixels without horizontal page scrolling.
- User-facing language targets a nontechnical audience at about a sixth-grade reading level.

## Testing requirements

Automated checks must:

- decode a plain QR code;
- decode QR codes with square and wide center images;
- verify transparent trimming and preserved proportions;
- cover a long QR version that includes version and alignment structures;
- enforce backing width, height, area, and error-correction budgets;
- verify that default PNG output is opaque;
- verify that transparent PNG output retains an alpha channel;
- decode downloaded PNG output after compositing it on white;
- parse white and transparent SVG output;
- confirm SVG files contain no script or external resource;
- rasterize and decode SVG output with and without a center image;
- verify that color controls are hidden while their code remains present;
- cover destination, parameter filtering and keyboard selection, custom names, placeholders, duplicate prevention, clipboard, responsive, dark-mode, and security behavior.

Physical phone and print scanning remain release-time manual checks. Transparent output must also be tested on the exact light background where it will be placed.

## Dependency

The QR matrix engine is QRCode for JavaScript by Kazuhiko Arase, vendored locally with its MIT license. The local wrapper also exposes its Reed-Solomon block table and QR utilities for the center-image safety gate. The source copy and source-package notices are retained under `vendor/qrcode/`.
