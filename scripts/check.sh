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
command -v python3 >/dev/null 2>&1 || {
  printf 'ERROR: Python 3 is required for checks.\n' >&2
  exit 1
}

bash -n "$ROOT_DIR/scripts/check.sh"
python3 "$ROOT_DIR/scripts/sync-security-meta.py" --check
python3 "$ROOT_DIR/tests/validate_template.py"
python3 "$ROOT_DIR/tests/test_security_meta.py"
python3 "$ROOT_DIR/vendor/marinos/audit-buttons.py" "$ROOT_DIR" --fail
python3 "$ROOT_DIR/scripts/build-agencies.py" --check
python3 "$ROOT_DIR/tests/test_app_static.py"

if command -v node >/dev/null 2>&1; then
  node --check "$ROOT_DIR/vendor/marinos/marinos.js"
  node --check "$ROOT_DIR/vendor/qrcode/qrcode.js"
  node --check "$ROOT_DIR/assets/authorized-domains.js"
  node --check "$ROOT_DIR/assets/qr-image.js"
  node --check "$ROOT_DIR/assets/qr-safety.js"
  node --check "$ROOT_DIR/assets/app.js"
  node --check "$ROOT_DIR/assets/stats.js"
  node --check "$ROOT_DIR/assets/tracker-config.js"
  node --check "$ROOT_DIR/assets/agencies.js"
  node --check "$ROOT_DIR/assets/presets.js"
  printf 'JavaScript syntax: PASS\n'
else
  printf 'SKIP: Node is unavailable; JavaScript syntax was not checked.\n' >&2
fi

case "$BROWSER_MODE" in
  http)
    python3 "$ROOT_DIR/tests/browser_smoke.py"
    python3 "$ROOT_DIR/tests/browser_security.py"
    python3 "$ROOT_DIR/tests/browser_app.py"
    ;;
  in-memory)
    python3 "$ROOT_DIR/tests/browser_smoke.py" --in-memory
    python3 "$ROOT_DIR/tests/browser_security.py" --in-memory
    python3 "$ROOT_DIR/tests/browser_app.py"
    ;;
  none)
    printf 'SKIP: Browser tests not requested; use --browser or --browser-in-memory.\n'
    ;;
esac
printf 'Requested checks completed successfully.\n'
