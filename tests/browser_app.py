#!/usr/bin/env python3
"""Exercise the Marin Links page in a real browser. The Brand Center and the tracker are test data."""
from __future__ import annotations

import argparse
import base64
from pathlib import Path
import re
import shutil
import sys
import json
import tempfile
from urllib.parse import parse_qs, quote, unquote, urlsplit
import xml.etree.ElementTree as ET

import cv2
import numpy as np
try:
    from pyzbar.pyzbar import decode as zbar_decode
except ImportError:  # OpenCV remains as a fallback.
    zbar_decode = None

from browser_smoke import (
    BRAND_CENTER_ROOT, BRAND_LIST, LINK_ID, ROOT, SERVER, TRACKER_API, configure, no_overflow, ready, require, serve,
)


def canvas_png(page) -> bytes:
    data_url = page.locator("#qr-canvas").evaluate("canvas => canvas.toDataURL('image/png')")
    prefix = "data:image/png;base64,"
    require(data_url.startswith(prefix), "Canvas did not return a PNG data URL")
    return base64.b64decode(data_url[len(prefix):])


def read_png(png: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(png, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    require(image is not None, "Generated PNG could not be opened")
    return image


def composite_on_white(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    if image.shape[2] == 3:
        return image
    require(image.shape[2] == 4, "Generated PNG has an unknown color format")
    foreground = image[:, :, :3].astype(np.float32)
    alpha = image[:, :, 3:4].astype(np.float32) / 255.0
    white = np.full_like(foreground, 255.0)
    return np.clip((foreground * alpha) + (white * (1.0 - alpha)), 0, 255).astype(np.uint8)


def corner_alpha(png: bytes) -> int:
    image = read_png(png)
    if image.ndim < 3 or image.shape[2] < 4:
        return 255
    return int(image[0, 0, 3])


def decode_qr(png: bytes) -> str:
    """Read a QR code with zbar when it is installed, else with OpenCV.

    OpenCV's detector is picky about small images and tight margins, and it differs between builds, so it gets a
    few tries: the image as is, with a wider white margin, and scaled up with hard edges.
    """
    image = composite_on_white(read_png(png))
    if zbar_decode is not None:
        decoded = zbar_decode(image)
        if decoded:
            return decoded[0].data.decode("utf-8")
    detectors = [cv2.QRCodeDetector()]
    if hasattr(cv2, "QRCodeDetectorAruco"):
        detectors.append(cv2.QRCodeDetectorAruco())
    for scale in (1, 2, 3):
        scaled = image if scale == 1 else cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
        for margin in (0, 40):
            candidate = scaled if not margin else cv2.copyMakeBorder(
                scaled, margin, margin, margin, margin, cv2.BORDER_CONSTANT, value=(255, 255, 255))
            for detector in detectors:
                value, points, _ = detector.detectAndDecode(candidate)
                if points is not None and value:
                    return value
    raise AssertionError("Generated PNG could not be decoded as a QR code")


def svg_to_png(page, svg: str, size: int = 1200) -> bytes:
    svg_url = "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")
    data_url = page.evaluate(
        """async ({url, size}) => {
          const image = new Image();
          image.decoding = 'async';
          await new Promise((resolve, reject) => {
            image.addEventListener('load', resolve, {once: true});
            image.addEventListener('error', () => reject(new Error('SVG preview could not load.')), {once: true});
            image.src = url;
          });
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, size, size);
          context.drawImage(image, 0, 0, size, size);
          return canvas.toDataURL('image/png');
        }""",
        {"url": svg_url, "size": size},
    )
    prefix = "data:image/png;base64,"
    require(data_url.startswith(prefix), "Rendered SVG did not return a PNG data URL")
    return base64.b64decode(data_url[len(prefix):])


def verify_svg(svg: str, expected_url: str, *, transparent: bool, has_logo: bool) -> None:
    root = ET.fromstring(svg)
    namespace = {"svg": "http://www.w3.org/2000/svg"}
    require(root.tag == "{http://www.w3.org/2000/svg}svg", "SVG root element differs")
    require(root.attrib.get("data-background") == ("transparent" if transparent else "white"),
            "SVG background metadata differs")
    description = root.find("svg:desc", namespace)
    require(description is not None and expected_url in (description.text or ""),
            "SVG does not name the final link")
    require(root.find(".//svg:script", namespace) is None, "SVG contains a script")
    background = root.find("svg:rect[@id='qr-background']", namespace)
    require((background is None) == transparent, "SVG background rectangle differs")
    center_image = root.find("svg:image[@id='center-image']", namespace)
    require((center_image is not None) == has_logo, "SVG center image state differs")
    logo_backing = root.find("svg:rect[@id='logo-backing']", namespace)
    require((logo_backing is not None) == has_logo, "SVG logo backing state differs")
    if logo_backing is not None:
        require(logo_backing.attrib.get("fill") == "#ffffff",
                "SVG center-image backing is not white")
    for image in root.findall(".//svg:image", namespace):
        href = image.attrib.get("href", "")
        require(href.startswith("data:image/png;base64,"), "SVG center image is not embedded")
    for element in root.iter():
        for attribute in ("href", "{http://www.w3.org/1999/xlink}href"):
            value = element.attrib.get(attribute, "")
            require(not value.startswith(("http://", "https://", "//")),
                    "SVG contains an external resource")



TRACKER_ROOT = SERVER["url"]
FORBIDDEN = "Use a link from an approved Marin County website."


def expected_link(destination: str, labels: list[tuple[str, str]]) -> str:
    """The tracker address for a destination with labels added to its query, before any fragment."""
    parts = urlsplit(destination)
    query = parts.query
    extra = "&".join(f"{name}={quote(value, safe='')}" for name, value in labels)
    query = f"{query}&{extra}" if query and extra else (query or extra)
    rebuilt = f"{parts.scheme}://{parts.netloc}{parts.path}" + (f"?{query}" if query else "")
    if parts.fragment:
        rebuilt += f"#{parts.fragment}"
    return f"{TRACKER_ROOT}?d={quote(rebuilt, safe='')}"


def destination_of(link: str) -> str:
    return unquote(link.split("?d=", 1)[1])


def final_link(page) -> str:
    page.wait_for_function("() => document.querySelector('#final-url')?.textContent")
    return page.locator("#final-url").text_content()


def wait_for_link(page, expected: str | None = None) -> str:
    page.wait_for_function(
        "expected => { const out = document.querySelector('#final-url'); "
        "return !document.querySelector('#preview-ready').hidden && out.textContent "
        "&& (expected === null || out.textContent === expected) "
        "&& !document.querySelector('#copy-link-primary').disabled; }",
        arg=expected,
    )
    return final_link(page)


def wait_for_qr(page, expected: str | None = None) -> str:
    page.wait_for_function(
        "expected => document.querySelector('#qr-canvas')?.dataset.qrReady === 'true' "
        "&& (expected === null || document.querySelector('#final-url')?.textContent === expected) "
        "&& !document.querySelector('#download')?.disabled",
        arg=expected,
    )
    return final_link(page)


def fill_link(page, value: str) -> None:
    page.locator("#destination-url").fill(value)
    page.locator("#destination-url").dispatch_event("change")


def choose_type(page, value: str) -> None:
    # "bulk" is Link with "Add many web addresses" ticked.
    page.locator("#output-link" if value == "bulk" else f"#output-{value}").check()
    if value == "bulk":
        page.locator("#many-addresses").check()
    elif page.locator("#many-addresses").is_visible():
        page.locator("#many-addresses").uncheck()
    page.wait_for_timeout(150)


def expect_rejected(page, value: str, message: str) -> None:
    fill_link(page, value)
    page.wait_for_function(
        "message => { const error = document.querySelector('#destination-error'); "
        "return error && !error.hidden && error.textContent === message; }",
        arg=message,
    )
    require(page.locator("#preview-ready").is_hidden(), f"Rejected link made a result: {value}")
    require(page.locator("#destination-url").get_attribute("aria-invalid") == "true",
            f"Rejected link lacks aria-invalid: {value}")


def open_app(context, base_url: str, query: str = ""):
    page = context.new_page()
    page.goto(f"{base_url}{query}#start", wait_until="networkidle")
    ready(page)
    page.wait_for_function("() => document.querySelectorAll('#tracking-agency option').length > 1")
    return page


def download_to(page, button_selector: str, folder: Path, name: str) -> Path:
    with page.expect_download() as info:
        page.locator(button_selector).click()
    target = folder / name
    info.value.save_as(target)
    return target


def logo_metrics(page) -> dict[str, float]:
    raw = page.locator("#qr-canvas").evaluate("""canvas => ({
      moduleCount: canvas.dataset.qrModuleCount,
      backingWidth: canvas.dataset.logoBackingWidthModules,
      backingHeight: canvas.dataset.logoBackingHeightModules,
      safetyUsage: canvas.dataset.logoSafetyUsage
    })""")
    require(all(raw.values()), f"Logo sizing data is incomplete: {raw}")
    metrics = {key: float(value) for key, value in raw.items()}
    modules = metrics["moduleCount"]
    require(metrics["backingWidth"] <= (modules * 0.30) + 0.02, f"Logo backing is too wide: {metrics}")
    require(metrics["backingHeight"] <= (modules * 0.30) + 0.02, f"Logo backing is too tall: {metrics}")
    require(metrics["backingWidth"] * metrics["backingHeight"] <= (modules * modules * 0.08) + 0.5,
            f"Logo backing uses too much QR area: {metrics}")
    require(metrics["safetyUsage"] <= 1.001, f"Logo plan exceeds its correction budget: {metrics}")
    return metrics


def csv_rows(path: Path) -> list[list[str]]:
    import csv
    text = path.read_text(encoding="utf-8-sig")
    return list(csv.reader(text.splitlines()))


# ---- Scenarios ----

def check_destination_modes(context, base_url: str) -> None:
    outside = "https://www.cdc.gov/flu?utm_source=flyer#details"
    for query in ("", "?dest=ANY", "?Dest=any", "?dest=county", "?dest=any&dest=any", "?other=any"):
        page = open_app(context, base_url, query)
        try:
            require(page.locator("#destination-mode").is_hidden(), f"County-only mode overridden by {query!r}")
            require(page.locator("#allowed-websites-help").is_visible(), f"County-only help missing for {query!r}")
            expect_rejected(page, outside, FORBIDDEN)
            fill_link(page, "https://hhs.marincounty.gov/healthy")
            wait_for_link(page, expected_link("https://hhs.marincounty.gov/healthy", [("utm_source", "marin-county"), ("via", "link")]))
        finally:
            page.close()

    page = open_app(context, base_url, "?dest=any")
    try:
        require(page.locator("#destination-mode").is_visible(), "Any-HTTPS mode is not shown")
        require(page.locator("#allowed-websites-help").is_hidden(), "County-only list shows in unrestricted mode")
        choose_type(page, "qr")
        fill_link(page, outside)
        link = wait_for_qr(page, expected_link(outside, [("utm_source", "marin-county"), ("via", "qr")]))
        require(decode_qr(canvas_png(page)) == link, "Unrestricted QR does not encode the tracked link")
        require("dest=any" not in destination_of(link), "The app's mode parameter leaked into the destination")
        for invalid, error in (
            ("http://www.cdc.gov/flu", "Use a secure HTTPS link."),
            ("javascript:alert(1)", "Use a secure HTTPS link."),
            ("https://person:secret@www.cdc.gov/flu", "Remove the user name or password from this link."),
            ("https://www.cdc.gov:8443/flu", "Remove the extra number after the website name."),
        ):
            expect_rejected(page, invalid, error)
    finally:
        page.close()

    page = open_app(context, base_url)
    try:
        for hostname in ("https://marincounty.gov/a", "https://hhs.marincounty.gov/a", "https://marinhhs.org/a",
                         "https://x.marinhhs.org/a", "https://marincountygov.github.io/marin-links/",
                         "https://marinmap.org/a", "https://marinfair.org/tickets",
                         "https://www.marinfair.org/a", "https://www.marincultural.org/a",
                         "https://marincultural.org/a"):
            fill_link(page, hostname)
            wait_for_link(page, expected_link(hostname, [("utm_source", "marin-county"), ("via", "link")]))
        for bad in ("https://marincounty.gov.example.com/a", "https://evilmarincounty.gov/a",
                    "https://x.marincountygov.github.io/a", "https://www.cdc.gov/flu?dest=any",
                    "https://marinfair.org.example.com/a", "https://notmarinfair.org/a",
                    "https://marincultural.org.example.com/a"):
            expect_rejected(page, bad, FORBIDDEN)
    finally:
        page.close()


def check_basics_and_tracking(context, base_url: str) -> None:
    page = open_app(context, base_url)
    try:
        order = page.locator('input[name="output"]').evaluate_all("nodes => nodes.map(n => n.value)")
        require(order == ["link", "qr"], f"Type choices are out of order: {order}")
        require(page.locator("#output-link").is_checked(), "Link is not the default")
        require(page.locator("#preview-empty").is_visible(), "Initial empty preview is missing")
        require(page.locator("#design-section").is_hidden(), "Design shows in Link mode")
        require(page.locator("#qr-color-field").is_hidden() and page.locator("#background-field").is_hidden(),
                "Switched-off options are visible")
        require(page.locator("#upload-logo").is_hidden(), "Logo upload is visible")
        require(page.locator("#panel-stats").is_hidden(), "Stats shows on the Create tab")
        no_overflow(page)

        base = "https://hhs.marincounty.gov/services/apply?lang=en#start"
        fill_link(page, base)
        link = wait_for_link(page, expected_link(base, [("utm_source", "marin-county"), ("via", "link")]))
        require(page.locator("#copy-link-primary").get_attribute("data-copy-value") == link, "Copy link value differs")
        require(page.locator("#scan-note").is_hidden() and page.locator("#size-note").is_hidden(),
                "QR-only notes show in Link mode")

        page.locator("#tracking-channel").select_option("ch-05")
        page.locator("#tracking-agency").select_option("ag-14")
        page.locator("#tracking-campaign-choice").select_option(label="Weather Together")
        labels = [("utm_medium", "ch-05"), ("utm_source", "marin-county"), ("utm_campaign", "cmp-02"),
                  ("agency", "ag-14"), ("via", "link")]
        wait_for_link(page, expected_link(base, labels))

        # A division adds its own label, and the agency label still names the whole department.
        require(page.locator("#tracking-agency option").count() == 1 + 25 + 20, "Agency list differs from the County list")
        page.locator("#tracking-agency").select_option("ag-14/dv-10")
        with_division = labels[:4] + [("division", "dv-10")] + labels[4:]
        wait_for_link(page, expected_link(base, with_division))
        page.locator("#tracking-agency").select_option("ag-14")
        wait_for_link(page, expected_link(base, labels))

        # Every list ends with "Add a new one".
        for select in ("#tracking-channel", "#tracking-source", "#tracking-campaign-choice", "#tracking-content-choice"):
            require(page.locator(f"{select} option").last.get_attribute("value") == "__new__", f"{select} has no Add a new one")
        require(page.locator("#tracking-source").input_value() == "marin-county", "Source does not default to marin-county")

        page.locator("#tracking-campaign-choice").select_option("__new__")
        page.locator("#tracking-campaign").fill("Spring Fair 2027!")
        labels[2] = ("utm_campaign", "spring-fair-2027")
        wait_for_link(page, expected_link(base, labels))

        page.locator("#tracking-channel").select_option("__new__")
        page.locator("#tracking-channel-new").fill("Community Event")
        labels[0] = ("utm_medium", "community-event")
        wait_for_link(page, expected_link(base, labels))

        page.locator("#tracking-source").select_option("so-01")
        labels[1] = ("utm_source", "so-01")
        wait_for_link(page, expected_link(base, labels))
        page.locator("#tracking-source").select_option("__new__")
        page.locator("#tracking-source-new").fill("Library Desk")
        labels[1] = ("utm_source", "library-desk")
        wait_for_link(page, expected_link(base, labels))

        page.locator("#tracking-date").fill("2026-10-23")
        labels.append(("utm_content", "261023"))
        wait_for_link(page, expected_link(base, labels))
        page.locator("#tracking-content-choice").select_option("__new__")
        page.locator("#tracking-content").fill("Bus Stop")
        labels[-1] = ("utm_content", "261023-bus-stop")
        wait_for_link(page, expected_link(base, labels))

        # The four names with fields of their own are not offered in Add a tracking detail.
        page.locator("#add-parameter").click()
        row = page.locator(".qr-parameter-row").first
        row.locator(".qr-parameter-picker__trigger").click()
        for name in ("utm_source", "utm_medium", "utm_campaign", "utm_content"):
            require(row.locator(f'.qr-parameter-picker__option[data-value="{name}"]').count() == 0, f"{name} is still offered")
        row.locator('.qr-parameter-picker__option[data-value="lang"]').click()
        row.locator(".qr-parameter-value-choice").select_option("es")
        labels.append(("lang", "es"))
        wait_for_link(page, expected_link(base, labels))

        # Reset clears everything and returns to Link.
        page.locator("#reset-form").click()
        require(page.locator("#destination-url").input_value() == "", "Reset kept the web address")
        require(page.locator(".qr-parameter-row").count() == 0, "Reset kept tracking rows")
        require(page.locator("#tracking-agency").input_value() == "", "Reset kept the agency")
        require(page.locator("#output-link").is_checked(), "Reset did not return to Link")
    finally:
        page.close()


def check_qr_output(context, base_url: str, folder: Path) -> None:
    page = open_app(context, base_url)
    try:
        choose_type(page, "qr")
        require(page.locator("#design-section").is_visible(), "Design is hidden in QR mode")
        base = "https://marincounty.gov/innovation"
        fill_link(page, base)
        link = wait_for_qr(page, expected_link(base, [("utm_source", "marin-county"), ("via", "qr")]))
        # The page address can be shown under the code, inside the picture.
        square = page.locator("#qr-canvas").evaluate("c => c.height === c.width")
        page.locator("#qr-show-address").check()
        page.wait_for_function("() => { const c = document.querySelector('#qr-canvas'); return c.height > c.width; }")
        require(square, "The code is not square without the address")
        require("marincounty.gov/innovation" in page.locator("#qr-canvas").get_attribute("aria-label"),
                "Address missing from the image description")
        # A Short QR is made only after the explicit create action. It prints
        # the confirmed Short URL under the code instead of the destination.
        page.locator("#length-short").check()
        # The create button is never hidden itself; its panel is, so wait for the panel and for the update to finish.
        page.wait_for_function("() => !document.querySelector('#short-create-actions').hidden && document.querySelector('#qr-show-address').disabled")
        require(page.locator("#qr-show-address").is_disabled(), "The address option stays on for a Short link")
        require(page.locator("#download").is_disabled(), "A Short QR exists before it is created")
        page.locator("#short-create").click()
        # The test server makes the code from the destination, so read the confirmed Short URL from the page.
        page.wait_for_function(
            "root => { const text = document.querySelector('#final-url')?.textContent || ''; "
            "return text.startsWith(root) && !text.includes('?d=') && document.querySelector('#qr-canvas')?.dataset.qrReady === 'true' "
            "&& !document.querySelector('#download')?.disabled; }",
            arg=TRACKER_ROOT,
        )
        short_url = final_link(page)
        require(re.fullmatch(re.escape(TRACKER_ROOT) + r"[A-Za-z0-9-]+", short_url), f"Short URL has an unexpected shape: {short_url}")
        require(short_url.removeprefix("https://") in page.locator("#qr-canvas").get_attribute("aria-label"),
                "The Short URL is missing from the image description")
        require(decode_qr(canvas_png(page)) == short_url, "Short QR does not encode the confirmed server URL")
        page.locator("#length-long").check()
        page.wait_for_function("() => !document.querySelector('#qr-show-address').disabled")
        page.locator("#qr-show-address").uncheck()
        page.wait_for_function("() => { const c = document.querySelector('#qr-canvas'); return c.height === c.width; }")
        require(page.locator("#scan-note").is_visible(), "Scan note is hidden in QR mode")
        require(decode_qr(canvas_png(page)) == link, "QR code does not encode the tracked link")
        note = page.locator("#size-note").text_content()
        require("Print this code at least" in note and "inches wide" in note, f"Print size note differs: {note!r}")
        require("crowded" not in note, "A short link was called crowded")

        # Print sizes: PNG is made at 300 pixels to the inch.
        page.locator("#download-format").select_option("png")
        for inches in ("3", "12"):
            page.locator("#download-size").select_option(inches)
            path = download_to(page, "#download", folder, f"print-{inches}.png")
            image = read_png(path.read_bytes())
            require(abs(image.shape[0] - int(inches) * 300) <= 100, f"{inches} inch PNG is {image.shape[0]} pixels wide")
            require(decode_qr(path.read_bytes()) == link, f"{inches} inch PNG does not decode")
            require(path.name == f"print-{inches}.png", "Download name changed")
        page.locator("#download-size").select_option("3")
        with page.expect_download() as info:
            page.locator("#download").click()
        require(info.value.suggested_filename == "marin-links-3in.png", "PNG download name differs")

        page.locator("#download-format").select_option("svg")
        require(page.locator("#download-size").is_hidden(), "Print size shows for SVG")
        svg_path = download_to(page, "#download", folder, "code.svg")
        verify_svg(svg_path.read_text(encoding="utf-8"), link, transparent=False, has_logo=False)

        # A long link is crowded, and small sizes are not offered.
        long_link = "https://www.marincounty.gov/departments/hhs/public-health/communicable-disease/" \
                    "flu-vaccination-clinics-and-community-events-for-the-whole-family-this-fall-and-winter-season"
        fill_link(page, long_link)
        wait_for_qr(page, expected_link(long_link, [("utm_source", "marin-county"), ("via", "qr")]))
        crowded = page.locator("#size-note").text_content()
        require("crowded" in crowded, f"Crowded note is missing: {crowded!r}")
        require(page.locator('#download-size option[value="1.5"]').is_disabled(), "A too-small size can be chosen")
        decode = decode_qr(canvas_png(page))
        require(decode == expected_link(long_link, [("utm_source", "marin-county"), ("via", "qr")]), "Long link does not decode")
    finally:
        page.close()


def check_logos(context, base_url: str, folder: Path) -> None:
    # The Brand Center list is live: new names appear, in A to Z order, and outside files are ignored.
    page = open_app(context, base_url)
    try:
        choose_type(page, "qr")
        page.wait_for_function("() => [...document.querySelectorAll('#logo-choice option')].some(o => o.textContent === 'Zeta Brand')")
        names = page.locator("#logo-choice option").all_text_contents()
        require(names == ["None", "Alpha Brand", "Zeta Brand"], f"Logo list differs: {names}")
        require("Upload my own" not in names, "Upload is offered")
        fill_link(page, "https://marincounty.gov/innovation")
        plain = wait_for_qr(page)
        page.locator("#logo-choice").select_option("alpha-brand")
        page.wait_for_function("() => document.querySelector('#qr-canvas').dataset.logoBackingWidthModules")
        metrics = logo_metrics(page)
        link = wait_for_qr(page)
        require(link == plain, "Choosing a logo changed the link")
        require(decode_qr(canvas_png(page)) == link, "QR code with a logo does not decode")
        svg_path = None
        page.locator("#download-format").select_option("svg")
        svg_path = download_to(page, "#download", folder, "logo.svg")
        verify_svg(svg_path.read_text(encoding="utf-8"), link, transparent=False, has_logo=True)
        require(metrics["moduleCount"] > 20, "Logo metrics look wrong")
        page.locator("#logo-choice").select_option("")
        page.wait_for_function("() => !document.querySelector('#qr-canvas').dataset.logoBackingWidthModules")
    finally:
        page.close()

    # If the list cannot be loaded, the backup list is used.
    fallback_context = context.browser.new_context(viewport={"width": 1200, "height": 900})
    problems, _ = configure(fallback_context, base_url)
    original = BRAND_LIST
    try:
        fallback_context.unroute("**/*")
        def intercept(route):
            from browser_smoke import fulfill_app_data
            url = urlsplit(route.request.url)
            if url.netloc == urlsplit(base_url).netloc:
                route.continue_()
            elif url.hostname == "marincountygov.github.io" and url.path == "/marin-os/catalog.json":
                route.fulfill(status=200, content_type="application/json", body="[]",
                              headers={"Access-Control-Allow-Origin": "*"})
            elif url.hostname == "api.github.com":
                route.fulfill(status=200, content_type="application/json", body="[]",
                              headers={"Access-Control-Allow-Origin": "*"})
            elif not fulfill_app_data(route, brand_list=None):
                route.abort()
        fallback_context.route("**/*", intercept)
        page = fallback_context.new_page()
        page.goto(f"{base_url}#start", wait_until="networkidle")
        ready(page)
        page.wait_for_timeout(500)
        names = page.locator("#logo-choice option").all_text_contents()
        require(names[0] == "None" and "County of Marin" in names and "Weather Together" in names,
                f"Backup logo list differs: {names}")
        require(names[1:] == sorted(names[1:]), "Backup logo list is not in A to Z order")
        page.close()
    finally:
        fallback_context.close()
        _ = original


def check_many_links(context, base_url: str, folder: Path) -> None:
    page = open_app(context, base_url)
    try:
        choose_type(page, "bulk")
        require(page.locator("#single-url-field").is_hidden() and page.locator("#bulk-urls").is_visible(),
                "Many links fields differ")
        require(page.locator("#design-section").is_hidden(), "Design shows for Many links")
        page.locator("#tracking-agency").select_option("ag-14")
        page.locator("#bulk-urls").fill("\n".join([
            "https://marincounty.gov/innovation",
            '"https://hhs.marincounty.gov/flu",Flu page,2026',
            "http://insecure.example.com",
            "https://evil.example.com/x",
            '=HYPERLINK("x")',
            "https://marinhhs.org/care",
        ]))
        page.wait_for_function("() => document.querySelectorAll('#bulk-rows tr').length === 6")
        require("3 of 6 links made" in page.locator("#bulk-summary").text_content(), "Summary differs")
        rows = page.locator("#bulk-rows tr")
        first = expected_link("https://marincounty.gov/innovation", [("utm_source", "marin-county"), ("agency", "ag-14"), ("via", "link")])
        require(rows.nth(0).locator("td").nth(1).text_content() == first, "First link differs")
        require("secure HTTPS" in rows.nth(2).text_content(), "HTTP problem is missing")
        require(FORBIDDEN in rows.nth(3).text_content(), "Outside website problem is missing")
        require(page.locator("#bulk-copy").get_attribute("data-copy-value").count("\n") == 2, "Copy all links value differs")
        path = download_to(page, "#bulk-csv", folder, "links.csv")
        table = csv_rows(path)
        require(table[0] == ["Web address", "Your link", "Status", "Problem"], "CSV header differs")
        require(len(table) == 7, "CSV row count differs")
        require(table[5][0] == "'=HYPERLINK(\"x\")", f"Formula was not guarded: {table[5][0]!r}")
        page.locator("#bulk-urls").fill("\n".join(f"https://marincounty.gov/p{i}" for i in range(101)))
        page.wait_for_function("() => !document.querySelector('#bulk-error').hidden")
        require("up to 100" in page.locator("#bulk-error").text_content(), "The 100 address limit is not shown")
        no_overflow(page)
        page.locator("#reset-form").click()
        require(page.locator("#output-link").is_checked() and page.locator("#bulk-urls").input_value() == "",
                "Reset did not clear Many links")
    finally:
        page.close()


def check_restored_form(context, base_url: str) -> None:
    """The browser can bring back choices after a refresh. The page must match them."""
    page = open_app(context, base_url)
    try:
        page.evaluate("""() => {
          document.querySelector('#output-qr').checked = true;
          document.querySelector('#destination-url').value = 'https://marincounty.gov/innovation';
          window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}));
        }""")
        wait_for_qr(page)
        require(page.locator("#design-section").is_visible(), "Design is hidden after the form was restored")
    finally:
        page.close()


def check_stats(context, base_url: str, folder: Path) -> None:
    calls: list[str] = []
    page = open_app(context, base_url)
    page.on("request", lambda request: calls.append(f"{request.method} {request.url}")
            if request.url.startswith(TRACKER_ROOT) else None)
    try:
        page.locator("#tab-stats").click()
        page.wait_for_function("() => !document.querySelector('#stats-kpis').hidden")
        require(page.locator("#stats-kpi-visits").text_content() == "10", "Visits number differs")
        require(page.locator("#stats-kpi-visitors").text_content() == "8", "Estimated visitors number differs")
        require(page.locator("#stats-kpi-links").text_content() == "2", "Links number differs")
        page.wait_for_function("() => document.querySelector('#stats-via-chart').getAttribute('aria-label').includes('QR codes')")
        require("QR codes" in page.locator("#stats-via-chart").get_attribute("aria-label"), "QR codes chart is empty")
        require(page.locator("#stats-daily-chart").is_visible(), "Visits chart is hidden")
        options = page.locator("#stats-link option").all_text_contents()
        require(options[0] == "All links" and any("marincounty.gov/innovation" in o for o in options), "Link list differs")
        csv_path = download_to(page, "#stats-csv", folder, "stats.csv")
        table = csv_rows(csv_path)
        sections = {row[0] for row in table if len(row) > 3}
        require({"Visits over time", "Top links", "QR codes and links", "Browsers"} <= sections, f"CSV sections differ: {sections}")
        require(["QR codes and links", "QR codes", "7", ""] in table, "CSV is missing the QR codes row")

        # Choices go into the address and come back from it.
        page.locator("#stats-period").select_option("7")
        page.locator("#stats-agency").select_option("ag-14")
        page.wait_for_function("() => location.search.includes('agency=ag-14') && location.search.includes('period=7')")
        shared = page.locator("#stats-copy-link").evaluate("button => (button.dispatchEvent(new PointerEvent('pointerdown')), button.dataset.copyValue)")
        require("view=stats" in shared and "period=7" in shared and "agency=ag-14" in shared, f"Shared address differs: {shared}")
        require(any("filter_param=agency" in call for call in calls), "The agency filter was not sent")
        require(all(call.startswith("GET ") for call in calls), "The app made a request that is not read-only")
        require(all("/api/v1/" in call for call in calls), f"The app called the tracker outside its API: {calls}")
        require(not any(call.endswith("/marin-qr-tracker/") or "?d=" in call for call in calls), "The app opened a tracked link")
    finally:
        page.close()

    page = open_app(context, base_url, f"?view=stats&period=90&agency=hhs&link={LINK_ID}&detail=utm_source")
    try:
        page.wait_for_function("() => !document.querySelector('#stats-kpis').hidden")
        require(page.locator("#stats-period").input_value() == "90", "Shared period did not come back")
        require(page.locator("#stats-agency").input_value() == "ag-14", "Shared agency did not come back")
        require(page.locator("#stats-link").input_value() == LINK_ID, "Shared link did not come back")
        require(page.locator("#stats-parameter").input_value() == "utm_source", "Shared detail did not come back")
    finally:
        page.close()

    page = open_app(context, base_url, "?view=stats&period=bad&link=nope&detail=%3Cscript%3E")
    try:
        page.wait_for_function("() => !document.querySelector('#stats-kpis').hidden")
        require(page.locator("#stats-period").input_value() == "30", "A bad period was accepted")
    finally:
        page.close()


def check_small_screen_and_dark(browser, base_url: str, screenshots: Path | None) -> None:
    for scheme in ("light", "dark"):
        context = browser.new_context(viewport={"width": 360, "height": 800}, color_scheme=scheme)
        configure(context, base_url)
        page = open_app(context, base_url)
        try:
            for kind in ("link", "bulk", "qr"):
                choose_type(page, kind)
                if kind == "bulk":
                    page.locator("#bulk-urls").fill("https://marincounty.gov/innovation")
                else:
                    fill_link(page, "https://marincounty.gov/innovation")
                page.wait_for_timeout(600)
                no_overflow(page)
            if screenshots:
                page.screenshot(path=str(screenshots / f"create-{scheme}.png"), full_page=True)
            page.locator("#tab-stats").click()
            page.wait_for_function("() => !document.querySelector('#stats-kpis').hidden")
            no_overflow(page)
            if screenshots:
                page.screenshot(path=str(screenshots / f"stats-{scheme}.png"), full_page=True)
        finally:
            context.close()


def run(screenshots: Path | None = None) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise RuntimeError("Browser app tests require Python Playwright and Chromium.") from error

    with serve() as base_url, sync_playwright() as pw, tempfile.TemporaryDirectory() as temp:
        folder = Path(temp)
        executable = (shutil.which("chromium") or shutil.which("chromium-browser")
                      or shutil.which("google-chrome"))
        options = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if executable:
            options["executable_path"] = executable
        browser = pw.chromium.launch(**options)
        try:
            context = browser.new_context(viewport={"width": 1280, "height": 1000}, color_scheme="light",
                                          accept_downloads=True)
            problems, _ = configure(context, base_url)
            check_destination_modes(context, base_url)
            check_basics_and_tracking(context, base_url)
            check_qr_output(context, base_url, folder)
            check_logos(context, base_url, folder)
            check_many_links(context, base_url, folder)
            check_restored_form(context, base_url)
            check_stats(context, base_url, folder)
            check_small_screen_and_dark(browser, base_url, screenshots)
            ignorable = ("localhost:8935", "loadScore", "loadTech")
            real = [p for p in problems if not any(token in p for token in ignorable)]
            require(not real, f"Unexpected browser problems: {real}")
            context.close()
        finally:
            browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshots", type=Path, help="Optional directory for review screenshots")
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    run(args.screenshots)
    print("Marin Links browser workflow, Many links, Stats, and QR decode checks: PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
