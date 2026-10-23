## Summary

Describe the change and why it is needed.

## Marin Links behavior

- [ ] Full pasted HTTPS URLs still use parsed hostname validation.
- [ ] Allowlist or subdomain-policy changes include approval and tests.
- [ ] Existing query parameters and fragments are preserved.
- [ ] Link, tracking values, images, PNG output, and SVG output remain browser-local.
- [ ] QR output keeps white as the default, preserves the four-module quiet-zone space when transparent, uses high error correction, and keeps the dark-color check.
- [ ] Plain and center-image PNG and SVG files decode to the final URL.

## MarinOS, content, and accessibility

- [ ] Uses the pinned App Shell without editing `vendor/marinos/`.
- [ ] User-facing text is written for a nontechnical audience at about a sixth-grade reading level.
- [ ] Keyboard use, errors, focus, labels, live status, 320-pixel reflow, light mode, and dark mode were reviewed.
- [ ] The final URL remains available as text.

## Validation and security

- [ ] `bash scripts/check.sh` passes.
- [ ] `bash scripts/check.sh --browser-in-memory` passes.
- [ ] Local-HTTP or deployed-browser testing is complete, or its limits are recorded.
- [ ] New dependencies are local, permissively licensed, reviewed, and documented.
- [ ] CSP/referrer meta tags match `security.json`.
- [ ] No new external service, telemetry, storage, upload, or runtime CDN was added.
