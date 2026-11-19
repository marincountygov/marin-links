#!/usr/bin/env python3
"""Check data/tracking-options.json and write assets/tracking-options.js from it.

  python3 scripts/build-options.py           write assets/tracking-options.js
  python3 scripts/build-options.py --check   fail if the file is missing, invalid, or out of date
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "tracking-options.json"
PROJECTS = ROOT / "data" / "projects.json"  # a copy of marin-data projects/projects.json
LOCATIONS = ROOT / "data" / "locations.json"  # a copy of marin-data organizations/locations.json
OUTPUT = ROOT / "assets" / "tracking-options.js"
CODE_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
LISTS = ("channels", "sources", "languages", "campaigns", "locations", "contents")
# People add their own content labels, so that list may start empty.
MAY_BE_EMPTY = ("contents",)
HEADER = """/*
 * Marin Links tracking choices.
 * Generated from data/tracking-options.json, data/projects.json and data/locations.json by scripts/build-options.py. Do not edit.
 * A link carries only the code. The name is what people see.
 */

(() => {
  "use strict";

  const OPTIONS = """
FOOTER = """;

  window.MarinTrackingOptions = Object.freeze(OPTIONS);
})();
"""


def problems_in(data: dict) -> list[str]:
    problems: list[str] = []
    lists = data.get("lists", {})
    for name in LISTS:
        if not isinstance(lists.get(name), list) or (not lists[name] and name not in MAY_BE_EMPTY):
            problems.append(f"{name} must be a list with at least one item")
    codes: set[str] = set()
    for name in LISTS:
        ids: set[str] = set()
        for item in lists.get(name, []):
            where = f"{name}/{item.get('id', '?')}"
            for key in ("id", "code", "label", "legacy"):
                if key not in item:
                    problems.append(f"{where} is missing {key}")
            if not CODE_PATTERN.match(str(item.get("code", ""))):
                problems.append(f"{where}: code must be lowercase words with hyphens")
            if not CODE_PATTERN.match(str(item.get("id", ""))):
                problems.append(f"{where}: id must be lowercase words with hyphens")
            if not str(item.get("label", "")).strip():
                problems.append(f"{where}: label is empty")
            if item.get("code") in codes and name != "languages":
                problems.append(f"{where}: code is used twice")
            codes.add(item.get("code"))
            if item.get("id") in ids:
                problems.append(f"{where}: id is used twice")
            ids.add(item.get("id"))
    return problems


def render(data: dict) -> str:
    out = {}
    for name in LISTS:
        out[name] = [
            {"value": i["code"], "name": i["label"], "id": i["id"], "legacy": i["legacy"]}
            for i in data["lists"][name]
        ]
    body = json.dumps(out, indent=2, ensure_ascii=False)
    body = "\n".join(("  " + line if index else line) for index, line in enumerate(body.splitlines()))
    return HEADER + body + FOOTER


def campaigns_from(projects: dict) -> list[dict]:
    """The campaigns are the shared projects that have a links entry, A to Z by name."""
    entries = [
        {"id": p["id"], "code": p["links"]["code"], "label": p["name"], "legacy": p["links"]["legacy"]}
        for p in projects.get("projects", [])
        if "links" in p
    ]
    return sorted(entries, key=lambda e: e["label"].casefold())


def locations_from(locations: dict) -> list[dict]:
    """The places and sites people can name, A to Z by label. The code is permanent and is all a link carries."""
    entries = [{"id": l["code"], "code": l["code"], "label": l["label"], "legacy": []} for l in locations.get("locations", [])]
    return sorted(entries, key=lambda e: (e["label"].casefold(), e["code"]))


def main() -> int:
    check = "--check" in sys.argv[1:]
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    if "campaigns" in data.get("lists", {}):
        print("data/tracking-options.json must not list campaigns. They come from data/projects.json.", file=sys.stderr)
        return 1
    if "locations" in data.get("lists", {}):
        print("data/tracking-options.json must not list locations. They come from data/locations.json.", file=sys.stderr)
        return 1
    if not LOCATIONS.is_file():
        print("data/locations.json is missing. Run: python3 scripts/sync-locations.py", file=sys.stderr)
        return 1
    if not PROJECTS.is_file():
        print("data/projects.json is missing. Run: python3 scripts/sync-projects.py", file=sys.stderr)
        return 1
    data["lists"]["campaigns"] = campaigns_from(json.loads(PROJECTS.read_text(encoding="utf-8")))
    data["lists"]["locations"] = locations_from(json.loads(LOCATIONS.read_text(encoding="utf-8")))
    problems = problems_in(data)
    if problems:
        print("The tracking options have problems:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    text = render(data)
    if check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != text:
            print("assets/tracking-options.js is missing or out of date. Run: python3 scripts/build-options.py", file=sys.stderr)
            return 1
        print("Tracking options: PASS (assets/tracking-options.js is current)")
        return 0
    OUTPUT.write_text(text, encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
