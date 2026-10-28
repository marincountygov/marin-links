# Changelog

All notable changes to Marin Links are documented here.

## 0.2.0 - 2026-10-28

### Added

- Explicit anonymous Short creation for Link, QR code, and **Add many web addresses**, using the Marin Links Server v0.4.5 request and response contract.
- Cryptographically random retry keys. An unchanged retry keeps the same request body and key after a lost response or temporary outage.
- Sequential batch creation with one request at a time, visible progress, per-row results, Stop, safe Retry remaining, Copy all, and CSV export.
- Separate Short URL reports for overall totals and one known Short URL, including privacy suppression and missing-code handling.
- Offline mocked browser coverage for creation, retries, partial batches, rate limits, response validation, Short reports, and decoded PNG and SVG exports.

### Changed

- Long links continue to use the configured root `/?d=` endpoint. Server reports use `/s/api/v1/` routes.
- Capability discovery is treated as guidance. The configured server root remains the trusted base for returned Short URLs.
- The fresh 0.1.0 interface is retained, including Link/QR choices, **Add many web addresses**, Source and Content fields, Send date, and optional Long QR captions.
- CSP, privacy guidance, development notes, and specifications now describe explicit Short creation and the v0.4.5 server contract.
- User-facing Short creation and reporting text uses plain, nontechnical language.

### Fixed

- Typing, previews, tab changes, copying, QR export, and Stats loading never register a Short URL.
- A changed form cannot use an older Short result as the current output. Confirmed prior results remain available separately.
- Temporary or uncertain failures do not receive a new retry key for an unchanged request.
- A `403`, `429`, `503`, or global quota error stops remaining batch requests while preserving completed rows.
- Malformed, foreign-host, or noncanonical server responses are rejected before a URL can be copied or encoded.
- A missing or private one-code report no longer hides the overall Short URL report.
- Frontend channel codes map to the server's `email`, `social`, `print`, `qr`, or `other` values without changing the tracked destination details.

## 0.1.0 - 2026-10-23

### Added

- Starting point copied from Marin QR 0.2.2: the QR code generator, its link checks, and its tests.
- A Link or QR code choice. Both go through the County tracker so visits are counted.
- Create and Stats tabs. Stats shows visits over time, top links, tracking details, and browsers from the tracker.
- A Logo upload and a White or Transparent Background choice for QR codes.
- Channel and campaign name fields under Tracking. They set the standard labels so visits group cleanly on Stats.
- Dropdowns for common tracking values, with "Something else" to type your own.
- Agency dropdown (the County list of agencies and departments, with divisions) and a Campaign dropdown with saved campaigns. Stats can be filtered by agency.
- A Reset button that clears the form.
- A Logo dropdown with the Marin logos read from the Brand Center list (A to Z). New brands show up on their own. A built-in list is used if the Brand Center cannot be reached. Uploading your own logo is switched off for now.
- A "via" label (`qr` or `link`) on every web address, and a "QR codes and links" chart on Stats.
- A send date field that adds the date, such as `261023`, in front of the version label.
- Print help for QR codes: the smallest print width, a note when the code is crowded, and a print size choice (about 300 pixels to the inch) for PNG downloads.
- Many links: paste up to 100 web addresses, get a link for each one, copy them all, or save a CSV.
- Stats: Download CSV and Copy link, which keeps the time, agency, link, and detail choices.
- A master list of agencies, departments, and divisions in `data/agencies.json`, with a schema and a script that checks it and builds the list the page uses.

### Fixed

- The QR code download controls no longer run off the edge of a phone screen.
- The tracking name button now has a name that includes the words shown on it.
- Approved websites include `marinfair.org`, `marincultural.org`, and their subdomains.

### Changed

- Nothing is layered over a QR code logo. Center alignment marks are no longer painted back on top.
- One Download button with a PNG or SVG choice. Copy PNG is removed. Copy link stays.
- Tracking detail names lead with plain words, with the technical name below.
- Removed the tracking example and tracking help text.
