/*
 * Marin Links preset lists.
 * Logos are read from the Brand Center's brand list (brands.json), in A to Z order. The list below is
 * only a backup, used if the Brand Center list cannot be loaded.
 * Agencies come from the Departments group in marin-mentions' config/monitors.yaml.
 * Campaigns are chosen by the web team. To add one, add a line to CAMPAIGNS in a pull request.
 * Optional fields on a campaign: channel (a Channel option value) and agency (an agency value).
 */

(() => {
  "use strict";

  const AGENCIES = [
    { value: "ag-weights-measures", name: "Marin County Agriculture, Weights and Measures" },
    { value: "assessor", name: "Marin County Assessor-Recorder-County Clerk" },
    { value: "child-support", name: "Marin County Child Support Services" },
    { value: "cda", name: "Marin County Community Development Agency" },
    { value: "county-counsel", name: "Marin County Counsel" },
    { value: "csa-29", name: "County Service Area 29" },
    { value: "csa-6", name: "County Service Area 6" },
    { value: "cultural-services", name: "Marin County Cultural Services" },
    { value: "da", name: "Marin County District Attorney" },
    { value: "elections", name: "Marin County Elections" },
    { value: "retirement", name: "Marin County Employees' Retirement Association" },
    { value: "county-executive", name: "Marin County Executive" },
    { value: "finance", name: "Marin County Finance" },
    { value: "fire", name: "Marin County Fire Department" },
    { value: "library", name: "Marin County Free Library" },
    { value: "gnoss-field-airport", name: "Gnoss Field Airport" },
    { value: "hhs", name: "Marin County Health and Human Services" },
    { value: "hr", name: "Marin County Human Resources" },
    { value: "ist", name: "Marin County Information Services and Technology" },
    { value: "oem", name: "Marin Office of Emergency Management" },
    { value: "parks", name: "Marin County Parks" },
    { value: "probation", name: "Marin County Probation" },
    { value: "public-defender", name: "Marin County Public Defender" },
    { value: "public-works", name: "Marin County Public Works" },
    { value: "sheriff", name: "Marin County Sheriff" },
    { value: "tax-collector", name: "Marin County Tax Collector" },
    { value: "transit", name: "Marin Transit" },
    { value: "uc-extension", name: "Marin UC Cooperative Extension" },
    { value: "zero-waste-marin", name: "Zero Waste Marin" }
  ];
  const CAMPAIGNS = [
    { value: "envision_marin", name: "Envision Marin" },
    { value: "weather_together", name: "Weather Together" }
  ];

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
    logos: Object.freeze(LOGOS.map((entry) => Object.freeze(entry))),
    agencies: Object.freeze(AGENCIES.map((entry) => Object.freeze(entry))),
    campaigns: Object.freeze(CAMPAIGNS.map((entry) => Object.freeze(entry)))
  });
})();
