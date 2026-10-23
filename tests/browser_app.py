#!/usr/bin/env python3
"""Exercise Marin Links's full browser workflow without external networking."""
from __future__ import annotations

import argparse
import base64
from pathlib import Path
import shutil
import sys
import tempfile
import xml.etree.ElementTree as ET

import cv2
import numpy as np
try:
    from pyzbar.pyzbar import decode as zbar_decode
except ImportError:  # OpenCV remains as a fallback.
    zbar_decode = None

from browser_smoke import ROOT, fixture_page, no_overflow, require


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
    image = composite_on_white(read_png(png))
    if zbar_decode is not None:
        decoded = zbar_decode(image)
        if decoded:
            return decoded[0].data.decode("utf-8")
    value, points, _ = cv2.QRCodeDetector().detectAndDecode(image)
    require(points is not None and value, "Generated PNG could not be decoded as a QR code")
    return value


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


def wait_for_final(page, expected: str | None = None) -> str:
    if expected is None:
        page.wait_for_function(
            "() => document.querySelector('#qr-canvas')?.dataset.qrReady === 'true' "
            "&& !document.querySelector('#download')?.disabled"
        )
    else:
        page.wait_for_function(
            "expected => document.querySelector('#qr-canvas')?.dataset.qrReady === 'true' "
            "&& document.querySelector('#final-url')?.textContent === expected "
            "&& !document.querySelector('#download')?.disabled",
            arg=expected,
        )
    value = page.locator("#final-url").text_content()
    require(bool(value), "Final link is empty")
    if expected is not None:
        require(value == expected, f"Final link differs: {value!r} != {expected!r}")
    return value


def fill_link(page, value: str) -> None:
    page.locator("#destination-url").fill(value)
    page.locator("#destination-url").dispatch_event("change")


def choose_parameter(row, value: str, filter_text: str | None = None) -> None:
    trigger = row.locator(".qr-parameter-picker__trigger")
    trigger.click()
    search = row.locator(".qr-parameter-picker__search")
    search.wait_for(state="visible")
    search.fill(filter_text or value)
    option = row.locator(f'.qr-parameter-picker__option[data-value="{value}"]')
    option.wait_for(state="visible")
    option.click()
    require(trigger.get_attribute("data-value") == value,
            f"Parameter selector did not choose {value}")


def set_hidden_color(page, value: str) -> None:
    page.evaluate(
        """value => {
          const input = document.querySelector('#qr-color-text');
          input.value = value;
          input.dispatchEvent(new Event('input', {bubbles: true}));
        }""",
        value,
    )


def expect_rejected(page, value: str, message: str) -> None:
    fill_link(page, value)
    page.wait_for_function(
        "message => { const error = document.querySelector('#destination-error'); "
        "return error && !error.hidden && error.textContent === message; }",
        arg=message,
    )
    require(page.locator("#destination-error").text_content() == message,
            f"Wrong validation message for {value}")
    require(page.locator("#preview-ready").is_hidden(), f"Rejected link rendered a QR: {value}")
    require(page.locator("#destination-url").get_attribute("aria-invalid") == "true",
            f"Rejected link lacks aria-invalid: {value}")


def verify_destination_modes(context) -> None:
    """The mode comes only from the app URL and cannot disable HTTPS checks."""
    outside = "https://www.cdc.gov/flu/?utm_source=flyer#details"
    forbidden = "Use a link from an approved Marin County website."

    for query in (
        "", "?dest=ANY", "?Dest=any", "?dest=county", "?dest=any&dest=any",
        "?dest=any&dest=other", "?dest=any&%64est=any", "?other=any",
    ):
        page = fixture_page(context, None, f"https://fixture.example/{query}#start")
        try:
            page.locator(".qr-parameter-row").wait_for(state="attached")
            require(page.locator("#destination-mode").is_hidden(),
                    f"County-only mode incorrectly overridden by {query!r}")
            require(page.locator("#allowed-websites-help").is_visible(),
                    f"County-only help missing for {query!r}")
            require(page.locator("#destination-url").get_attribute("aria-describedby")
                    == "destination-error", f"Default field help changed for {query!r}")
            expect_rejected(page, outside, forbidden)
            fill_link(page, "https://hhs.marincounty.gov/healthy")
            wait_for_final(page, "https://hhs.marincounty.gov/healthy")
        finally:
            page.close()

    for query in ("?dest=any", "?dest=any&utm_medium=qr"):
        page = fixture_page(context, None, f"https://fixture.example/{query}#start")
        try:
            page.locator(".qr-parameter-row").wait_for(state="attached")
            require(page.locator("#destination-mode").is_visible(),
                    f"Any-HTTPS mode not shown for {query!r}")
            require("Any HTTPS link" in page.locator("#destination-mode").text_content(),
                    "Unrestricted-mode text differs")
            require(page.locator("#allowed-websites-help").is_hidden(),
                    "County-only website list is still shown in unrestricted mode")
            require(page.locator("#destination-url").get_attribute("aria-describedby")
                    == "destination-mode destination-error",
                    "Unrestricted help is not connected to the input")
            require(page.locator("#destination-url").get_attribute("placeholder")
                    == "https://hhs.marincounty.gov/services", "Destination field changed")

            fill_link(page, outside)
            wait_for_final(page, outside)
            require(decode_qr(canvas_png(page)) == outside,
                    "Unrestricted QR does not encode the entered HTTPS link")
            with page.expect_download() as download_info:
                page.locator("#download-format").select_option("svg")
                page.locator("#download").click()
            with tempfile.TemporaryDirectory() as folder:
                filename = Path(folder) / "outside.svg"
                download_info.value.save_as(filename)
                verify_svg(filename.read_text(encoding="utf-8"), outside,
                           transparent=False, has_logo=False)

            # A query parameter in the app URL must not appear in the QR payload.
            require("dest=any" not in page.locator("#final-url").text_content(),
                    "The app's mode parameter leaked into the QR destination")
            for invalid, error in (
                ("http://www.cdc.gov/flu", "Use a secure HTTPS link."),
                ("javascript:alert(1)", "Use a secure HTTPS link."),
                ("https://person:secret@www.cdc.gov/flu", "Remove the user name or password from this link."),
                ("https://www.cdc.gov:8443/flu", "Remove the extra number after the website name."),
            ):
                expect_rejected(page, invalid, error)
            fill_link(page, "https://marinhhs.org/health")
            wait_for_final(page, "https://marinhhs.org/health")
        finally:
            page.close()

    # Parameters on a *destination* URL do not change the default app mode.
    page = fixture_page(context, None, "https://fixture.example/#start")
    try:
        page.locator(".qr-parameter-row").wait_for(state="attached")
        expect_rejected(page, "https://www.cdc.gov/flu?dest=any", forbidden)
    finally:
        page.close()


def make_logo_png() -> bytes:
    image = np.full((240, 240, 3), 255, dtype=np.uint8)
    cv2.rectangle(image, (24, 24), (216, 216), (59, 181, 229), thickness=-1)
    cv2.circle(image, (120, 120), 56, (0, 0, 0), thickness=-1)
    success, encoded = cv2.imencode(".png", image)
    require(success, "Test logo could not be encoded")
    return encoded.tobytes()


def make_wide_transparent_logo_png() -> bytes:
    """Make a wide mark with large transparent margins for trim testing."""
    image = np.zeros((280, 720, 4), dtype=np.uint8)
    cv2.rectangle(image, (140, 80), (580, 200), (59, 181, 229, 255), thickness=-1)
    cv2.rectangle(image, (180, 105), (540, 175), (0, 0, 0, 255), thickness=-1)
    success, encoded = cv2.imencode(".png", image)
    require(success, "Wide test logo could not be encoded")
    return encoded.tobytes()


def make_blank_transparent_png() -> bytes:
    image = np.zeros((64, 64, 4), dtype=np.uint8)
    success, encoded = cv2.imencode(".png", image)
    require(success, "Blank test image could not be encoded")
    return encoded.tobytes()


def logo_metrics(page) -> dict[str, float]:
    raw = page.locator("#qr-canvas").evaluate("""canvas => ({
      version: canvas.dataset.qrVersion,
      moduleCount: canvas.dataset.qrModuleCount,
      imageWidth: canvas.dataset.logoImageWidthModules,
      imageHeight: canvas.dataset.logoImageHeightModules,
      backingWidth: canvas.dataset.logoBackingWidthModules,
      backingHeight: canvas.dataset.logoBackingHeightModules,
      safetyUsage: canvas.dataset.logoSafetyUsage
    })""")
    require(all(raw.values()), f"Center-image sizing data is incomplete: {raw}")
    return {key: float(value) for key, value in raw.items()}


def require_safe_logo_metrics(metrics: dict[str, float]) -> None:
    modules = metrics["moduleCount"]
    require(metrics["backingWidth"] <= (modules * 0.30) + 0.02,
            f"Center-image backing is too wide: {metrics}")
    require(metrics["backingHeight"] <= (modules * 0.30) + 0.02,
            f"Center-image backing is too tall: {metrics}")
    require(metrics["backingWidth"] * metrics["backingHeight"]
            <= (modules * modules * 0.08) + 0.5,
            f"Center-image backing uses too much QR area: {metrics}")
    require(metrics["safetyUsage"] <= 1.001,
            f"Center-image plan exceeds its safe correction budget: {metrics}")


def run(screenshots: Path | None = None) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise RuntimeError("Browser app tests require Python Playwright and Chromium.") from error

    with sync_playwright() as pw:
        executable = (shutil.which("chromium") or shutil.which("chromium-browser")
                      or shutil.which("google-chrome"))
        options = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if executable:
            options["executable_path"] = executable
        browser = pw.chromium.launch(**options)

        try:
            context = browser.new_context(viewport={"width": 1440, "height": 1000}, color_scheme="light")
            context.set_default_timeout(20000)
            problems: list[str] = []
            context.on("page", lambda page: page.on("pageerror", lambda error: problems.append(str(error))))
            page = fixture_page(context, None, "https://fixture.example/#start")
            page.locator(".qr-parameter-row").wait_for(state="attached")

            require(page.locator("#preview-empty").is_visible(), "Initial empty preview is missing")
            require(page.locator("#preview-ready").is_hidden(), "Preview starts ready without a link")
            for selector in ("#download", "#download-format", "#copy-link-primary"):
                require(page.locator(selector).is_disabled(), f"{selector} starts enabled")
            require(page.locator(".qr-parameter-row").count() == 1, "Expected one starter tracking row")
            starter = page.locator(".qr-parameter-row").first
            require(starter.locator(".qr-parameter-picker__trigger").get_attribute("data-value")
                    == "utm_source", "Starter parameter is not utm_source")
            require(starter.locator(".qr-parameter-value").input_value() == "",
                    "Starter parameter value is not empty")
            require(starter.locator(".qr-parameter-value").get_attribute("placeholder") == "flyer",
                    "utm_source placeholder differs")
            require(page.locator("#destination-url").get_attribute("type") == "url",
                    "Destination is not a URL input")
            require(page.locator("#qr-color-field").is_hidden(),
                    "Future QR color controls are visible")
            require(not page.locator("#background-transparent").is_checked(),
                    "Transparent background starts enabled")
            require(page.locator('[role="radiogroup"][aria-labelledby="background-heading"]').get_attribute("aria-describedby")
                    == "background-help", "Background help is not connected")
            require(not page.locator("#qr-color-text").is_visible(),
                    "Hidden QR color text input is visible")
            require(not page.locator("#qr-color-text").evaluate(
                "input => { input.focus(); return document.activeElement === input; }"),
                "Hidden QR color input can receive focus")
            no_overflow(page)

            base_link = "https://hhs.marincounty.gov/services/apply?lang=en#start"
            fill_link(page, base_link)
            wait_for_final(page, base_link)
            require(page.locator("#qr-canvas").get_attribute("role") == "img", "Canvas lacks image role")
            require(page.locator("#qr-canvas").get_attribute("aria-label"), "Canvas lacks a text label")
            require(page.locator("#qr-canvas").evaluate("canvas => canvas.width >= 1900"),
                    "PNG canvas is not high resolution")
            opaque_png = canvas_png(page)
            require(corner_alpha(opaque_png) == 255, "Default PNG background is not opaque")
            require(page.locator("#qr-canvas").get_attribute("data-transparent-background") == "false",
                    "Default canvas background state differs")
            require(decode_qr(opaque_png) == base_link, "Base QR payload differs from the final link")

            with page.expect_download() as download_info:
                page.locator("#download-format").select_option("svg")
                page.locator("#download").click()
            download = download_info.value
            require(download.suggested_filename == "marin-links.svg", "SVG download name differs")
            with tempfile.TemporaryDirectory() as temp_dir:
                path = Path(temp_dir) / "marin-links.svg"
                download.save_as(path)
                opaque_svg = path.read_text(encoding="utf-8")
                verify_svg(opaque_svg, base_link, transparent=False, has_logo=False)
                require(decode_qr(svg_to_png(page, opaque_svg)) == base_link,
                        "Opaque SVG payload differs")

            page.locator("#background-transparent").check()
            wait_for_final(page, base_link)
            transparent_png = canvas_png(page)
            require(corner_alpha(transparent_png) == 0, "Transparent PNG background is still opaque")
            require(page.locator("#qr-canvas").get_attribute("data-transparent-background") == "true",
                    "Transparent canvas background state differs")
            require(page.locator("#qr-canvas-frame").get_attribute("data-transparent") == "true",
                    "Transparent preview pattern is not enabled")
            require(decode_qr(transparent_png) == base_link,
                    "Transparent QR payload differs from the final link")

            with page.expect_download() as download_info:
                page.locator("#download-format").select_option("svg")
                page.locator("#download").click()
            download = download_info.value
            with tempfile.TemporaryDirectory() as temp_dir:
                path = Path(temp_dir) / "marin-links-transparent.svg"
                download.save_as(path)
                transparent_svg = path.read_text(encoding="utf-8")
                verify_svg(transparent_svg, base_link, transparent=True, has_logo=False)
                require(decode_qr(svg_to_png(page, transparent_svg)) == base_link,
                        "Transparent SVG payload differs")

            first = page.locator(".qr-parameter-row").first
            first.locator(".qr-parameter-value").fill("qr")
            # Adding a row must work even when a field update is still waiting
            # for the short preview debounce.
            page.locator("#add-parameter").click()
            require(page.locator(".qr-parameter-row").count() == 2,
                    "Add tracking detail was lost after typing")
            tracked_once = "https://hhs.marincounty.gov/services/apply?lang=en&utm_source=qr#start"
            wait_for_final(page, tracked_once)

            second = page.locator(".qr-parameter-row").nth(1)
            second_trigger = second.locator(".qr-parameter-picker__trigger")
            second_trigger.press("ArrowDown")
            second_search = second.locator(".qr-parameter-picker__search")
            second_search.wait_for(state="visible")
            require(second_search.evaluate("input => document.activeElement === input"),
                    "Parameter filter did not receive keyboard focus")
            second_search.fill("channel")
            require(second.locator(".qr-parameter-picker__option:visible").count() == 1,
                    "Type-to-filter did not narrow the parameter list")
            second_search.press("Enter")
            require(second_trigger.get_attribute("data-value") == "utm_medium",
                    "Keyboard selection did not choose utm_medium")
            require(second.locator(".qr-parameter-value").input_value() == "",
                    "Changing the parameter did not clear its value")
            require(second.locator(".qr-parameter-value").get_attribute("placeholder") == "qr",
                    "utm_medium placeholder differs")

            second.locator(".qr-parameter-value").fill("poster")
            second.locator(".qr-parameter-value").dispatch_event("change")
            tracked = "https://hhs.marincounty.gov/services/apply?lang=en&utm_source=qr&utm_medium=poster#start"
            wait_for_final(page, tracked)
            require(decode_qr(canvas_png(page)) == tracked, "Tracked QR payload differs from the final link")

            choose_parameter(second, "event")
            require(second.locator(".qr-parameter-value").input_value() == "",
                    "Changing a populated parameter did not clear its value")
            require(second.locator(".qr-parameter-value").get_attribute("placeholder") == "health_fair",
                    "event placeholder differs")
            second.locator(".qr-parameter-error").wait_for(state="visible")
            require(page.locator("#preview-ready").is_hidden(),
                    "Incomplete changed tracking detail rendered a QR")
            choose_parameter(second, "utm_medium", "medium")
            second.locator(".qr-parameter-value").fill("poster")
            wait_for_final(page, tracked)

            second.locator(".qr-parameter-value").fill("")
            second.locator(".qr-parameter-value").dispatch_event("change")
            second.locator(".qr-parameter-error").wait_for(state="visible")
            require(second.locator(".qr-parameter-value").get_attribute("aria-invalid") == "true",
                    "Missing tracking value lacks aria-invalid")
            require(page.locator("#preview-ready").is_hidden(), "Incomplete tracking detail rendered a QR")
            second.locator(".qr-parameter-value").fill("poster")
            second.locator(".qr-parameter-value").dispatch_event("change")
            wait_for_final(page, tracked)

            page.locator("#add-parameter").click()
            custom = page.locator(".qr-parameter-row").nth(2)
            choose_parameter(custom, "custom")
            require(custom.locator(".qr-custom-parameter-field").is_visible(),
                    "Custom parameter field did not appear")
            require(custom.locator(".qr-parameter-value").get_attribute("placeholder") == "Enter a value",
                    "Custom value placeholder differs")
            custom.locator(".qr-custom-parameter-input").fill("bad name")
            custom.locator(".qr-parameter-value").fill("public_health")
            custom.locator(".qr-parameter-error").wait_for(state="visible")
            require(custom.locator(".qr-parameter-error").text_content()
                    == "Use letters, numbers, underscores, hyphens, periods, or tildes.",
                    "Custom parameter validation message differs")
            require(page.locator("#preview-ready").is_hidden(),
                    "Invalid custom parameter rendered a QR")
            custom.locator(".qr-custom-parameter-input").fill("department")
            tracked_custom = tracked.replace("#start", "&department=public_health#start")
            wait_for_final(page, tracked_custom)
            custom.locator(".qr-remove-parameter").click()
            wait_for_final(page, tracked)

            page.locator("#add-parameter").click()
            duplicate = page.locator(".qr-parameter-row").nth(2)
            duplicate.locator(".qr-parameter-value").fill("duplicate")
            duplicate.locator(".qr-parameter-error").wait_for(state="visible")
            require(duplicate.locator(".qr-parameter-error").text_content()
                    == "Use each tracking detail name only once.",
                    "Duplicate parameter message differs")
            require(duplicate.locator(".qr-parameter-picker__trigger").get_attribute("aria-invalid") == "true",
                    "Duplicate parameter selector lacks aria-invalid")
            require(page.locator("#preview-ready").is_hidden(), "Duplicate parameter rendered a QR")
            duplicate.locator(".qr-remove-parameter").click()
            wait_for_final(page, tracked)

            expect_rejected(
                page,
                "https://marincounty.gov.example.com/page",
                "Use a link from an approved Marin County website.",
            )
            expect_rejected(
                page,
                "https://notmarincounty.gov/page",
                "Use a link from an approved Marin County website.",
            )
            expect_rejected(
                page,
                "https://team.marincountygov.github.io/page",
                "Use a link from an approved Marin County website.",
            )
            expect_rejected(page, "http://marinmap.org/page", "Use a secure HTTPS link.")
            expect_rejected(
                page,
                "https://person@example.com@marincounty.gov/page",
                "Remove the user name or password from this link.",
            )

            for allowed in (
                "https://marincounty.gov/",
                "https://www.marinhhs.org/programs",
                "https://marincountygov.github.io/marin-os/",
                "https://maps.marinmap.org/viewer",
            ):
                fill_link(page, allowed)
                wait_for_final(page)
                require(page.locator("#final-url").text_content().startswith(allowed.rstrip("/")),
                        f"Approved link was changed or blocked: {allowed}")

            fill_link(page, "https://marincounty.gov/services")
            wait_for_final(page)
            set_hidden_color(page, "#eeeeee")
            page.wait_for_function(
                "() => document.querySelector('#color-error').textContent "
                "=== 'Choose a darker color. Light QR codes may not scan.'"
            )
            require(page.locator("#color-error").text_content()
                    == "Choose a darker color. Light QR codes may not scan.",
                    "Light-color warning differs")
            require(page.locator("#preview-ready").is_hidden(), "Low-contrast QR was rendered")
            set_hidden_color(page, "#000000")
            final_without_logo = wait_for_final(page)

            logo = make_logo_png()
            page.locator("#center-image").set_input_files({
                "name": "county-mark.png",
                "mimeType": "image/png",
                "buffer": logo,
            })
            page.locator("#image-choice").wait_for(state="visible")
            wait_for_final(page, final_without_logo)
            require(page.locator("#image-name").text_content() == "county-mark.png",
                    "Chosen image name is not shown")
            require(decode_qr(canvas_png(page)) == final_without_logo,
                    "QR with center image could not be decoded")
            square_metrics = logo_metrics(page)
            require_safe_logo_metrics(square_metrics)
            require(square_metrics["imageWidth"] / square_metrics["moduleCount"] >= 0.18,
                    f"Square center image was not enlarged from the old fixed size: {square_metrics}")

            page.locator("#remove-image").click()
            require(page.locator("#image-choice").is_hidden(), "Center image did not clear")
            wait_for_final(page, final_without_logo)

            page.locator("#center-image").set_input_files({
                "name": "wide-transparent-mark.png",
                "mimeType": "image/png",
                "buffer": make_wide_transparent_logo_png(),
            })
            page.locator("#image-choice").wait_for(state="visible")
            wait_for_final(page, final_without_logo)
            wide_short_metrics = logo_metrics(page)
            require_safe_logo_metrics(wide_short_metrics)
            rendered_ratio = wide_short_metrics["imageWidth"] / wide_short_metrics["imageHeight"]
            require(3.4 <= rendered_ratio <= 3.9,
                    f"Wide image shape or transparent trim was not preserved: {wide_short_metrics}")
            require(decode_qr(canvas_png(page)) == final_without_logo,
                    "QR with wide transparent center image could not be decoded")

            long_base = (
                "https://hhs.marincounty.gov/services/behavioral-health-and-recovery-services/"
                "crisis-support-and-response/community-resources-and-referral-options/"
                "printed-materials/fall-2026"
            )
            fill_link(page, long_base)
            long_final = wait_for_final(page)
            wide_long_metrics = logo_metrics(page)
            require_safe_logo_metrics(wide_long_metrics)
            require(wide_long_metrics["version"] >= 7,
                    f"Long-link test did not cover a QR with version information: {wide_long_metrics}")
            require(wide_long_metrics["imageWidth"] > wide_short_metrics["imageWidth"],
                    "Center image did not recalculate for a larger QR grid")
            require(decode_qr(canvas_png(page)) == long_final,
                    "Long QR with wide center image could not be decoded")

            with page.expect_download() as download_info:
                page.locator("#download-format").select_option("svg")
                page.locator("#download").click()
            download = download_info.value
            with tempfile.TemporaryDirectory() as temp_dir:
                path = Path(temp_dir) / "marin-links-logo.svg"
                download.save_as(path)
                logo_svg = path.read_text(encoding="utf-8")
                verify_svg(logo_svg, long_final, transparent=True, has_logo=True)
                require(decode_qr(svg_to_png(page, logo_svg)) == long_final,
                        "SVG with center image could not be decoded")

            if screenshots:
                screenshots.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(screenshots / "desktop-ready.png"), full_page=True)

            # Test both clipboard actions with a local mock. ClipboardItem accepts
            # the real PNG Blob promise, so the app still exercises PNG creation.
            page.evaluate("""() => {
              Object.defineProperty(window, 'isSecureContext', {value: true, configurable: true});
              window.__copiedText = null;
              window.__copiedItems = null;
              window.ClipboardItem = class ClipboardItem {
                static supports(type) { return type === 'image/png'; }
                constructor(data) { this.data = data; }
              };
              Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                  writeText: async value => { window.__copiedText = value; },
                  write: async items => { window.__copiedItems = items; }
                }
              });
            }""")
            page.locator("#copy-link-primary").click()
            page.wait_for_function("() => window.__copiedText !== null")
            require(page.evaluate("window.__copiedText") == long_final, "Copied link differs")

            with page.expect_download() as download_info:
                page.locator("#download-format").select_option("png")
                page.locator("#download").click()
            download = download_info.value
            require(download.suggested_filename == "marin-links.png", "PNG download name differs")
            with tempfile.TemporaryDirectory() as temp_dir:
                path = Path(temp_dir) / "marin-links.png"
                download.save_as(path)
                downloaded_png = path.read_bytes()
                require(corner_alpha(downloaded_png) == 0,
                        "Downloaded transparent PNG lost its alpha channel")
                require(decode_qr(downloaded_png) == long_final,
                        "Downloaded PNG payload differs")

            page.locator("#remove-image").click()
            require(page.locator("#image-choice").is_hidden(), "Center image did not clear")
            wait_for_final(page, long_final)

            page.locator("#center-image").set_input_files({
                "name": "mark.svg",
                "mimeType": "image/svg+xml",
                "buffer": b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
            })
            page.locator("#image-error").wait_for(state="visible")
            require(page.locator("#image-error").text_content() == "Choose a PNG, JPG, or WebP image.",
                    "Unsafe image type message differs")

            page.locator("#center-image").set_input_files({
                "name": "blank.png",
                "mimeType": "image/png",
                "buffer": make_blank_transparent_png(),
            })
            page.wait_for_function(
                "() => document.querySelector('#image-error').textContent "
                "=== 'Choose an image with something visible in it.'"
            )
            require(page.locator("#preview-ready").is_visible(),
                    "A rejected replacement image removed the valid plain QR")

            verify_destination_modes(context)
            require(not problems, f"Browser page errors: {problems}")
            context.close()

            mobile_context = browser.new_context(
                viewport={"width": 320, "height": 844},
                color_scheme="dark",
                has_touch=True,
            )
            mobile_context.set_default_timeout(10000)
            mobile = fixture_page(mobile_context, None, "https://fixture.example/#start")
            mobile.locator(".qr-parameter-row").wait_for(state="attached")
            fill_link(mobile, "https://marinhhs.org/")
            wait_for_final(mobile, "https://marinhhs.org/")
            mobile_trigger = mobile.locator(".qr-parameter-picker__trigger")
            mobile_trigger.tap()
            mobile.locator('.qr-parameter-picker__option[data-value="utm_medium"]').tap()
            require(mobile_trigger.get_attribute("data-value") == "utm_medium",
                    "Touch selection did not choose utm_medium")
            mobile_trigger.tap()
            mobile.locator(".qr-parameter-picker__search").wait_for(state="visible")
            no_overflow(mobile)
            if screenshots:
                mobile.screenshot(path=str(screenshots / "mobile-dark-ready.png"), full_page=True)
            mobile_context.close()
        finally:
            browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshots", type=Path, help="Optional directory for review screenshots")
    args = parser.parse_args()
    run(args.screenshots)
    print("Marin Links browser workflow and QR decode checks: PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
