#!/usr/bin/env bash
set -euo pipefail

# Runs the ranking Maestro flow across representative iOS point widths:
#   320pt: iPhone SE (1st generation) / iPhone 5s
#   375pt: iPhone SE (2nd/3rd generation), iPhone 8, iPhone 13 mini logical width
#   414pt: iPhone 11 / XR / 11 Pro Max logical width
#
# Requirements:
#   - Java 17+ for Maestro 2.x
#   - Xcode simulator runtime with the named devices available
#   - Built app installed with bundle id com.gonggu.wish
#
# Usage:
#   scripts/run-ranking-maestro-widths.sh
#   FLOW=.maestro/ranking-tab-verify.yaml scripts/run-ranking-maestro-widths.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLOW="${FLOW:-.maestro/search-ranking-test.yaml}"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/.maestro/evidence}"
VERIFY_SCRIPT="$ROOT_DIR/scripts/verify-maestro-screenshot-hashes.sh"

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro CLI not found. Install from https://docs.maestro.dev/maestro-cli/installing-maestro" >&2
  exit 127
fi

JAVA_VERSION_OUTPUT="$(java -version 2>&1 || true)"
if ! /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  echo "Java 17+ is required by Maestro. Current java -version output:" >&2
  echo "$JAVA_VERSION_OUTPUT" >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/logs"

# Device name | logical width notes
DEVICES=(
  "iPhone SE (1st generation)|320pt"
  "iPhone SE (3rd generation)|375pt"
  "iPhone 11|414pt"
)

# Fetch available devices once, reuse for existence checks
AVAILABLE_JSON="$(xcrun simctl list devices available -j 2>/dev/null || echo '{}')"

cd "$ROOT_DIR"

OVERALL_EXIT=0

for entry in "${DEVICES[@]}"; do
  IFS='|' read -r DEVICE WIDTH <<< "$entry"
  RUN_OUTPUT_DIR="$OUTPUT_DIR/$WIDTH"
  mkdir -p "$RUN_OUTPUT_DIR"

  # Check if this device runtime is installed on this machine
  if ! echo "$AVAILABLE_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
devices = data.get('devices', {})
# devices is dict of runtime -> [device, ...]; flatten
all_devs = [d for group in devices.values() for d in group]
sys.exit(0 if any('$DEVICE' in d.get('name','') for d in all_devs) else 1)
" 2>/dev/null; then
    echo "==> SKIP $DEVICE ($WIDTH): simulator runtime not installed"
    continue
  fi

  echo "==> Running $FLOW on $DEVICE ($WIDTH)"
  xcrun simctl boot "$DEVICE" >/dev/null 2>&1 || true
  open -a Simulator >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$DEVICE" -b

  # Capture Maestro output for log analysis
  LOG_FILE="$OUTPUT_DIR/logs/maestro-${WIDTH}.log"

  timeout 300 maestro test \
    --device "$DEVICE" \
    --test-output-dir "$RUN_OUTPUT_DIR" \
    "$FLOW" 2>&1 | tee "$LOG_FILE" || {
      echo "==> WARNING: maestro test exited with non-zero status for $WIDTH"
      OVERALL_EXIT=1
    }

  # Copy screenshots from --test-output-dir to the evidence directory
  if [ -d "$RUN_OUTPUT_DIR" ]; then
    echo "==> Screenshots captured in $RUN_OUTPUT_DIR"
  fi

  # Verify SHA256 uniqueness of screenshots
  echo "==> Verifying screenshot uniqueness for $WIDTH"
  if [ -x "$VERIFY_SCRIPT" ]; then
    if "$VERIFY_SCRIPT" "$RUN_OUTPUT_DIR"; then
      echo "==> PASS: All 6 screenshots have unique SHA256 hashes for $WIDTH"
    else
      echo "==> FAIL: Duplicate screenshots detected for $WIDTH" >&2
      OVERALL_EXIT=1
    fi
  else
    echo "==> SKIP verification: $VERIFY_SCRIPT not found or not executable"
  fi

  echo "==> Completed $WIDTH; artifacts in $RUN_OUTPUT_DIR"
done

echo "All ranking Maestro width checks completed. Artifacts: $OUTPUT_DIR"
exit $OVERALL_EXIT
