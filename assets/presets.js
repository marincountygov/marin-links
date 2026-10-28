/*
 * Marin Links preset lists.
 * Logos are read from the Brand Center's brand list (brands.json), in A to Z order. The list below is
 * only a backup, used if the Brand Center list cannot be loaded.
 * Agencies and their divisions come from assets/agencies.js, which is generated from the master list in
 * data/agencies.json. A division is picked as "agency/division".
 * Channels, sources, languages, and campaigns come from assets/tracking-options.js, which is generated from
 * data/tracking-options.json. A link carries only the code of a chosen item, never its name.
 * Optional fields on a campaign: channel (a Channel code) and agency (an agency code).
 */

(() => {
  "use strict";

  // The County list of agencies and departments, generated from data/agencies.json (see assets/agencies.js).
  const AGENCIES = window.MarinAgencyList || [];
  const OPTIONS = window.MarinTrackingOptions || { channels: [], sources: [], languages: [], campaigns: [], contents: [] };
  const CAMPAIGNS = OPTIONS.campaigns;

  // Turns a value found in a link or in Stats (a code or an older value) into its name.
  // Anything not in a list comes back as it was typed.
  function lookup(parameter, value) {
    const lists = {
      utm_medium: OPTIONS.channels,
      utm_source: OPTIONS.sources,
      lang: OPTIONS.languages,
      utm_campaign: OPTIONS.campaigns
    };
    if (lists[parameter]) {
      const found = lists[parameter].find((item) => item.value === value || item.legacy.includes(value));
      return found ? { code: found.value, name: found.name } : null;
    }
    if (parameter === "agency") {
      const found = AGENCIES.find((item) => item.value === value || item.id === value);
      return found ? { code: found.value, name: found.name } : null;
    }
    if (parameter === "division") {
      for (const agency of AGENCIES) {
        const found = (agency.divisions || []).find((item) => item.value === value || item.id === value);
        if (found) return { code: found.value, name: found.name };
      }
    }
    return null;
  }
  const labelFor = (parameter, value) => lookup(parameter, value)?.name || value;
  const codeFor = (parameter, value) => lookup(parameter, value)?.code || value;

  const BRAND_CENTER = "https://marincountygov.github.io/marin-brand/";
  const BRAND_LIST = `${BRAND_CENTER}brands.json`;
  const LIST_TIMEOUT_MS = 5000;
  const logoFile = (slug) => `${BRAND_CENTER}brands/${slug}/assets/qr-code-logos/square.png`;
  const LOGOS = [
    { value: "county-of-marin", name: "County of Marin", file: logoFile("county-of-marin") },
    { value: "engage-marin", name: "Engage Marin", file: logoFile("engage-marin") },
    { value: "fixitmarin", name: "FixItMarin", file: logoFile("fixitmarin") },
    { value: "holiday-light-spectacular", name: "Holiday Light Spectacular", file: logoFile("holiday-light-spectacular") },
    { value: "weather-together", name: "Weather Together", file: logoFile("weather-together") }
  ];

  // Asks the Brand Center which brands have a QR code logo. Any problem returns the backup list.
  async function loadLogos() {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), LIST_TIMEOUT_MS);
    try {
      const response = await fetch(BRAND_LIST, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`The Brand Center answered ${response.status}.`);
      const data = await response.json();
      const list = (Array.isArray(data.brands) ? data.brands : [])
        .filter((brand) => typeof brand.slug === "string" && typeof brand.name === "string" && typeof brand.qrCodeLogo === "string")
        .map((brand) => ({ value: brand.slug, name: brand.name, file: new URL(brand.qrCodeLogo, BRAND_CENTER).href }))
        // Only logo files from the Brand Center are used.
        .filter((brand) => brand.file.startsWith(`${BRAND_CENTER}brands/`))
        .sort((a, b) => a.name.localeCompare(b.name));
      return list.length ? list : LOGOS;
    } catch (error) {
      return LOGOS;
    } finally {
      window.clearTimeout(timer);
    }
  }

  window.MarinLinksPresets = Object.freeze({
    loadLogos,
    labelFor,
    codeFor,
    channels: OPTIONS.channels,
    sources: OPTIONS.sources,
    languages: OPTIONS.languages,
    contents: OPTIONS.contents || [],
    logos: Object.freeze(LOGOS.map((entry) => Object.freeze(entry))),
    agencies: Object.freeze(AGENCIES.map((entry) => Object.freeze(entry))),
    campaigns: Object.freeze(CAMPAIGNS.map((entry) => Object.freeze(entry)))
  });
})();
