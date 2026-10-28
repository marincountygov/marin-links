# Marin Links 0.2.0 — Build and Test Report

**Date:** October 28, 2026
**Authoritative frontend baseline:** user-supplied `marin-links-again.zip`
**Baseline version:** 0.1.0
**Baseline Git commit:** `26b5ee471b77acf230e0388053ae6d0376125381`
**Baseline ZIP SHA-256:** `132b6f1dcb9638766f9c4e3eb100e77bebaba1ee89f0643ee2c9397256d3acc5`
**Result:** Marin Links 0.2.0
**Backend contract:** user-supplied Marin Links Server v0.4.5 reference bundle; backend unchanged

## Baseline and merge result

The guaranteed current ZIP was treated as the source of truth. It differs materially from the earlier archive: Link and QR code are the primary Type choices; **Add many web addresses** is a Link option; Tracking includes Source, Content, and Send date; and Long QR codes can print the destination address below the code.

The Short API work was rebuilt on that 0.1.0 source instead of forcing the earlier patch onto it. The resulting 0.2.0 release preserves those current controls, the MarinOS shell, local QR generation, existing tracking details, approved-domain behavior, Stats, tests, and release structure.

## Implemented behavior

- Explicit anonymous Short creation for Link, QR code, and Add many web addresses.
- No Short creation from typing, preview updates, Type or Length changes, tab changes, copy, QR export, or Stats loading.
- Configurable HTTPS server root and application source path.
- Exact v0.4.5 creation request shape, with no browser API key, Authorization header, cookie, or manually supplied Origin header.
- Cryptographically random idempotency keys. An unchanged uncertain retry reuses the same payload and key.
- Strict validation of returned ID, code, URL, state, revision, and date fields before a Short URL can be copied or encoded.
- Sequential batch creation with one request in flight, input-order results, Stop, partial success, safe Retry remaining, Copy all, and CSV.
- Batch stop behavior for global denial, rate limits, service outages, and global quota conflicts.
- Separate overall Short URL reporting and one-known-code reporting. Suppressed or unavailable one-code results do not hide the overall totals.
- Long tracking remains `/?d=`. Local PNG and SVG QR generation and decoding behavior are unchanged.
- Source, Content, Send date, Channel, Campaign, Agency, custom details, repeated query names, existing query strings, and fragments remain part of the completed destination.
- A confirmed Short QR encodes and optionally labels the server-issued Short URL, not the private destination or a second `/?d=` wrapper.
- CSP, privacy, security, developer guidance, changelog, and specifications updated for explicit Short creation.

## Automated test results

### Static, metadata, generated-data, and syntax checks

Command:

```bash
bash scripts/check.sh
```

**PASS**

This completed:

- security metadata and generated CSP synchronization;
- MarinOS shell 1.18.0 manifest and file-hash checks;
- 14 security-meta tests;
- generated agency and tracking-option checks;
- 20 application static tests; and
- JavaScript syntax checks for application and vendored runtime files.

### In-memory shell and CSP browser checks

Commands:

```bash
python3 tests/browser_smoke.py --in-memory
python3 tests/browser_security.py --in-memory
```

**PASS**

These verified the MarinOS component fixture and browser-enforced CSP, including allowed resources and blocked connections, scripts, and inline styles.

### Mocked Short API, QR export, batch, security, and Stats browser checks

The 23 mocked cases were run in three isolated groups because this execution service terminates long aggregate commands at about 60 seconds. Every case passed.

Coverage includes:

- Long `/?d=` construction with repeated query names and fragments;
- no creation before the explicit action;
- exact POST URL, JSON, headers, source path, channel mapping, and no credentials;
- Source, Content, Send date, Campaign, Channel, and QR `via` preservation;
- 201 creation and same-key 200 replay;
- double-click protection;
- stale-result protection and late-response isolation;
- lost-response and 503 retry with the original key;
- capability advisory behavior and trusted-base fallback;
- nested server installations;
- malformed JSON, incomplete records, foreign hosts, noncanonical paths, and unsafe known-code rejection;
- 403, 413, 422, 429, and 503 behavior;
- actual decoding of the preview QR, downloaded PNG, and rasterized SVG as the confirmed Short URL;
- sequential batch order, one request in flight, local and server row errors, Stop, global denial, unknown outcomes, safe retry, rate-limit stop, and partial results;
- 100-row preview behavior;
- separate overall and one-known-code Short reports;
- privacy suppression, 404 handling, CSV privacy, and no public code enumeration; and
- no horizontal overflow at 320, 390, and 1,440 pixels in light and dark modes.

Twelve responsive screenshots were generated and reviewed for the Short Create and Short Stats states at those widths and color schemes.

### Full local-HTTP browser suite

Command attempted:

```bash
python3 tests/browser_app.py
```

**NOT EXECUTED TO COMPLETION — environment restriction**

Chromium was blocked before loading the local test page:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:<port>/template-test/#start
```

The test itself was updated for explicit Short creation and the current baseline controls. Run `bash scripts/check.sh --browser` on a development machine where Chromium may reach localhost. This restriction does not indicate an application assertion failure.

## Live-service and backend safety

- No request was sent to the live Short creation endpoint.
- No live Short redirect was opened or fetched.
- No production analytics visit was created for testing.
- No server file, server configuration, database, key, or deployment was changed.
- All creation and Short Stats responses were synthetic browser mocks.
- Production CORS, allowed sources, County/VPN egress rules, destination policy, quotas, and deployed reporting remain administrator deployment checks.

## Packaging verification

The release process verifies all three deliverables against the exact 0.1.0 baseline:

1. `git apply --check` and patch replay;
2. update ZIP overlay onto a fresh baseline copy;
3. complete ZIP extraction;
4. source-tree comparison excluding Git metadata and transient caches; and
5. static checks from the replayed and extracted trees.

Final package hashes are listed in `marin-links-v0.2.0-SHA256SUMS.txt`.

## Conclusion

Marin Links 0.2.0 implements the requested v0.4.5 Short API frontend behavior on the guaranteed current 0.1.0 codebase while retaining its current UI and local QR features. The only uncompleted automated check is the localhost-dependent browser suite, which is blocked by the execution environment rather than by a failed application assertion.
