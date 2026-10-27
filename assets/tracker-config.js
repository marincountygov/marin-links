/*
 * Marin Links tracker settings.
 * Every link and QR code goes through the tracker so its visits can be counted.
 * The Stats tab reads the tracker's public, read-only API.
 */

(() => {
  "use strict";

  window.MarinLinksTracker = Object.freeze({
    endpoint: "https://misc.marinhhs.org/marin-qr-tracker/",
    // Short links use the redirect address. For now it is the same as endpoint.
    redirect: "https://misc.marinhhs.org/marin-qr-tracker/",
    apiBase: "https://misc.marinhhs.org/marin-qr-tracker/api/v1/"
  });
})();
