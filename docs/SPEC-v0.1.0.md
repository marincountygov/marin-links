# Marin Links 0.1.0 specification

Status: implemented

## Purpose

Marin Links helps County staff make links and QR codes for approved Marin County web pages, and see how often they are used. It is a static MarinOS app. Links and QR codes are made in the browser. Visits are counted by the County tracker.

## Tabs

The page has two tabs inside `#start`: **Create** and **Stats**. Create is the default. `?view=stats` opens Stats. The tabs follow the ARIA tab pattern, with Left, Right, Home, and End keys.

## Create

### Type

A radio group named **Type** with two choices, in this order: **Link**, **QR code**. Link is the default. Under the web address field, a checkbox **Add many web addresses** (shown only for Link) swaps the single field for the list.

- **Link:** shows the final link and a Copy link button.
- **Link with Add many web addresses:** a text box for up to 100 web addresses, one per line. A pasted spreadsheet row works; the first web address in it is used. The result is a table with a link for each address, a problem message for each address that fails, Copy all links, and Download CSV. The tracking choices apply to every link. The results use the full page width.
- **QR code:** shows the QR code, the Design section (Logo), the print size help, downloads, and Copy link.

The browser can bring back form choices after a refresh. The app reads the real form state on load and when a page is restored.

### Web address rules

| Domain | Subdomains allowed |
|---|---:|
| `marincounty.gov` | Yes |
| `marinhhs.org` | Yes |
| `marincountygov.github.io` | No |
| `marinmap.org` | Yes |
| `marinfair.org` | Yes |
| `marincultural.org` | Yes |

- HTTPS is required. Embedded credentials and nonstandard ports are rejected.
- Matching uses the parsed hostname, never string prefix or substring tests.
- Paths, existing query parameters, and fragments are kept.

#### Optional unrestricted mode (`?dest=any`)

- Opening the app with exactly one `dest=any` query parameter skips only the hostname allowlist. Every other check stays. The name and value are case-sensitive, and a repeated `dest` does not enable it.
- The mode is fixed when the page loads. A `dest` inside a pasted address has no effect.
- The page shows **Any HTTPS link** and hides the County-only website list.
- This is not a permission control. Anyone can use the link.

### The tracked link

The final link is the tracker address plus `?d=` and the percent-encoded destination, with these labels added to the destination:

| Label | Source |
|---|---|
| `utm_medium` | Channel |
| `utm_campaign` | Campaign (a saved one, or a new name changed to lowercase words joined by underscores) |
| `agency` | Agency (the whole department, even when a division is picked) |
| `division` | Division, when one is picked |
| `via` | `qr` for a QR code, `link` for a link or many links |
| `utm_content` | Send date as `YYMMDD`, joined to a "which version" detail as `YYMMDD_value` |
| other names | Extra tracking details |

- Channel, Agency, Campaign, and Send date are optional. `via` is always added.
- Extra tracking details are added with **Add a tracking detail**. Each has a name picker (plain wording first, technical name below), and a value. Names with common answers (`utm_source`, `utm_medium`, `lang`) use a dropdown with a **Something else** choice.
- A custom name starts with a letter or number, uses letters, numbers, underscores, hyphens, periods, or tildes, and is at most 64 characters.
- A name may be used only once, counting Channel, Campaign, Agency, Division, `via`, and the send date.
- Up to 20 extra tracking details.
- The Agency list is the County's list of agencies and departments, in its own order. A department's divisions follow it as "Department: Division" (for example, Health and Human Services: Public Health). The list is the master list in `data/agencies.json`, built into `assets/agencies.js`. Saved campaigns are in `assets/presets.js`.
- Example values appear only as placeholder text and are never added to a link.

### Logo (QR code only)

- A **Logo** dropdown lists None, then the Marin logos in A to Z order.
- The list comes from the Brand Center's `brands.json`. The app starts with a backup list and switches to the live list when it loads. If the list cannot be loaded, the backup list stays.
- Only logo files whose address starts with the Brand Center brands folder are used.
- Uploading a logo is switched off (`FEATURES.logoUpload`). The Background choice and QR color picker are also switched off.
- A logo follows the same checks as any image: PNG, JPEG, or WebP, at most 2 MB and 4,096 pixels a side. Fully transparent margins are removed. The visible proportions are kept.

### QR code rules

- Error correction: high. Quiet zone: four modules. Default color `#1f1f1f` on white.
- A white backing with one module of padding sits behind the logo. It is at most 30% of the grid across and 8% of its area.
- Finder, timing, format, and version modules are restored over the logo. Alignment modules are not, so nothing is layered over the logo.
- Candidate logo sizes are checked at two raster scales. Changed codewords in each Reed-Solomon block use at most 65% of its correction capacity. The final size is reduced from the largest passing candidate and checked again.
- If no logo size passes, export stays off and the page asks for a shorter link or another logo.

### Print help (QR code only)

- The page says the smallest print width: each square about 0.5 mm (0.0197 in), counting the quiet zone, rounded up to 0.1 in.
- A code of version 13 or more adds a note that it is crowded and a shorter link or fewer tracking details makes it easier to scan.
- A Print size choice for PNG: Business card or sticker (1.5 in), Flyer or handout (3 in), Poster (6 in, the default), Banner or sign (12 in). A size below the smallest print width is disabled and marked "too small".
- The PNG is made at 300 pixels to the inch. The file is named `marin-links-<inches>in.png`. SVG hides the size choice.

### Downloads

- One **Download** button with a PNG or SVG choice. The SVG is `marin-links.svg`.
- The SVG has vector modules, a title and description naming the link, and no script or outside resource. A logo is embedded as a local PNG data address, reduced to at most 1,600 pixels on its longest side.
- **Copy link** copies the link text. There is no Copy PNG.
- **Reset** clears the form and returns it to Link.

## Stats

Reads the tracker's public API with `GET` requests only. Nothing about the person using the app is sent.

- Controls: Time (7, 30, 90 days, or a year), Agency (departments only), Link.
- Numbers: Visits, Estimated visitors, Links.
- Charts (Chart.js, local): Visits over time, QR codes and links (from `via`), Top links, Tracking details (with a picker for which detail), Browsers. Each chart has a PNG download.
- The agency choice uses the tracker's one filter. A number the tracker holds back shows "Too few visits to show."
- **Download CSV:** one file with the period, agency, link, and a row per value for each section.
- **Copy link:** copies an address with `view`, `period`, `agency`, `link`, and `detail`. The same address restores those choices when opened. The address bar follows the choices.
- A note under the charts says what a visit and an estimated visitor are.

## Privacy and network behavior

- The web addresses, tracking choices, logo, and generated files are made in the browser and are not sent to a County server by the app.
- When someone opens a link or scans a code, the tracker counts the visit. That is the purpose of the app.
- Network requests from the page: the tracker API (GET), the Brand Center brand list and logo images, and the shared App Shell information sources. `security.json` lists them.
- No analytics, telemetry, QR service, or storage of the person's choices.

## Accessibility and content

- All fields have labels. Errors use text, `aria-invalid`, and alert semantics.
- Results are announced through the App Shell live region.
- The QR canvas has an image role and text alternative. The final link is always text.
- The layout reflows to 320 CSS pixels without sideways scrolling.
- Wording targets about a sixth-grade reading level.

## Testing requirements

Automated checks cover: decoding a plain QR code and codes with square and wide logos; trimming and proportions; a long link; backing and correction limits; opaque and transparent PNG and SVG output; no script or outside resource in an SVG; the `via` label, send date, and label order; Many links, including problems and the 100 address limit; the CSV cell guard; the Brand Center list and its backup; print size and the dense code note; Stats tabs, shared Stats links, and CSV; the allowlist and security rules.

Phone scanning of a printed code is a manual check before release.

## Dependencies

QRCode for JavaScript by Kazuhiko Arase (MIT), and Chart.js 4.5.1 (MIT), both vendored locally with their licenses.
