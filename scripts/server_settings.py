#!/usr/bin/env python3
"""Keep the Marin Links Server address in one place: marin.yml.

The `links-server` entry under `services:` in marin.yml holds the server's address (`url`) and the app's
folder on the server (`source-path`). The browser cannot read marin.yml, so this script copies those two
values to the files that must contain them:

  assets/tracker-config.js   serverRoot and sourcePath
  security.json              the server's origin in connect-src and its API address in externalDataSources

then run `python3 scripts/sync-security-meta.py --write` to refresh the CSP meta tag in index.html.

  python3 scripts/server_settings.py --check   fail if a file differs from marin.yml (no changes made)
  python3 scripts/server_settings.py --write   copy marin.yml's values into those files

No dependencies or network access. Tests import `read_settings` so their fixtures follow marin.yml too.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "assets" / "tracker-config.js"
SECURITY = ROOT / "security.json"
API_PATH = "s/api/v1/"
SERVER_RE = re.compile(r'(const serverRoot = ")([^"]*)(";)')
SOURCE_RE = re.compile(r'(const sourcePath = ")([^"]*)(";)')


def read_settings(root: Path = ROOT) -> dict[str, str]:
    """Return {"url", "origin", "host", "api", "source_path"} from the links-server entry of marin.yml."""
    lines = (root / "marin.yml").read_text(encoding="utf-8").splitlines()
    values: dict[str, str] = {}
    inside = False
    for line in lines:
        if re.match(r"^  links-server:\s*$", line):
            inside = True
            continue
        if inside:
            if line and not line.startswith("    "):
                break
            match = re.match(r"^    ([a-z-]+):\s*(.*?)\s*$", line)
            if match:
                values[match.group(1)] = match.group(2).strip("\"'")
    for key in ("url", "source-path"):
        if not values.get(key):
            raise ValueError(f"marin.yml: services.links-server.{key} is required")
    url = values["url"]
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.netloc or parts.query or parts.fragment or not parts.path.endswith("/"):
        raise ValueError("marin.yml: services.links-server.url must be an HTTPS directory address ending in /")
    return {
        "url": url,
        "origin": f"{parts.scheme}://{parts.netloc}",
        "host": parts.netloc,
        "api": url + API_PATH,
        "source_path": values["source-path"],
    }


def current(root: Path = ROOT) -> dict[str, str]:
    """The values now in the generated files."""
    text = TRACKER.read_text(encoding="utf-8")
    server = SERVER_RE.search(text)
    source = SOURCE_RE.search(text)
    if not server or not source:
        raise ValueError("assets/tracker-config.js: serverRoot and sourcePath lines were not found")
    parts = urlsplit(server.group(2))
    return {"url": server.group(2), "origin": f"{parts.scheme}://{parts.netloc}", "api": server.group(2) + API_PATH,
            "source_path": source.group(2)}


def render(want: dict[str, str]) -> tuple[str, str]:
    """The tracker-config.js and security.json text for the wanted settings."""
    old = current()
    tracker = TRACKER.read_text(encoding="utf-8")
    tracker = SERVER_RE.sub(lambda m: f'{m.group(1)}{want["url"]}{m.group(3)}', tracker, count=1)
    tracker = SOURCE_RE.sub(lambda m: f'{m.group(1)}{want["source_path"]}{m.group(3)}', tracker, count=1)
    security = SECURITY.read_text(encoding="utf-8")
    security = security.replace(f'"{old["api"]}"', f'"{want["api"]}"').replace(f'"{old["origin"]}"', f'"{want["origin"]}"')
    return tracker, security


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--write", action="store_true")
    args = parser.parse_args()
    try:
        want = read_settings()
        tracker, security = render(want)
        json.loads(security)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    stale = [path.name for path, text in ((TRACKER, tracker), (SECURITY, security)) if path.read_text(encoding="utf-8") != text]
    if args.check:
        if stale:
            print(f"ERROR: {', '.join(stale)} differ from marin.yml (services.links-server). "
                  "Run: python3 scripts/server_settings.py --write && python3 scripts/sync-security-meta.py --write", file=sys.stderr)
            return 1
        print(f"Marin Links Server address ({want['url']}): files match marin.yml")
        return 0
    TRACKER.write_text(tracker, encoding="utf-8")
    SECURITY.write_text(security, encoding="utf-8")
    print(f"Wrote {want['url']} to tracker-config.js and security.json" if stale else "Already up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main())
