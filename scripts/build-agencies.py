#!/usr/bin/env python3
"""Check data/agencies.json and write assets/agencies.js from it.

data/agencies.json is the master list of County agencies and departments. The page reads
assets/agencies.js, which is generated, so the list is ready before the app starts.

  python3 scripts/build-agencies.py           write assets/agencies.js
  python3 scripts/build-agencies.py --check   fail if the file is missing, invalid, or out of date
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "agencies.json"
OUTPUT = ROOT / "assets" / "agencies.js"
ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)?$")
CODE_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
HEADER = """/*
 * County of Marin agencies and departments.
 * Generated from data/agencies.json by scripts/build-agencies.py. Do not edit.
 * Change the list in data/agencies.json, then run the script.
 */

(() => {
  "use strict";

  // Each department has its divisions, in the list's own order. A division is picked as "department code/division code".
  const AGENCIES = """
FOOTER = """;

  window.MarinAgencyList = Object.freeze(AGENCIES.map((agency) => Object.freeze({
    ...agency,
    ...(agency.divisions ? { divisions: Object.freeze(agency.divisions.map((division) => Object.freeze(division))) } : {})
  })));
})();
"""


def problems_in(data: dict) -> list[str]:
    problems: list[str] = []
    for key in ("schemaVersion", "title", "organization", "agencies"):
        if key not in data:
            problems.append(f"Missing {key}")
    agencies = data.get("agencies")
    if not isinstance(agencies, list) or not agencies:
        return problems + ["agencies must be a list with at least one item"]
    by_id: dict[str, dict] = {}
    codes: set[str] = set()
    for index, item in enumerate(agencies):
        label = f"agencies[{index}]"
        for key in ("id", "code", "name", "type", "parent", "url", "status"):
            if key not in item:
                problems.append(f"{label} is missing {key}")
        agency_id = item.get("id", "")
        label = f"{label} ({agency_id})"
        if not ID_PATTERN.match(agency_id or ""):
            problems.append(f"{label}: id must be lowercase words with hyphens, and at most one slash")
        if agency_id in by_id:
            problems.append(f"{label}: id is used twice")
        by_id[agency_id] = item
        code = item.get("code", "")
        if not CODE_PATTERN.match(code or ""):
            problems.append(f"{label}: code must be lowercase letters, numbers, and hyphens")
        if code in codes:
            problems.append(f"{label}: code is used twice")
        codes.add(code)
        if item.get("type") not in ("department", "division"):
            problems.append(f"{label}: type must be department or division")
        if item.get("status") not in ("active", "retired"):
            problems.append(f"{label}: status must be active or retired")
        if not str(item.get("name", "")).strip():
            problems.append(f"{label}: name is empty")
        if not str(item.get("url", "")).startswith("https://"):
            problems.append(f"{label}: url must start with https://")
    for item in agencies:
        agency_id = item.get("id", "")
        if item.get("type") == "department":
            if item.get("parent") is not None or "/" in agency_id:
                problems.append(f"{agency_id}: a department has no parent and no slash in its id")
        elif item.get("type") == "division":
            parent = item.get("parent")
            if parent not in by_id or by_id[parent].get("type") != "department":
                problems.append(f"{agency_id}: parent {parent!r} is not a department in the list")
            elif not agency_id.startswith(f"{parent}/"):
                problems.append(f"{agency_id}: a division id starts with its department id and a slash")
    return problems


def build_list(data: dict) -> list[dict]:
    """Active departments in list order, each with its active divisions."""
    active = [item for item in data["agencies"] if item["status"] == "active"]
    result = []
    for department in (item for item in active if item["type"] == "department"):
        entry = {"value": department["code"], "id": department["id"], "name": department["name"]}
        divisions = [
            {"value": item["code"], "id": item["id"].split("/", 1)[1], "name": item["name"]}
            for item in active if item["type"] == "division" and item["parent"] == department["id"]
        ]
        if divisions:
            entry["divisions"] = divisions
        result.append(entry)
    return result


def render(data: dict) -> str:
    body = json.dumps(build_list(data), indent=2, ensure_ascii=False)
    body = "\n".join(("  " + line if index else line) for index, line in enumerate(body.splitlines()))
    return HEADER + body + FOOTER


def main() -> int:
    check = "--check" in sys.argv[1:]
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    problems = problems_in(data)
    if problems:
        print("data/agencies.json has problems:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    text = render(data)
    if check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != text:
            print("assets/agencies.js is missing or out of date. Run: python3 scripts/build-agencies.py", file=sys.stderr)
            return 1
        print(f"Agency list: PASS ({len(data['agencies'])} entries, assets/agencies.js is current)")
        return 0
    OUTPUT.write_text(text, encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} from {len(data['agencies'])} entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
