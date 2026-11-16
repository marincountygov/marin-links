#!/usr/bin/env python3
"""Copy the master agencies list from marin-data into data/.

The list is edited only in marin-data (organizations/agencies.json). data/agencies.json and
data/agencies.schema.json here are copies. After a sync, run scripts/build-agencies.py.

  python3 scripts/sync-agencies.py           copy the two files from ../marin-data/organizations/
  python3 scripts/sync-agencies.py --check   fail if the copies differ. Skipped when marin-data is not next to this repo.
"""
from __future__ import annotations

from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "marin-data" / "organizations"
FILES = ("agencies.json", "agencies.schema.json")

if not SOURCE.is_dir():
    if "--check" in sys.argv:
        print("skipped: marin-data is not next to this repo")
        sys.exit(0)
    sys.exit(f"marin-data not found at {SOURCE}")

if "--check" in sys.argv:
    stale = [f for f in FILES if (ROOT / "data" / f).read_bytes() != (SOURCE / f).read_bytes()]
    if stale:
        sys.exit(f"{', '.join(stale)} differ from marin-data. Run: python3 scripts/sync-agencies.py && python3 scripts/build-agencies.py")
    print("ok: agencies list matches marin-data")
else:
    for f in FILES:
        shutil.copyfile(SOURCE / f, ROOT / "data" / f)
    print("copied " + ", ".join(FILES) + " from marin-data")
