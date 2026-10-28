# Marin Links v0.2.0 — Current specification

**Status:** Implemented frontend rebuild (alpha).

The authoritative Short-link requirements are in [docs/SPEC-SHORT-API-REBUILD-v1.1.md](docs/SPEC-SHORT-API-REBUILD-v1.1.md). They define the frontend contract verified against Marin Links Server v0.4.5, explicit Short creation, retry safety, sequential Add many web addresses behavior, separate Short URL reports, privacy, accessibility, and release tests.

The [v0.1.0 specification](docs/SPEC-v0.1.0.md) records the guaranteed current baseline that this release preserves, including the Link/QR choice, Add many web addresses checkbox, Source and Content fields, and optional address printed below QR exports.

Marin Links remains a static GitHub Pages app. Long links use the configured server root with `/?d=` and require no creation request. Short links are created only after an explicit user action, using an anonymous JSON request with no client key. The app accepts only a confirmed server-issued Short URL. QR PNG and SVG files remain browser-local. Add many web addresses sends at most one creation request at a time and preserves partial results. Overall Short URL totals and one-known-code reports remain separate from Long-link reports. No client-side credentials, cookies, or persistent creation state are permitted.
