#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
BROWSER_MODE="none"
case "${1:-}" in
  '') ;;
  --browser) BROWSER_MODE="http" ;;
  --browser-in-memory) BROWSER_MODE="in-memory" ;;
  -h|--help)
    printf 'Usage: bash scripts/check.sh [--browser|--browser-in-memory]\n'
    exit 0
    ;;
  *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
esac
if [[ $# -gt 1 ]]; then
  printf 'Usage: bash scripts/check.sh [--browser|--browser-in-memory]\n' >&2
  exit 2
fi
# Use $PYTHON when set; otherwise the first of python3 and python that is Python 3.9 or newer.
pick_python() {
  local candidate
  for candidate in "${PYTHON:-}" python3 python; do
    [[ -n "$candidate" ]] || continue
    if command -v "$candidate" >/dev/null 2>&1 \
      && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}
PYTHON=$(pick_python) || {
  printf 'ERROR: Python 3.9 or newer is required for checks. Install it, or set PYTHON to its path.\n' >&2
  exit 1
}

# The browser tests need a few packages and a Chromium for Playwright. Say what is missing before running anything.
check_browser_tools() {
  local missing
  missing=$("$PYTHON" - <<'PY'
import importlib.util
need = {"playwright": "playwright", "numpy": "numpy", "cv2": "opencv-python-headless"}
print(" ".join(pkg for mod, pkg in need.items() if importlib.util.find_spec(mod) is None))
PY
  )
  if [[ -n "$missing" ]]; then
    printf 'ERROR: The browser tests need these Python packages: %s\n' "$missing" >&2
    printf '  Install them with: %s -m pip install -r tests/requirements.txt\n' "$PYTHON" >&2
    exit 1
  fi
  if ! "$PYTHON" - <<'PY' >/dev/null 2>&1
from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    raise SystemExit(0 if Path(p.chromium.executable_path).exists() else 1)
PY
  then
    printf 'ERROR: Playwright has no Chromium browser installed.\n' >&2
    printf '  Install it with: %s -m playwright install chromium\n' "$PYTHON" >&2
    printf '  (on a bare Linux machine: %s -m playwright install --with-deps chromium)\n' "$PYTHON" >&2
    exit 1
  fi
}

bash -n "$ROOT_DIR/scripts/check.sh"
"$PYTHON" "$ROOT_DIR/scripts/server_settings.py" --check
"$PYTHON" "$ROOT_DIR/scripts/sync-security-meta.py" --check
"$PYTHON" "$ROOT_DIR/tests/validate_template.py"
"$PYTHON" "$ROOT_DIR/tests/test_security_meta.py"
"$PYTHON" "$ROOT_DIR/vendor/marinos/audit-buttons.py" "$ROOT_DIR" --fail
# Lists copy, download, file reading and upload code the app does itself; it must list nothing.
"$PYTHON" "$ROOT_DIR/vendor/marinos/audit-shared-helpers.py" "$ROOT_DIR" --fail
"$PYTHON" "$ROOT_DIR/scripts/build-agencies.py" --check
"$PYTHON" "$ROOT_DIR/scripts/build-options.py" --check
"$PYTHON" "$ROOT_DIR/tests/test_app_static.py"

if command -v node >/dev/null 2>&1; then
  node --check "$ROOT_DIR/vendor/marinos/marinos.js"
  node --check "$ROOT_DIR/vendor/qrcode/qrcode.js"
  node --check "$ROOT_DIR/assets/authorized-domains.js"
  node --check "$ROOT_DIR/assets/qr-image.js"
  node --check "$ROOT_DIR/assets/qr-safety.js"
  node --check "$ROOT_DIR/assets/app.js"
  node --check "$ROOT_DIR/assets/stats.js"
  node --check "$ROOT_DIR/assets/tracker-config.js"
  node --check "$ROOT_DIR/assets/short-links-api.js"
  node --check "$ROOT_DIR/assets/agencies.js"
  node --check "$ROOT_DIR/assets/presets.js"
  node --check "$ROOT_DIR/assets/tracking-options.js"
  printf 'JavaScript syntax: PASS\n'
else
  printf 'SKIP: Node is unavailable; JavaScript syntax was not checked.\n' >&2
fi

case "$BROWSER_MODE" in
  http|in-memory) check_browser_tools ;;
esac

case "$BROWSER_MODE" in
  http)
    "$PYTHON" "$ROOT_DIR/tests/browser_smoke.py"
    "$PYTHON" "$ROOT_DIR/tests/browser_security.py"
    "$PYTHON" "$ROOT_DIR/tests/browser_app.py"
    "$PYTHON" "$ROOT_DIR/tests/test_short_integration_browser.py"
    ;;
  in-memory)
    "$PYTHON" "$ROOT_DIR/tests/browser_smoke.py" --in-memory
    "$PYTHON" "$ROOT_DIR/tests/browser_security.py" --in-memory
    "$PYTHON" "$ROOT_DIR/tests/test_short_integration_browser.py"
    printf 'Full QR export/print test needs --browser (real localhost HTTP).\n'
    ;;
  none)
    printf 'SKIP: Browser tests not requested; use --browser or --browser-in-memory.\n'
    ;;
esac
printf 'Requested checks completed successfully.\n'
