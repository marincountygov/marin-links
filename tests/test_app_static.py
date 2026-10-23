#!/usr/bin/env python3
"""Read-only checks for Marin Links's app-owned policy and static architecture."""
from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class SourceParser(HTMLParser):
    def __init__(self, source: str) -> None:
        super().__init__()
        self.scripts: list[str] = []
        self.styles: list[str] = []
        self.labels_for: set[str] = set()
        self.inputs: dict[str, dict[str, str | None]] = {}
        self.elements: dict[str, dict[str, str | None]] = {}
        self.feed(source)

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.elements[values["id"]] = values
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"])
        if tag == "link" and values.get("rel") == "stylesheet":
            self.styles.append(values["href"])
        if tag == "label" and values.get("for"):
            self.labels_for.add(values["for"])
        if tag == "input" and values.get("id"):
            self.inputs[values["id"]] = values


class MarinQrStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.app_js = (ROOT / "assets/app.js").read_text(encoding="utf-8")
        self.image_js = (ROOT / "assets/qr-image.js").read_text(encoding="utf-8")
        self.safety_js = (ROOT / "assets/qr-safety.js").read_text(encoding="utf-8")
        self.domains_js = (ROOT / "assets/authorized-domains.js").read_text(encoding="utf-8")
        self.stats_js = (ROOT / "assets/stats.js").read_text(encoding="utf-8")
        self.tracker_js = (ROOT / "assets/tracker-config.js").read_text(encoding="utf-8")

    def test_authorized_domain_policy_is_exact(self) -> None:
        entries = re.findall(
            r'domain:\s*"([a-z0-9.-]+)",\s*allowSubdomains:\s*(true|false)',
            self.domains_js,
        )
        self.assertEqual(entries, [
            ("marincounty.gov", "true"),
            ("marinhhs.org", "true"),
            ("marincountygov.github.io", "false"),
            ("marinmap.org", "true"),
        ])
        self.assertNotRegex(self.domains_js, r'domain:\s*["\']\*')

    def test_optional_public_https_mode_is_documented(self) -> None:
        parser = SourceParser(self.html)
        self.assertIn("destination-mode", parser.elements)
        self.assertIn("hidden", parser.elements["destination-mode"])
        self.assertEqual(parser.elements["destination-mode"].get("role"), "status")
        self.assertIn("allowed-websites-help", parser.elements)
        self.assertIn("Any HTTPS link", self.html)
        self.assertIn("https://marincountygov.github.io/marin-links/?dest=any", self.html)
        self.assertIn('parameters.getAll("dest")', self.app_js)
        self.assertIn('overrides.length === 1 && overrides[0] === "any"', self.app_js)
        self.assertIn('(!allowAnyHttpsDestination && !isAllowedHostname(hostname))', self.app_js)
        self.assertIn('refs.destinationMode.hidden = !allowAnyHttpsDestination', self.app_js)
        self.assertIn('refs.allowedWebsitesHelp.hidden = allowAnyHttpsDestination', self.app_js)

    def test_app_has_no_network_or_persistent_storage_api(self) -> None:
        app_sources = "\n".join((self.app_js, self.image_js, self.safety_js))
        for name in (
            "fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon",
            "localStorage", "sessionStorage", "indexedDB", "document.cookie",
        ):
            self.assertNotIn(name, app_sources)
        self.assertNotRegex(self.domains_js, r"https?://")

    def test_runtime_scripts_are_local_and_ordered(self) -> None:
        parser = SourceParser(self.html)
        self.assertEqual(parser.scripts, [
            "vendor/marinos/marinos.js",
            "vendor/chart.min.js",
            "vendor/qrcode/qrcode.js",
            "assets/tracker-config.js",
            "assets/presets.js",
            "assets/authorized-domains.js",
            "assets/qr-image.js",
            "assets/qr-safety.js",
            "assets/app.js",
            "assets/stats.js",
        ])
        self.assertEqual(parser.styles, [
            "vendor/marinos/marinos.css",
            "assets/app.css",
        ])
        self.assertTrue(all("://" not in value for value in parser.scripts + parser.styles))

    def test_static_form_controls_are_labeled(self) -> None:
        parser = SourceParser(self.html)
        for control_id in (
            "destination-url",
            "qr-color-text",
            "background-white",
            "background-transparent",
            "logo-choice",
        ):
            self.assertIn(control_id, parser.labels_for)
        self.assertEqual(parser.inputs["qr-color"].get("aria-label"), "Choose QR code color")

    def test_color_picker_is_hidden_but_implementation_remains(self) -> None:
        parser = SourceParser(self.html)
        self.assertIn("hidden", parser.elements["qr-color-field"])
        self.assertIn("qrColorPicker: false", self.app_js)
        self.assertIn("validateColor", self.app_js)
        self.assertIn('refs.color.addEventListener("input"', self.app_js)
        self.assertIn('refs.colorText.addEventListener("input"', self.app_js)

    def test_transparent_background_and_svg_export_are_present(self) -> None:
        parser = SourceParser(self.html)
        white = parser.inputs["background-white"]
        transparent = parser.inputs["background-transparent"]
        self.assertEqual(white.get("type"), "radio")
        self.assertIn("checked", white)
        self.assertEqual(transparent.get("type"), "radio")
        self.assertNotIn("checked", transparent)
        self.assertIn('aria-labelledby="background-heading"', self.html)
        self.assertIn(">Background</span>", self.html)
        self.assertNotIn('id="background-image"', self.html)
        self.assertIn("Use transparent only on a light, plain background.", self.html)
        self.assertIn('id="download-format"', self.html)
        self.assertIn('<option value="svg">SVG</option>', self.html)
        self.assertIn('id="download"', self.html)
        self.assertIn('input[name="background"]', self.app_js)
        self.assertIn('new Blob([svg], { type: "image/svg+xml;charset=utf-8" })', self.app_js)
        self.assertIn('saveBlob(svgToBlob(), "marin-links.svg")', self.app_js)
        self.assertIn("PRINT_DPI", self.app_js)
        self.assertIn('id="download-size"', self.html)
        self.assertIn("Print this code at least", self.app_js)
        self.assertIn("function toSvg(", self.safety_js)
        self.assertIn('data-background="${transparentBackground ? "transparent" : "white"}"',
                      self.safety_js)
        self.assertIn("const SVG_EMBEDDED_IMAGE_MAX_SIDE = 1600", self.safety_js)
        self.assertIn("transparentBackground", self.safety_js)

    def test_approved_text_changes_are_present(self) -> None:
        self.assertIn(
            'app-description="Make a link or QR code for an approved Marin County website."',
            self.html,
        )
        self.assertIn('<h3 id="look-heading">Design</h3>', self.html)
        self.assertIn('<label for="logo-choice">Logo</label>', self.html)
        self.assertIn("Pick a Marin logo.", self.html)
        self.assertIn("logoUpload: false", self.app_js)
        self.assertNotIn("See an example", self.html)
        self.assertNotIn("Ask your web team which names and values to use.", self.html)
        self.assertNotIn("Make a QR code for an approved Marin County link.", self.html)
        self.assertNotIn(
            "Paste the full link. It must use an approved Marin County website.",
            self.html,
        )
        self.assertNotIn('id="destination-help"', self.html)
        self.assertNotIn("Center image <span", self.html)
        self.assertNotIn("The app keeps its shape and fits it inside the code.", self.html)

    def test_parameter_selector_is_curated_searchable_and_customizable(self) -> None:
        options = re.findall(
            r'\{ value: "([a-z_]+)", title: "([^"]+)"',
            self.app_js,
        )
        self.assertEqual(options, [
            ("utm_source", "Where people see the link"),
            ("utm_medium", "How the link is shared"),
            ("utm_campaign", "Campaign or project name"),
            ("utm_content", "Which version of the link"),
            ("utm_term", "Audience or keyword"),
            ("ref", "Who sent people here"),
            ("source", "Where the visit came from"),
            ("campaign", "Campaign name"),
            ("event", "Event name"),
            ("location", "Place or site"),
            ("lang", "Language"),
            ("category", "Type of content"),
            ("topic", "Topic"),
            ("id", "Record number"),
            ("form", "Form name"),
            ("program", "Program name"),
        ])
        self.assertIn('title: "Something else", hint: "Type your own name"', self.app_js)
        # The plain-language title leads; the technical name sits below it.
        self.assertIn("optionName.textContent = option.title;", self.app_js)
        self.assertIn("optionDescription.textContent = option.hint || option.value;", self.app_js)
        self.assertIn('const DEFAULT_PARAMETER_NAME = "utm_source"', self.app_js)
        self.assertIn('utm_source: "flyer"', self.app_js)
        self.assertIn('search.setAttribute("role", "combobox")', self.app_js)
        self.assertIn('listbox.setAttribute("role", "listbox")', self.app_js)
        self.assertIn('search.placeholder = "Type to filter"', self.app_js)
        self.assertIn('makeLabel("Your own name", customInput)', self.app_js)
        self.assertIn("Use each tracking detail name only once.", self.app_js)
        self.assertNotIn('nameInput.type = "text"', self.app_js)

    def test_create_and_stats_tabs_and_output_choice(self) -> None:
        parser = SourceParser(self.html)
        for element_id in (
            "tab-create", "tab-stats", "panel-create", "panel-stats",
            "output-link", "output-qr", "design-section",
            "stats-period", "stats-link", "stats-parameter",
        ):
            self.assertIn(element_id, parser.elements)
        self.assertIn("hidden", parser.elements["design-section"])
        self.assertIn("hidden", parser.elements["panel-stats"])
        self.assertIn("refs.designSection.hidden = !qr;", self.app_js)
        self.assertIn("backgroundOption: false", self.app_js)

    def test_links_go_through_the_tracker_and_stats_are_read_only(self) -> None:
        self.assertIn("https://misc.marinhhs.org/marin-qr-tracker/", self.tracker_js)
        self.assertIn("encodeURIComponent(destinationHref)", self.app_js)
        for name in ("localStorage", "sessionStorage", "indexedDB", "document.cookie", "sendBeacon", "WebSocket"):
            self.assertNotIn(name, self.stats_js)
        # Only GET requests to the tracker API; the app never calls the redirect.
        self.assertEqual(self.stats_js.count("fetch("), 1)
        self.assertNotIn('method:', self.stats_js)
        self.assertIn("window.MarinLinksTracker.apiBase", self.stats_js)
        self.assertIn("Too few visits to show.", self.stats_js)
        security = (ROOT / "security.json").read_text(encoding="utf-8")
        self.assertIn("https://misc.marinhhs.org/marin-qr-tracker/api/v1/", security)

    def test_tracking_has_channel_campaign_and_value_dropdowns(self) -> None:
        parser = SourceParser(self.html)
        self.assertIn("tracking-channel", parser.elements)
        self.assertIn("tracking-campaign", parser.elements)
        self.assertIn("tracking-channel", parser.labels_for)
        self.assertIn("tracking-campaign", parser.labels_for)
        self.assertIn('<h3 id="tracking-heading">Tracking <span', self.html)
        self.assertIn('{ name: "utm_medium", value: channel }', self.app_js)
        self.assertIn('{ name: "utm_campaign", value: campaign }', self.app_js)
        self.assertIn('{ name: "agency", value: agency }', self.app_js)
        self.assertIn("tracking-agency", parser.elements)
        self.assertIn("tracking-campaign-choice", parser.elements)
        presets = (ROOT / "assets/presets.js").read_text(encoding="utf-8")
        self.assertIn('{ value: "envision_marin", name: "Envision Marin" }', presets)
        self.assertIn('{ value: "weather_together", name: "Weather Together" }', presets)
        self.assertIn('{ value: "hhs", name: "Health and Human Services", divisions: [', presets)
        self.assertIn('{ value: "public-health", name: "Public Health" }', presets)
        self.assertIn('{ value: "arcc", name: "Assessor, Recorder, County Clerk" }', presets)
        self.assertIn('{ name: "division", value: division }', self.app_js)
        self.assertIn('filter_param: "agency"', self.stats_js)
        self.assertIn("reset-form", parser.elements)
        self.assertIn('refs.resetForm.addEventListener("click", resetForm)', self.app_js)
        self.assertIn("const VALUE_OPTIONS = Object.freeze({", self.app_js)
        self.assertIn('new Option("Something else", OTHER_VALUE)', self.app_js)

    def test_logo_dropdown_lists_marin_logos_a_to_z_and_upload_button(self) -> None:
        parser = SourceParser(self.html)
        for element_id in ("logo-choice", "upload-logo", "center-image", "logo-upload-field"):
            self.assertIn(element_id, parser.elements)
        self.assertIn("hidden", parser.elements["logo-upload-field"])
        self.assertEqual(parser.elements["upload-logo"].get("data-icon"), "upload")
        self.assertIn(">Upload logo</button>", self.html)
        presets = (ROOT / "assets/presets.js").read_text(encoding="utf-8")
        for slug in (
            "county-of-marin", "engage-marin", "fixitmarin",
            "holiday-light-spectacular", "weather-together",
        ):
            self.assertIn(f'logoFile("{slug}")', presets)
        self.assertIn("https://marincountygov.github.io/marin-brand/", presets)
        self.assertFalse((ROOT / "assets/logos").exists())
        security = (ROOT / "security.json").read_text(encoding="utf-8")
        self.assertIn('"https://marincountygov.github.io/marin-brand/brands/"', security)
        self.assertIn('image.crossOrigin = "anonymous"', self.app_js)
        self.assertIn("a.name.localeCompare(b.name)", self.app_js)
        # The list comes from the Brand Center, with a backup list if it cannot be loaded.
        self.assertIn('const BRAND_LIST = `${BRAND_CENTER}brands.json`;', presets)
        self.assertIn("async function loadLogos()", presets)
        self.assertIn("return LOGOS;", presets)
        self.assertIn("brand.file.startsWith(`${BRAND_CENTER}brands/`)", presets)
        self.assertIn("void loadBrandLogos();", self.app_js)
        security = (ROOT / "security.json").read_text(encoding="utf-8")
        self.assertIn('"https://marincountygov.github.io/marin-brand/brands.json"', security)

    def test_via_label_send_date_print_size_bulk_and_stats_sharing(self) -> None:
        parser = SourceParser(self.html)
        for element_id in ("output-bulk", "bulk-urls", "bulk-copy", "bulk-csv", "tracking-date",
                           "download-size", "size-note", "stats-copy-link", "stats-csv", "stats-via-chart"):
            self.assertIn(element_id, parser.elements)
        self.assertIn('{ name: "via", value: isQrMode() ? "qr" : "link" }', self.app_js)
        self.assertIn("261023", self.html)
        self.assertIn('dateParameter.value = `${dateCode}_${value}`', self.app_js)
        self.assertIn("const MAX_BULK_LINES = 100;", self.app_js)
        self.assertIn("function csvCell(", self.app_js)
        self.assertIn("function csvCell(", self.stats_js)
        self.assertIn("DENSE_QR_VERSION", self.app_js)
        self.assertIn('getJson("parameters/values", { ...scoped, name: "via" })', self.stats_js)
        self.assertIn("function statsAddress()", self.stats_js)
        self.assertIn("/^[0-9a-f]{32}$/", self.stats_js)

    def test_reliability_and_image_limits_are_present(self) -> None:
        self.assertIn("const QUIET_ZONE_MODULES = 4", self.safety_js)
        self.assertIn("const MAX_BACKING_WIDTH_FRACTION = 0.30", self.safety_js)
        self.assertIn("const MAX_BACKING_AREA_FRACTION = 0.08", self.safety_js)
        self.assertIn("const SAFE_CORRECTION_FRACTION = 0.65", self.safety_js)
        self.assertIn("protectedModules", self.safety_js)
        self.assertIn("QRRSBlock.getRSBlocks", self.safety_js)
        self.assertIn("const MIN_CONTRAST_WITH_WHITE = 7", self.app_js)
        self.assertIn("QRErrorCorrectLevel.H", self.app_js)
        self.assertIn('"image/png", "image/jpeg", "image/webp"', self.app_js)
        self.assertNotIn('"image/svg+xml"', self.app_js)

    def test_image_preparation_preserves_shape_and_trims_transparency(self) -> None:
        self.assertIn("findVisibleBounds", self.image_js)
        self.assertIn("ALPHA_THRESHOLD", self.image_js)
        self.assertIn("sourceContext.getImageData", self.image_js)
        self.assertNotIn("Math.max(imageSize", self.image_js)

    def test_qr_license_and_privacy_metadata_are_present(self) -> None:
        self.assertIn("MIT License", (ROOT / "vendor/qrcode/LICENSE.txt").read_text(encoding="utf-8"))
        self.assertTrue((ROOT / "vendor/qrcode/SOURCE-PACKAGE-LICENSE.txt").is_file())
        security = json.loads((ROOT / "security.json").read_text(encoding="utf-8"))
        self.assertFalse(security["data"]["collectsUserData"])
        self.assertFalse(security["data"]["storesPersonalInformation"])
        self.assertEqual(security["csp"]["directives"]["script-src"], ["'self'"])

    def test_no_template_placeholders_remain_in_app_owned_files(self) -> None:
        files = [
            ROOT / "index.html", ROOT / "marin.yml", ROOT / "README.md",
            ROOT / "SECURITY.md", ROOT / "security.json", ROOT / "AGENTS.md",
        ]
        for path in files:
            self.assertNotRegex(path.read_text(encoding="utf-8"), r"APP_(?:NAME|DESCRIPTION|OWNER|REPO)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
