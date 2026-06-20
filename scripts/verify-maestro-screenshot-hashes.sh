#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <screenshot-directory>" >&2
  exit 64
fi

SCREENSHOT_DIR="$1"
if [[ ! -d "$SCREENSHOT_DIR" ]]; then
  echo "Screenshot directory not found: $SCREENSHOT_DIR" >&2
  exit 66
fi

PNGS=()
while IFS= read -r png; do
  PNGS+=("$png")
done < <(find "$SCREENSHOT_DIR" -maxdepth 1 -type f -name '*.png' | sort)
TOTAL="${#PNGS[@]}"
if [[ "$TOTAL" -ne 6 ]]; then
  echo "Expected exactly 6 PNG screenshots in $SCREENSHOT_DIR, found $TOTAL" >&2
  printf '%s\n' "${PNGS[@]}" >&2
  exit 65
fi

HASH_OUTPUT="$(shasum -a 256 "${PNGS[@]}")"
UNIQUE="$(awk '{print $1}' <<< "$HASH_OUTPUT" | sort -u | wc -l | tr -d ' ')"

echo "$HASH_OUTPUT"
echo "unique_sha256=$UNIQUE total_pngs=$TOTAL"

if [[ "$UNIQUE" -lt 4 ]]; then
  echo "FAIL: Only $UNIQUE unique screenshots out of $TOTAL (expected >= 4)" >&2
  echo "The flow captures 4 distinct states (home, ranking-loaded, after-scroll-up, after-scroll-down)." >&2
  echo "02==03 and 05==06 are expected duplicates (no state change between redundant captures)." >&2
  awk '{ hashes[$1] = hashes[$1] " " $2; counts[$1]++ } END { for (h in counts) if (counts[h] > 1) print h hashes[h] }' <<< "$HASH_OUTPUT" >&2
  exit 1
fi

echo "PASS: $UNIQUE unique SHA256 out of $TOTAL (>= 4, covering all 4 distinct states)"
