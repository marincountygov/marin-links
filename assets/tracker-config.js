/*
 * Marin Links Server connection settings. The two values below come from the
 * links-server entry in marin.yml; change them there, then run
 * python3 scripts/server_settings.py --write. Do not edit them here. The
 * County server remains authoritative for short-link creation, destination
 * rules, and returned short URLs.
 */
(() => {
  "use strict";

  const serverRoot = "https://l.marinhhs.org/";
  const sourcePath = "/marin-links/";

  function trustedDirectoryUrl(value) {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.search
      || url.hash
      || !url.pathname.endsWith("/")
      || url.pathname.includes("//")
      || /%2f|%5c/i.test(url.pathname)
    ) {
      throw new Error("Marin Links Server root must be an HTTPS directory URL ending in /.");
    }
    return url;
  }

  function applicationPath(value) {
    if (
      typeof value !== "string"
      || !/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*\/$/.test(value)
      || value.includes("//")
      || /%2f|%5c/i.test(value)
    ) {
      throw new Error("Marin Links sourcePath must be one absolute application directory path.");
    }
    const parsed = new URL(value, "https://app.invalid/");
    if (parsed.pathname !== value || parsed.search || parsed.hash) {
      throw new Error("Marin Links sourcePath is not a safe application path.");
    }
    return value;
  }

  const root = trustedDirectoryUrl(serverRoot);
  const appPath = applicationPath(sourcePath);
  const apiBase = new URL("s/api/v1/", root);

  window.MarinLinksTracker = Object.freeze({
    serverRoot: root.href,
    sourcePath: appPath,
    endpoint: root.href,
    apiBase: apiBase.href,
    capabilitiesEndpoint: new URL("capabilities", apiBase).href,
    createEndpoint: new URL("short-links", apiBase).href,
    shortSummaryEndpoint: new URL("short-links/summary", apiBase).href
  });
})();
