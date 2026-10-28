# Marin Links — Short URL API Integration

**Status:** FINAL — approved integration requirements reconstructed for a fresh-codebase rebuild (2026-10-28)
**Specification revision:** 1.1 — rebuild handoff; supersedes the earlier frontend integration SPEC revision 1.0
**Frontend:** Marin Links (`marin-links`); the original integration shipped as v0.2.0. **Rebuild against the fresh frontend archive supplied in the new chat**, whatever its current version; choose the next release number from that codebase rather than assuming v0.2.0.
**Backend:** Marin Links Server (`marin-links-server`) v0.4.5 reference snapshot (short-link API behavior originally added in v0.4.x; verified against packaged v0.4.5 source)
**Deployment:** Static frontend on GitHub Pages (`https://marincountygov.github.io/marin-links/`) and a temporary mirror (`https://misc.marinhhs.org/marin-links/`); backend at `https://l.marinhhs.org/`. Source path claim `/marin-links/` in both cases.
**Authority:** This document governs the *frontend integration*. The server remains authoritative for creation policies, destination allowlists, rate limits, code assignment, analytics, and public reporting. It does not replace the server's v0.4.x specification. This is a behavioral specification, not an instruction to reapply the old v0.2.0 patch to a changed frontend.

## Rebuild handoff — read first

**Input to the new chat:** attach (1) the **fresh Marin Links frontend source ZIP**, (2) this SPEC, and (3) `marin-links-server-short-api-reference-v0.4.5.zip` provided alongside it. **Do not upload production `config.local.php`, the SQLite database, capability keys, or analytics logs.** The reference archive is a read-only copy of unmodified backend source, an OpenAPI contract, and focused tests; it is not an installable replacement server.

**Goal:** rebuild the user-approved integration, not merely wire up one API POST. Preserve all current fresh-frontend features and architectural decisions, and adapt file paths when the fresh code differs from historical v0.1.0/v0.2.0. Work client-side, with no build step, no third-party runtime CDN, and no server API modifications unless a verifiable compatibility defect requires a separate proposal.

**The completed historical v0.2.0 frontend ZIP is optional for comparison, not the baseline.** This SPEC describes its required behavior. Implement with the fresh code provided in the new chat, then run that codebase's tests and add new mocked API/QR/Stats tests. Do not assume its current `VERSION`, DOM IDs, or structure match the historical release.

**Priority ordering:** (1) prevent accidental creation and preserve Long/QR; (2) correct API protocol and safe idempotency; (3) batch partial-success semantics; (4) public short statistics; (5) security/CSP/docs and tests.

---

## 1. Approved product decisions

1. Use `https://l.marinhhs.org/` as the configured initial server root. Keep the root configurable for a future production domain or nested installation; do not scatter the hostname throughout code or docs.
2. Use **anonymous** short-link creation, subject to the backend's HTTPS `allowed_sources`, declared `source_path`, approved destination hosts, and optional client-IP/CIDR allowlist. No secret, API key, login, or role is required in Marin Links.
3. Register a short URL **only** after the user explicitly clicks **Create short link** (or **Create short links** for a batch). Never register from typing, preview, tab selection, reload, page restoration, copy, QR export, or Stats loading.
4. Support **Many links** in short mode, with visible sequential progress, per-row results, and safe retry behavior. Keep its current maximum of 100 input addresses; do not bypass server quotas or rate limits.
5. Include short-link reports in the existing **Stats** tab, distinct from long/tracked-link reports.

## 2. Scope and non-goals

### In scope

- Integrate the existing `Type` (Link / Many links / QR code) and `Length` (Long / Short) controls with the server's v0.4.5 API.
- Update the local tracker configuration, CSP, privacy/security documentation, and tests for the new server root and POST requests.
- Preserve the existing campaign/agency/channel/custom tracking parameter builder, QR generation, copy/download features, bulk CSV export, and accessible MarinOS interface.
- Add explicit short-link creation state, validation, network error handling, idempotent retry behavior, batch progress, and public short-link statistics.

### Out of scope

- Server schema, routing, or management changes; user login; capability-key entry; CLI administration; editing or disabling previously registered links; custom aliases for anonymous creation; server-side QR rendering; persistent storage of destinations or creation keys.
- A public list or enumeration of all short links. The v0.4.5 public API offers global aggregate statistics and per-*known-code* statistics, but no public catalogue of registered codes.
- Changes to the Marinos App Shell vendor bundle or the local QR generation algorithm.
- Automatic API retry loops, especially after `429` or uncertain network failures.

## 3. Source review / integration baseline

The uploaded v0.1.0 frontend currently has:

- `assets/tracker-config.js`: `endpoint`, `redirect`, and `apiBase` pointing to the previous tracker host. Its `redirect` is **not** a shortener call; both length choices currently construct `?d=` locally.
- `assets/app.js`: live, 300-ms preview recomputation; `buildTrackedUrl()`; shared `collectParameters()`; QR rendering and PNG/SVG export; `MAX_BULK_LINES = 100`; bulk CSV protection against spreadsheet formulas.
- `assets/stats.js`: existing QR/tracked-link analytics, filters, accessible charts, CSV, and shareable URL state. It currently uses the old read-only API base.
- `index.html`: three Type radio options, two Length radio options, a Preview card, current copy/export and Many-links controls, and the Stats tab.
- `security.json` and `scripts/sync-security-meta.py`: the CSP source and generated HTML meta policy.
- `AGENTS.md`, `README.md`, `SECURITY.md`, and static/browser tests: several statements explicitly forbid `fetch` from the Create tab and claim no destination information is transmitted. Those statements and assertions must be revised for *explicit* short-link creation; local long links and local QR files remain unchanged.

**Separation recommendation:** Add a small `assets/short-links-api.js` network adapter (loaded locally before `assets/app.js`), rather than embedding raw `fetch()` calls throughout the rendering code. This preserves simple, testable presentation logic and avoids any runtime build step.

## 4. URL configuration and discovery

Use a single application-owned configuration object in `assets/tracker-config.js`, initially describing:

```js
window.MarinLinksTracker = Object.freeze({
  serverRoot: 'https://l.marinhhs.org/',
  sourcePath: '/marin-links/'
});
```

This is a proposed configuration *shape*. Preserve backward-facing property names only where they make the revised source clearer, not as a separate compatibility layer for obsolete API URLs. Derive, or validate by discovery, these canonical endpoints:

| Operation | Current URL |
| --- | --- |
| Long/tracked redirect | `https://l.marinhhs.org/?d=ENCODED_DESTINATION` |
| Capabilities (read-only) | `https://l.marinhhs.org/s/api/v1/capabilities` |
| Create short URL | `https://l.marinhhs.org/s/api/v1/short-links` |
| Global short-link stats | `https://l.marinhhs.org/s/api/v1/short-links/summary` |
| Per-short-code stats | `https://l.marinhhs.org/s/api/v1/short-links/{code}/stats` |
| Existing QR/tracked stats | `https://l.marinhhs.org/s/api/v1/{existing-report-route}` |

- Normalize and validate `serverRoot` as a trusted configured HTTPS URL with a trailing slash. Never derive API hosts from untrusted input or from the currently entered destination URL.
- URLs must also work when the server is installed under a URL subpath; use the configured root and relative URL resolution, not hardcoded `/s/` from the hostname root.
- When Short is selected, read `GET /s/api/v1/capabilities` as a *hint* to discover `creation.anonymous_enabled`, `short_url_base_url`, and `server_base_url`. The capability response is not a promise that a particular client IP passes creation restrictions.
- Only the actual `POST` determines whether creation is authorized. A failure to load capabilities may show a non-blocking advisory or retry state; it must not silently turn Short into Long.
- After success, trust the returned `data.short_url`, subject to client-side HTTPS and expected canonical-base validation; do **not** invent a code, concatenate a short URL, or force it through `/?d=` again.
- The GitHub Pages source path is set to `/marin-links/` initially. It is a declared application path, not the current page's full URL or a browser-attested identity; it must be configurable for another GitHub Pages path.
- **Both deployed frontend origins are supported:** on GitHub Pages the browser `Origin` is `https://marincountygov.github.io`; on the temporary County mirror it is `https://misc.marinhhs.org`. Neither includes `/marin-links/`. In both deployments, the JSON `source_path` should be `/marin-links/`. The backend administrator must allow the corresponding origin/path combination; the frontend cannot set `Origin` itself.
- Treat capability discovery as advisory: `creation.anonymous_enabled` is computed from the public creation toggle and a nonempty source list, **not** an end-to-end client authorization check (it does not attest IP policy, current quota, emergency runtime shutdown, destination policy, or this browser's origin). If false, use an accurate neutral message such as “Short-link creation is not available. Ask your administrator to check the server settings and approved websites.” Do not misdiagnose a particular policy from the boolean alone. A failed capability GET must not trigger POST or turn Short into Long.
- Use `new URL("s/api/v1/...", root)` or an equivalent path-safe join for root **and nested** server installations. The root `/?d=` tracker is canonical relative to the configured application base; do not relocate it to `/s/?d=`.


## 5. Shared destination and parameter construction

- Retain `parseDestination()` and the existing frontend destination checks as early user guidance; the backend's independent `public_allowlisted` policy remains authoritative.
- Continue collecting tracking parameters once using `collectParameters()`, and appending them to the already parsed destination with `URL.searchParams.append()` before performing either Long generation or Short creation.
- Preserve all pre-existing destination query parameters, repeated parameter names, and fragments; append the chosen tracking data in the existing order.
- Keep the existing `via=qr` for QR Type and `via=link` for Link and Many-links Type. These labels are user-declared distribution metadata, not evidence of a verified scan.
- Continue validation for likely personal contact data. If the server rejects the final destination for privacy or allowlist reasons, show its safe error message and do not alter or truncate the destination silently.
- The existing `?dest=any` browser demo override does **not** override server destination validation. Do not suggest to the user that selecting an unapproved domain will guarantee short-link creation.
- **Long** remains locally generated and continues to use the root `/?d=` endpoint. Long QR generation, preview, copy, and exports remain local and automatic.
- **Short** means *registered managed short URL*, never a shorter-appearing locally constructed tracking URL. It requires an explicit API action and a successful server response.

## 6. Short-link creation contract

### 6.1 Request

```http
POST https://l.marinhhs.org/s/api/v1/short-links
Origin: https://marincountygov.github.io
Content-Type: application/json
Accept: application/json
Idempotency-Key: 123e4567-e89b-42d3-a456-426614174000
```

```json
{
  "destination": "https://hhs.marincounty.gov/?utm_source=flyer&via=link",
  "alias": null,
  "label": "",
  "channel": "other",
  "campaign": "",
  "source_path": "/marin-links/"
}
```

- The browser sends the actual `Origin` header; JavaScript must not attempt to set it manually.
- `source_path` is the configured GitHub Pages application path. Neither it nor `Origin` constitutes authentication. Users' browsers contact the server directly, so the backend's client-IP allowlist applies to user/County/VPN egress IP addresses, **not GitHub Pages IP addresses**.
- Never include a static creation or management key. No `Authorization` header is sent in this mode.
- `alias` must be `null`/omitted for anonymous users; server defaults prohibit anonymous custom aliases.
- `label` can remain empty; do not invent a server-side label from sensitive or potentially private URL parts.
- `campaign` is the existing non-sensitive normalized campaign code or `""`, within the server's metadata length limits.
- `channel` must be one of `qr`, `print`, `email`, `social`, `other`: use `qr` for QR Type; for Link/Many-links map explicitly selected recognized `utm_medium` values of `print`, `email`, or `social` to those codes, otherwise use `other`. Do not send arbitrary `utm_medium` strings as the server enum.
- Set `Idempotency-Key` using browser cryptographic randomness (`crypto.randomUUID()` is sufficient). The key is stable for retries of one *unchanged* request and unique for a distinct destination/parameter snapshot or batch row. Do not use a new key merely because an HTTP response was lost.
- The actual v0.4.5 backend accepts `Idempotency-Key` consisting of **16–128** ASCII letters, digits, `_` or `-` (`^[A-Za-z0-9_-]{16,128}$`). Browser `crypto.randomUUID()` fits; if unavailable, use `crypto.getRandomValues()` to produce a standards-compliant random UUID, never `Math.random()`.
- **Idempotency scope caveat:** the backend scopes anonymous replay to the declared origin/path **and a keyed hash of the client IP**. Retry an uncertain request with the original payload/key while still on the same network. If the client IP/network changes, the server may not recognize the replay and a duplicate link can be registered; make that limitation explicit rather than promising global exactly-once creation. Server retention also limits replay guarantees.

- `Content-Type: application/json`, bounded payloads, and the backend's limits apply. No credentials or cookies are needed (`credentials: 'omit'`).

### 6.2 Response

On `201 Created`, or `200 OK` for an idempotent replay, parse:

```json
{
  "data": {
    "id": "93b41f69a20947c69837fc96c79db8af",
    "code": "7km9p2txqa",
    "short_url": "https://l.marinhhs.org/7km9p2txqa",
    "status": "active",
    "revision": 1,
    "created_at": "2026-10-27T18:00:00Z"
  }
}
```

- Treat both `200` and `201` as success; do not create another code after receiving a replay.
- Validate `data.short_url` as HTTPS and a one-segment short URL under the canonical base advertised by the trusted server. Validate `code` as a safe server code, but use `short_url` verbatim for copy and QR encoding.
- No request may follow the created short URL to "test" it: that would count an artificial visit. The user may choose to test it manually.
- A response received for a now-obsolete form snapshot must not silently replace the current preview; preserve the created result visibly as a prior result without presenting it as the current form's output.
- The backend returns the canonical link in `data.short_url`, with `data.code`, `data.id`, `data.status`, `data.revision`, and `data.created_at`. In the v0.4.5 source `code` is a lowercase, single-segment path token; custom aliases are not an advertised frontend capability and should not be requested in anonymous mode even if the server operator later enables them.


### 6.3 Error handling

Server v0.4.5 error responses use `{ "error": { "code": "...", "message": "..." } }`.

| Status | Examples and required user behavior |
| --- | --- |
| `400` / `415` / `413` | Invalid fields, media type, or oversized request: explain issue; do not retry automatically. |
| `401` | Unexpected for anonymous mode; show that server rejected authorization and advise configuration review. Never fall back from an invalid supplied key to anonymous mode. |
| `403` | `creation_disabled` (creation off/emergency), `source_not_allowed` (origin/path/IP), `alias_not_permitted`: give a safe neutral explanation, stop pending bulk requests for global restrictions, and do not expose allowlisted IP ranges. A disallowed destination normally returns `422`, not `403`. |
| `409` | Alias, idempotency, or global quota conflict: explain and retain original row/input; stop batch if quota exhausted. |
| `422` | Destination or metadata rejected: show a per-row validation failure; user may correct inputs before a new attempt. |
| `429` | Rate limited: stop the batch, preserve all earlier results, show retry guidance. Do not retry automatically. `Retry-After` may not be readable cross-origin unless exposed by the server. |
| `503` | Server temporarily unavailable: preserve inputs and prior successes; offer manual retry with the same key. |
| Network/CORS failure | No confirmed result: clearly distinguish *unknown outcome* from a definite failure; retry with the same key and unchanged payload. A CORS failure may conceal a server-side `403`. |

Only show safe, plain-language error information; do not place raw response HTML in the DOM. Do not claim creation failed conclusively if the network might have lost a successful response. A server-side idempotency key is scoped and retained for a limited period, not a permanent global duplicate guarantee.

**Verified CORS behavior:** The backend preflight permits `OPTIONS` for the create route with `Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key` and a configured origin. Anonymous POST must use `Content-Type: application/json`, `Accept: application/json`, `Idempotency-Key`, and `credentials: 'omit'`, but **no Authorization header**. The API does not currently expose `Retry-After` for browser JavaScript cross-origin access through `Access-Control-Expose-Headers`; handle 429 reliably without depending on reading that header. Do not disable CSP broadly to work around CORS. If preflight fails, browser JavaScript may only see a network error and must not falsely report a confirmed server denial.


## 7. Single Link and QR user experience

### 7.1 Length = Long

- Preserve existing immediate browser-local preview and generation. No creation API request.
- The URL should be the configured server root with the complete destination encoded as `d`.
- For QR Type, continue drawing the QR immediately and offering PNG/SVG and copy after local validation.

### 7.2 Length = Short

- Keep the existing Link / Many links / QR code Type controls and the Long / Short length radio options. Short is available across all three Types.
- Validate destination and tracking details locally as the user types, but **do not create a short code** or show a finished copyable short URL during preview updates.
- When valid, show the final destination preview and a clear **Create short link** button. When invalid, disable the action and show input-specific errors.
- On click, freeze the input snapshot and generate one unique idempotency key. Disable duplicate submissions; show a visible, screen-reader-announced `Creating short link…` state.
- On successful response, show the returned short URL as text and enable Copy. For QR Type, render the QR using *that short URL* and enable PNG/SVG exports with the existing logo/scan-safety logic. QR files and logos remain browser-local.
- If form values change afterward, mark the prior short result **Out of date** relative to the current inputs; disable its use as the current preview and require another explicit Create action. Do not silently overwrite/repoint the previously registered code. Keep prior successful result accessible for deliberate copying until Reset or leaving the page.
- During an in-flight request, temporarily disable changing the form or use a snapshot/version guard; never associate a late response with different form values.
- If the user changes Type or Length, preserve logical state but do not create a new code. Returning to a matching unchanged snapshot may reuse an already confirmed result within that page session.
- Copy, QR export and Download must never use a stale or unconfirmed short URL as the current output.

## 8. Many links: short mode

- Keep input of up to **100** web addresses, including pasted spreadsheet columns. Preserve original input order and the existing error-column concept.
- Local parsing and validation may run live, but no HTTP POST occurs until the explicit **Create short links** action.
- Show a pre-submit summary: total rows, locally valid rows, invalid rows, and reminder that each valid row registers a persistent short URL and counts toward server quotas.
- On approval, create sequentially, **at most one request in flight**, in input order. Do not send 100 simultaneous requests, circumvent per-IP/source limits, or introduce undocumented rate-limit workarounds.
- Display progress `Created N of M`, each row's status (`Waiting`, `Creating`, `Created`, `Needs correction`, `Rate limited`, `Not attempted`, or `Unknown—retry safely`), and the returned short URL for successful rows.
- Use one stable payload snapshot and a separate idempotency key for each row. Retain these in memory for retries so a transport error does not automatically register a second link.
- Failed validation of one row need not stop later eligible rows. Stop further submission when `403` indicates a global creation restriction, `429` indicates rate limiting, `503` indicates server unavailability, or a global quota is exhausted; mark the rest `Not attempted`.
- `Stop` may stop **after the current request**; it cannot guarantee cancellation of a request already accepted by the server. `Retry remaining` reuses the same key and payload for uncertain rows and never reissues successfully completed rows.
- Keep Copy all and CSV export available for completed rows even if the batch stops early. CSV must contain input web address, created short URL, and status/error; retain spreadsheet-formula escaping and original row ordering.
- Preserve **completed short URLs even when forms are subsequently edited** by showing a distinct previous-results area; never rebind a created code to the newly edited destination. Only confirmed results may be copied as registered links.

- With the server's proposed default of **30 anonymous creations per IP per hour**, a 100-row batch may halt at a rate limit. Explain this upfront; do not impose a lower hardcoded frontend limit unless explicitly configured. The app should show the result honestly rather than silently substituting Long links for uncreated rows.
- If inputs or shared tracking fields are edited after a batch, mark prior results as belonging to the earlier batch; never replace completed results with freshly generated request payloads.

## 9. Stats tab: QR/tracked vs short-link reporting

Add a clearly labeled report type control within the existing Stats tab, such as **Tracked links** / **Short URLs**. Both must use the configured server root and current `/s/api/v1/` paths.

### 9.1 Existing tracked-link reports

- Preserve current agency, tracking-parameter, link, period, daily trend, browser, and CSV features.
- Update `assets/stats.js` to use `/s/api/v1/summary`, `/daily`, `/links`, `/parameters`, `/parameters/values`, and `/agents` (and other existing documented routes as applicable).
- Continue to report redirect requests, not verified QR scans or people. Do not combine the totals with managed short-link requests.

### 9.2 Short URL reports

- Load the **public aggregate** `GET /s/api/v1/short-links/summary?from=YYYY-MM-DD&to=YYYY-MM-DD[&traffic=...]` for the selected period.
- Display `visits`, `estimated_daily_unique_ips`, `active_short_links`, and daily trend from the actual response. Note: the unique-IP metric is a **sum of per-code daily estimates** and can count the same IP across codes/days. `active_short_links` is a current registry count, not the number created in the selected period.
- Provide an input to enter a **known short code or a complete short URL**. Normalize and validate that it belongs to the configured short URL base before calling `GET /s/api/v1/short-links/{code}/stats`. Do not attempt a public bulk catalogue or enumerate codes.
- Per-code response supports date/traffic, visits, daily estimated unique IPs, daily counts, browser counts, country breakdowns, and approximate city/region rows. Use existing local Chart.js where useful, plus accessible tables; do not invent server-side agency, campaign, or arbitrary parameter filters for per-code endpoints that do not implement them.
- If the server returns `data: null` with `meta.suppressed: true`, show **Too few visits to show.** Treat 404 as an unavailable/unpublished short link without disclosing its private destination.
- Include short report data in Stats CSV export, with no private destination URLs, raw User-Agents, IP identifiers, or undisclosed short-link listings.
- Preserve shareable Stats URLs with a clear `report=tracked|short` selector and optional known `code`, in addition to the current period and tracked-report filters. Do not place secrets or individual visitor data in query parameters.
- Optionally offer a session-only quick choice for short codes **created in the current page session**, but use neither localStorage nor server enumeration to construct a public list.

## 10. Security, privacy, accessibility, and interoperability

- Keep all application and QR libraries local, continue using the locally vendored MarinOS shell and Chart.js. No new runtime build step or external QR API.
- Update `security.json` (the canonical CSP source) and regenerate the meta CSP using `scripts/sync-security-meta.py --write`. Remove the old tracker API host if no longer required; allow `connect-src` to `https://l.marinhhs.org` for JSON GET and POST. Do not enable arbitrary third-party `connect-src` destinations.
- Update `SECURITY.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md`, and description/security metadata: explicit short-link creation **sends the completed destination URL and selected marketing metadata to the County server**, and the server stores a private destination record. Long previews and QR images remain local. Avoid the old blanket assertion that destinations are never uploaded.
- The server alone validates the destination allowlist, blocked hosts, request sizes, quota, Origin/source-path rules, and client IP. Do not represent `allowed_sources` as proof of staff identity. `?dest=any` does not relax server restrictions.
- The static frontend stores no API keys, cookies, server credentials, persistent visit identifiers, or sensitive browser data. Short creation results and retry keys are held only in memory.
- Treat external text as untrusted. Render URLs, API messages, and CSV content safely: DOM `textContent`/safe attributes, no untrusted `innerHTML`, and existing CSV formula escaping.
- The `source_path` value is an application-path declaration, not an authorization token; IP restrictions apply to the real **browser visitor** (County/VPN public egress), not to GitHub Pages. No static API creation key or management key belongs in the frontend. `public_custom_aliases_enabled` on the server does not require a frontend custom-alias UI.

- Keep public URL construction and parsing safe against query/fragment injection, malicious hosts, escaped slashes, and URL lookalikes. The copied URL must be exactly the validated server-issued URL.
- Plain-language messages targeting approximately a sixth-grade reading level; keyboard-operable buttons, correct focus behavior, descriptive errors, `aria-live` progress without excessive announcements, and 320-pixel reflow/light/dark checks. Preserve QR contrast and print-quality controls.
- When the user does not have a permitted IP address, show a useful but non-sensitive error explaining that short links may require the County network/VPN. Avoid exposing the allowed CIDR list in browser error messages.
- Do not trigger redirect requests automatically from Stats, previews, QR validation, or tests against the live tracker: doing so fabricates visits.

## 11. Recommended source changes

| File | Change |
| --- | --- |
| `assets/tracker-config.js` | One configurable new server root, application source path, canonical endpoint derivation |
| `assets/short-links-api.js` (new) | No-secret fetch/response adapter, capabilities, creation, error parsing, idempotency support |
| `assets/app.js` | Distinguish local Long from server-backed Short; explicit create; single and bulk request state, stale prevention, QR output |
| `assets/stats.js` | Updated existing report routes, short report mode, known-code lookup, short statistics and CSV |
| `index.html` | Explicit creation controls, progress/results states, Stats mode selector and code input; script include |
| `assets/app.css` | Form/progress/table and narrow-viewport styling only; no shell-owned overrides |
| `security.json` and generated CSP | New approved `connect-src`, accurate data disclosures |
| `README.md`, `SECURITY.md`, `AGENTS.md`, `CHANGELOG.md`, `SPEC.md` | Update purpose, integration, network/privacy contract, current requirements |
| `tests/` | Mocked creation, batch, stats, accessibility, URL/ID matching, security, and regression tests |

The existing static test that prohibits `fetch(` in `assets/app.js` may remain if the network adapter owns fetch; the broader claim that the app has no create-time network traffic must be revised. Preserve tests guarding against localStorage, cookies, client keys, and external QR services.

## 12. Operational prerequisites (administrator checklist)

At the server, separately from the frontend deployment:

1. Confirm the deployed API really serves `https://l.marinhhs.org/s/api/v1/short-links`, `/s/api/v1/capabilities`, and the short statistics endpoints, with valid HTTPS and CORS.
2. Explicitly set `short_links.creation.public_enabled = true`; leave capability-key creation disabled unless independently needed.
3. Populate `short_links.creation.allowed_sources` with `https://marincountygov.github.io/marin-links/` (or the actual frontend path).
4. Set `short_links.creation.allowed_client_ips` to approved County/VPN public egress IPs/CIDRs when network-only creation is required. These are **user** egress addresses; an empty list adds no IP restriction.
5. Populate `public_allowlisted.allowed_hosts` with approved HTTPS destinations; leave blocked-host rules in effect. A configured global wildcard is a deliberate higher-risk policy.
6. Confirm anonymous creation is not under emergency shutdown, has remaining quotas, and its source/IP/URL policies allow the intended test case.
7. Verify both `201` and idempotent `200` creation, `403` denied IP/source, and `429` quota behavior using test fixtures **without contaminating production analytics**. The frontend cannot bypass backend controls.
8. For the temporary mirror, also approve `https://misc.marinhhs.org/marin-links/` in `short_links.creation.allowed_sources`; for GitHub Pages, approve `https://marincountygov.github.io/marin-links/`. Keep `source_path` `/marin-links/` in the frontend for both. Both entries may coexist.
9. Distinguish creation-source rules from destination-host rules: adding `https://misc.marinhhs.org/marin-links/` to `allowed_sources` **does not** allow that URL as a redirect destination. For a destination on that subdomain, `public_allowlisted.allowed_hosts` must allow `misc.marinhhs.org` exactly or `*.marinhhs.org`; `marinhhs.org` alone does not allow subdomains. Use least privilege and retain any blocked-host rules.
10. `short_links.creation.allowed_client_ips = []` means no additional client-IP restriction; when populated, include authorized user/VPN egress IPs/CIDRs, **not** GitHub IPs. The server reads Apache `REMOTE_ADDR`, not arbitrary forwarded headers.
11. `php bin/init.php` must have been run after server upgrades before relying on public reporting. Website path/query reporting introduced in v0.4.3 and the website-purge CLI added in v0.4.5 are separate backend features and are **not part of this frontend rebuild**.


The frontend should not disclose or manage server configuration. Server initialization, quota settings, and link administration stay in Marin Links Server.

## 13. Acceptance tests

**Creation and URL integrity**

1. A Long Link creates `https://l.marinhhs.org/?d=...` without any POST; original and appended query parameters, repeats, and fragment survive.
2. Short selected in Link, Many-links, or QR Type never sends POST on typing, debounce preview, switching Type/Length/tab, restore, reload, copy, or export.
3. Explicit Create sends exactly one POST with validated destination, configured source path, appropriate channel/campaign, and a valid unique idempotency key.
4. The server's `201` response and same-key `200` replay produce the same copyable short URL; no double creation from double-click.
5. A final QR code, PNG, or SVG encodes the **server-issued short URL**, never the full destination or a twice-wrapped `?d=`. Existing QR safety/decode tests pass.
6. Changing form data marks a created result stale and prevents its use as the current output; a new Create uses a new key.
7. No custom alias is sent in anonymous mode. A destination rejected by the server remains unregistered in the frontend.

**Many links**

8. With 100 rows, no automatic POST occurs; explicit Create starts one-at-a-time requests and gives accurate row progress/results.
9. One malformed row is reported without dropping, reordering, or corrupting successful rows; CSV and copy include only confirmed results with accurate per-row statuses.
10. A `429` after partial creation halts the batch, retains successes and keys, and leaves untouched rows unattempted; no silent Long fallback.
11. A lost response, retry, or user-requested Stop does not automatically generate new duplicate codes; retry of the same payload reuses the same key.
12. Agency/campaign/channel/custom tracking parameters apply to every valid row while preserving each destination's original query parameters.

**Policy and errors**

13. `403` from unapproved Origin/source path or user public IP shows actionable denial without leaking allowed ranges; the frontend sends no Authorization header.
14. With `public_enabled=false`, the UI shows short creation unavailable; Long and local QR remain functional.
15. CORS errors, unreachable server, malformed JSON, `413`, `422`, `429`, and `503` are presented safely, with the current form and any completed results preserved.
16. The `?dest=any` frontend query parameter never bypasses server allowlists or changes server policy.
17. A future server hostname or subdirectory configured in `assets/tracker-config.js` updates all relevant API/tracking paths without codebase-wide edits.

**Statistics and privacy**

18. Existing tracked-link Stats work against new `/s/api/v1/` routes and retain agency/parameter filtering.
19. Short-link Stats show correct summary and per-*known-code* data, with no public link enumeration, no leaked destination, and correct minimum-count suppression.
20. Short-link counts are not added to existing `/?d=` redirect totals; per-code HMAC uniqueness is described as an estimate, not people.
21. Stats deep links, CSV, responsive charts, and accessible tables work in both report modes.
22. `security.json`, generated CSP, documentation, and tests accurately describe POST-based short creation and no persistent browser secrets.
23. No live short redirects are fetched automatically during tests or previews. Tests run with synthetic destinations, mocked HTTP, and an isolated development backend when true integration is needed.
24. Desktop, 320/390-pixel mobile, light/dark, keyboard, and browser regression suites pass; printed QR PNG/SVG decoding remains valid.

## 14. Build sequence and release deliverables

1. **API adapter and configuration:** update server root, capabilities/POST adapter, error mapping, and CSP while preserving local Long generation.
2. **Single Short and QR flow:** implement explicit confirmation, idempotency, stale-state safeguards, and server-issued QR URLs.
3. **Many links:** sequential queue, progress, stop/retry, row statuses, copy/CSV, and quota handling.
4. **Stats:** current QR API route migration, short aggregate and known-code reports, charts, CSV, and shareable views.
5. **Security/documentation/testing:** policy docs, code linting/static tests, mocked network tests, visual accessibility, export decoding, and optional isolated server integration.

Deliver a Git patch and update ZIP against the **newly supplied fresh Marin Links source archive**, plus an installable complete ZIP, updated docs/changelog, and an evidence-based test report. Report the actual baseline and chosen resulting VERSION; do not blindly apply the old v0.2.0 patch. Do not change Marin Links Server or deploy either app unless a confirmed frontend compatibility gap requires a separately identified server change. Do not claim an HTTP/database integration or actual production creation succeeded unless it was executed and verified.

**Status: FINAL — requirements complete; ready to implement.**


---

## 15. Backend contract verified against Marin Links Server v0.4.5

These are the **actual server-side code shapes** confirmed in the accompanying API reference archive. They are intended to reduce guesswork in a new chat. The backend is separate from the new frontend archive and should not be modified during this rebuild.

### 15.1 Capabilities, advisory only

`GET https://l.marinhhs.org/s/api/v1/capabilities` returns an envelope with at least:

```json
{
  "data": {
    "application": "Marin Links Server",
    "api_version": "v1",
    "short_url_base_url": "https://l.marinhhs.org/",
    "server_base_url": "https://l.marinhhs.org/s/",
    "creation": { "anonymous_enabled": true, "key_enabled": false },
    "alias": { "min_length": 1, "max_length": 48, "reserved": ["s"], "random_code_length": 10 }
  }
}
```

The values above are **illustrative**; `anonymous_enabled` reflects the running server's configuration, not the caller's authorization. If `public_base_url` is invalid, the canonical base may be `null`. Validate URLs before using them; fall back safely to the trusted configured base only as the contract allows. Capability GET is read-only and should never register a link or count a visit.

### 15.2 One POST, one registered link

```http
POST /s/api/v1/short-links HTTP/1.1
Content-Type: application/json
Accept: application/json
Idempotency-Key: 123e4567-e89b-42d3-a456-426614174000
```

The browser supplies `Origin` automatically; do **not** add it manually. For `Link` mode, a typical body is:

```json
{
  "destination": "https://hhs.marincounty.gov/?utm_campaign=outreach&via=link",
  "alias": null,
  "label": "",
  "channel": "other",
  "campaign": "outreach",
  "source_path": "/marin-links/"
}
```

The server accepts `destination`, `alias`, `label`, `channel`, `campaign`, and `source_path` only. More fields are rejected. Metadata may be empty but is limited to 256 bytes and server-side safety rules; destination max is 4096 bytes and JSON body max is 8192 bytes by default. The frontend must not assume server configuration or quota limits are fixed.

Success is `201` (created) or `200` (same request/key replay):

```json
{
  "data": {
    "id": "93b41f69a20947c69837fc96c79db8af",
    "code": "7km9p2txqa",
    "short_url": "https://l.marinhhs.org/7km9p2txqa",
    "status": "active",
    "revision": 1,
    "created_at": "2026-10-27T18:00:00Z"
  }
}
```

Error envelope:

```json
{ "error": { "code": "source_not_allowed", "message": "Browser origin not permitted." } }
```

Useful server error codes include `creation_disabled`, `source_not_allowed`, `destination_not_allowed`, `invalid_fields`, `invalid_alias`, `alias_not_permitted`, `invalid_channel`, `invalid_metadata`, `sensitive_metadata`, `invalid_idempotency_key`, `idempotency_conflict`, `alias_taken`, `reserved_alias`, `quota_exceeded`, `rate_limit_exceeded`, `unavailable`, and `unauthorized`. Map codes/statuses to plain-language, safe, user-actionable messages and do not render raw server strings as HTML.

The backend's canonical alias syntax is lowercase ASCII alphanumeric segments separated by **single internal hyphens** (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), 1–48 characters, with `s` reserved. Browser validation of both the returned `code` and a user-entered known code must reject empty segments, trailing hyphens, encoded slashes, extra path segments, query strings, fragments, credentials, and untrusted hosts. The frontend may lowercase a standalone manually entered code for lookup, but must not rewrite a valid returned `short_url` for copy/QR.

**Never call `GET /{code}` to validate a newly created URL**; that is the tracked redirect and would fabricate a visit.

### 15.3 Public short-link reporting shapes

| Method / route | Meaning |
| --- | --- |
| `GET /s/api/v1/short-links/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&traffic=all` | Global period totals, daily trend, and current active-code count |
| `GET /s/api/v1/short-links/{code}/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&traffic=all` | Public per-*known-code* aggregates subject to suppression |

`traffic` accepts `all`, `non_bot`, and `automated` (default `all`); dates are UTC and must form a valid range of at most 366 days ending no later than today. The default server period is the last 30 days.

Global summary `data` contains `visits`, `active_short_links`, `estimated_daily_unique_ips`, `daily` (`[{"date":"YYYY-MM-DD","visits":N}]`), `from`, `to`, `traffic`, `note`.

Per-code `data` contains `code`, `status`, `visits`, `estimated_daily_unique_ips`, `daily`, `browsers`, `countries`, `cities`, `from`, `to`, `traffic`, `note`. Geographic rows are approximate and small groups are suppressed. `estimated_daily_unique_ips` is `null` when traffic filtering precludes that estimate. For low-visit codes the server returns `{ "data": null, "meta": { "suppressed": true, "minimum_count": N } }`. Unknown, disabled, or retired codes return `404` from public per-code stats. No public endpoint lists all existing codes, and no public response should expose the destination or link management details.

Original tracked-link reports use **different endpoints** under `GET /s/api/v1/summary`, `/daily`, `/links`, `/parameters`, `/parameters/values`, and `/agents` (plus existing supported variants). Keep the Stats report types separate and do not mix request counts or infer QR scans from visits.

### 15.4 Server files in the attached reference bundle

The companion `marin-links-server-short-api-reference-v0.4.5.zip` contains the unmodified v0.4.5 server files needed to verify protocol, policy, reporting, and routing, plus a reference README. It intentionally excludes production `config.local.php`, database files, API keys, and logs. For frontend development, the primary contract documents are `docs/openapi.yaml`, `app/ShortHttp.php`, `app/ShortLinks.php`, `app/ShortReports.php`, and `app/SourcePolicy.php`. The package also includes `app/ClientIpPolicy.php`, `app/Destination.php`, `app/Config.php`, `index.php`, `config.local.example.php`, and selected server tests.

## 16. Rebuild implementation notes from the shipped historical frontend

The original v0.2.0 implementation split network protocol from UI state:

- `assets/tracker-config.js`: configurable `serverRoot`, `sourcePath`, and derived endpoints.
- `assets/short-links-api.js`: capabilities fetch, strict canonical URL validation, creation POST/error mapping, cryptographic request-key generation, and safe retry model.
- `assets/app.js`: explicit single/QR/bulk creation state. Its historically successful pattern was to freeze a payload snapshot and associate one idempotency key with it; a completed result became stale when the current input differed.
- `assets/stats.js`: tracked vs Short URLs reporting, date selectors, optional known-code lookup, charts/tables/CSV, and shareable report URLs.
- `index.html` / `assets/app.css`: creation action, busy and error status, previous result, batch progress, and report selector.
- `security.json` / `scripts/sync-security-meta.py`, tests and Markdown docs: allowlisted `connect-src`, updated network disclosure and offline browser tests.

These are **reference responsibilities, not required filenames** if the fresh archive uses a different structure. Keep the MarinOS App Shell vendor assets, mobile/light/dark styles, accessibility, current local QR library and tests in the supplied fresh archive. Do not introduce an npm/Composer build step merely for API integration.

**Historical issue worth avoiding:** `anonymous_enabled: false` was previously displayed as “Anonymous short links are disabled on the server.” That can be misleading when `public_enabled=true` but `allowed_sources=[]`. Use a more precise neutral message and let the actual POST status/error determine whether this browser and user network are authorized.

**Important test constraints:** Tests should mock all API calls or use isolated, explicit fixtures; do not issue real `/{code}` redirect requests to `l.marinhhs.org` merely to validate links because those requests count as visits. Validate QR PNG and SVG by decoding **the exported artifacts**, not only checking canvas metadata.

## 17. Inputs and completion criteria for the separate chat

**Required inputs:**

1. Fresh complete Marin Links frontend source ZIP (the desired new baseline, including its tests, `VERSION`, application shell, assets, and security metadata).
2. This `SPEC-MARIN-LINKS-SHORT-API-REBUILD-v1.1.md` file.
3. `marin-links-server-short-api-reference-v0.4.5.zip` (or a source ZIP of the exact server revision deployed if it has since changed).

**Not required or appropriate to share:** production `config.local.php`, private API keys, HMAC secret, SQLite database, access logs, or real user destination lists.

**Suggested instruction to paste into the new chat:**

> Implement the attached Marin Links short-link rebuild SPEC against my fresh frontend source. Treat that fresh ZIP as authoritative for existing app features and release numbering. Use the supplied Marin Links Server v0.4.5 reference files as the API contract. Keep `https://l.marinhhs.org/` configurable, support explicit anonymous Short creation for Link/QR/Many links, safe idempotent retries, sequential batch progress and partial successes, and separate global/per-code Short URLs Stats. Preserve Long `/?d=` tracking, local QR PNG/SVG, existing tracking parameters, accessibility, MarinOS shell, and GitHub Pages deployment. Update CSP/docs/tests, run offline mocked integration and QR-decode tests, then deliver a verified Git patch against my fresh ZIP, update ZIP, full ZIP, and test report. Do not modify/deploy the backend or create links on the live server.

**Release gate:** demonstrate no automatic short-link POST from previews or page loading; exact POST JSON/headers and 200/201 handling; stale-state prevention; batch sequencing and rate-limit stopping; suppression-safe public Stats; decoded PNG and SVG; CSP and privacy disclosures; unit/browser regressions; and successful patch/ZIP replay from the **fresh** baseline. Disclose any unexecuted server integration checks accurately.
