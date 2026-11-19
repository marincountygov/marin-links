#!/usr/bin/env python3
"""Copy the list of places and facilities from marin-data into data/locations.json.

The places and facilities shown as Place or facility choices in the tracking choices are kept in marin-data (organizations/locations.json).
data/locations.json is a copy. Never edit it here. After a sync, run python3 scripts/build-options.py.

  python3 scripts/sync-locations.py           copy ../marin-data/organizations/locations.json
  python3 scripts/sync-locations.py --check   fail if the copy differs. Skipped when marin-data is not next to this repo.
"""
from __future__ import annotations

from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "marin-data" / "organizations" / "locations.json"
COPY = ROOT / "data" / "locations.json"

if not SOURCE.is_file():
    if "--check" in sys.argv:
        print("skipped: marin-data is not next to this repo")
        sys.exit(0)
    sys.exit(f"not found: {SOURCE}")
if "--check" in sys.argv:
    if not COPY.exists() or COPY.read_bytes() != SOURCE.read_bytes():
        sys.exit("data/locations.json differs from marin-data. Run: python3 scripts/sync-locations.py && python3 scripts/build-options.py")
    print("ok: data/locations.json matches marin-data")
else:
    shutil.copyfile(SOURCE, COPY)
    print("copied data/locations.json from marin-data")
