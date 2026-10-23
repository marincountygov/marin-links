# Changelog

All notable changes to Marin Links are documented here.

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
- A "via" label (qr or link) on every web address, and a "QR codes and links" chart on Stats.
- A send date field that adds the date, like 261023, in front of the version label.
- Print help for QR codes: the smallest print width, a note when the code is crowded, and a print size choice (about 300 pixels to the inch) for PNG downloads.
- Many links: paste up to 100 web addresses, get a link for each one, copy them all, or save a CSV.
- Stats: Download CSV, and Copy link, which keeps the time, agency, link, and detail you chose.

### Fixed

- The QR code download controls no longer run off the edge of a phone screen.
- The tracking name button now has a name that includes the words shown on it.

### Changed

- Nothing is layered over a QR code logo any more. The center alignment marks are no longer painted back on top.
- One Download button with a PNG or SVG choice. Copy PNG is removed. Copy link stays.
- Tracking detail names lead with plain words, with the technical name below.
- Removed the tracking example and the tracking help text.
