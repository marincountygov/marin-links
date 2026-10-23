/*
 * Marin Links preset lists.
 * Logos are read from the Brand Center's brand list (brands.json), in A to Z order. The list below is
 * only a backup, used if the Brand Center list cannot be loaded.
 * Agencies and their divisions come from the County's list of agencies and departments
 * (marin-county-agencies-departments.json), in the same order. A division is picked as "agency/division".
 * Campaigns are chosen by the web team. To add one, add a line to CAMPAIGNS in a pull request.
 * Optional fields on a campaign: channel (a Channel option value) and agency (an agency value).
 */

(() => {
  "use strict";

  const AGENCIES = [
    { value: "awm", name: "Agriculture, Weights and Measures", divisions: [{ value: "agriculture", name: "Agriculture" }, { value: "weights-and-measures", name: "Weights and Measures" }] },
    { value: "arcc", name: "Assessor, Recorder, County Clerk" },
    { value: "board", name: "Board of Supervisors" },
    { value: "css", name: "Child Support Services" },
    { value: "grand-jury", name: "Civil Grand Jury" },
    { value: "cda", name: "Community Development Agency", divisions: [{ value: "building-and-safety", name: "Building and Safety" }, { value: "environmental-health-services", name: "Environmental Health Services" }, { value: "planning", name: "Planning" }, { value: "housing-and-grants", name: "Housing and Grants Division" }] },
    { value: "county-counsel", name: "County Counsel" },
    { value: "county-executive", name: "Office of the County Executive" },
    { value: "cultural-services", name: "Cultural Services" },
    { value: "da", name: "District Attorney" },
    { value: "elections", name: "Elections (Registrar of Voters)" },
    { value: "finance", name: "Department of Finance" },
    { value: "fire", name: "Fire Department" },
    { value: "hhs", name: "Health and Human Services", divisions: [{ value: "general-administration", name: "General Administration" }, { value: "bhrs", name: "Behavioral Health and Recovery Services" }, { value: "homelessness-and-coordinated-care", name: "Homelessness and Coordinated Care" }, { value: "public-health", name: "Public Health" }, { value: "social-services", name: "Social Services" }] },
    { value: "hr", name: "Human Resources", divisions: [{ value: "classification-compensation", name: "Classification and Compensation" }, { value: "employee-benefits-wellness", name: "Employee Benefits and Wellness" }, { value: "employee-and-labor-relations", name: "Employee and Labor Relations" }, { value: "equal-opportunity", name: "Equal Opportunity" }, { value: "internships-and-volunteers", name: "Internships and Volunteers" }, { value: "learning-and-organizational-development", name: "Learning and Organizational Development" }, { value: "leaves", name: "Leaves" }, { value: "recruitment", name: "Recruitment" }, { value: "risk-management", name: "Risk Management" }] },
    { value: "ist", name: "Information Services and Technology" },
    { value: "library", name: "Marin County Free Library" },
    { value: "parks", name: "Parks" },
    { value: "probation", name: "Probation" },
    { value: "public-defender", name: "Public Defender" },
    { value: "public-works", name: "Public Works" },
    { value: "retirement", name: "Retirement" },
    { value: "sheriff", name: "Sheriff" },
    { value: "tax-collector", name: "Tax Collector" },
    { value: "uc-extension", name: "UC Cooperative Extension (Farm Advisor)" }
  ];  const CAMPAIGNS = [
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
