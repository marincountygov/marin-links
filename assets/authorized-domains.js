/*
 * Marin Links destination allowlist.
 *
 * Each entry allows the exact domain. Set allowSubdomains to true only when
 * sites below that domain are also approved.
 */
window.MarinQrAuthorizedDomains = Object.freeze([
  Object.freeze({ domain: "marincounty.gov", allowSubdomains: true }),
  Object.freeze({ domain: "marinhhs.org", allowSubdomains: true }),
  Object.freeze({ domain: "marincountygov.github.io", allowSubdomains: false }),
  Object.freeze({ domain: "marinmap.org", allowSubdomains: true }),
  Object.freeze({ domain: "marinfair.org", allowSubdomains: true }),
  Object.freeze({ domain: "marincultural.org", allowSubdomains: true })
]);
