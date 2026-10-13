#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
artifact_dir="$repo_root/artifacts/mobile-ads-smoke"
package_name="com.gonggu.wish.preview"
apk="$repo_root/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
cd "$repo_root"
mkdir -p "$artifact_dir"

capture_evidence() {
  adb logcat -d > "$artifact_dir/logcat.txt" || true
  adb logcat -d -s ReactNativeJS:V Ads:V UserMessagingPlatform:V '*:S' \
    > "$artifact_dir/ads-logcat.txt" || true
  adb exec-out screencap -p > "$artifact_dir/ads-runtime-smoke.png" || true
  adb shell uiautomator dump /sdcard/ads-runtime-smoke.xml >/dev/null || true
  adb pull /sdcard/ads-runtime-smoke.xml \
    "$artifact_dir/ads-runtime-smoke.xml" >/dev/null || true
}
trap capture_evidence EXIT

test -s "$apk"
adb install -r "$apk"

# Fresh Play Store emulator images finish provisioning GMS modules after the
# Android boot-complete signal. Starting AdMob during that window can time out
# signal collection and turn Google's deterministic test units into no-fill.
# Let the image settle before the first app process starts, and keep version
# evidence so a failure can be distinguished from an app integration issue.
warmup_seconds="${ADS_GMS_WARMUP_SECONDS:-0}"
{
  adb shell dumpsys package com.google.android.gms \
    | grep -E 'versionName=|versionCode=' \
    | head -n 4 || true
  adb shell dumpsys activity service com.google.android.gms/.chimera.GmsIntentOperationService \
    | head -n 80 || true
} > "$artifact_dir/gms-state-before-warmup.txt"
if (( warmup_seconds > 0 )); then
  sleep "$warmup_seconds"
fi
{
  adb shell dumpsys package com.google.android.gms \
    | grep -E 'versionName=|versionCode=' \
    | head -n 4 || true
  adb shell dumpsys activity service com.google.android.gms/.chimera.GmsIntentOperationService \
    | head -n 80 || true
} > "$artifact_dir/gms-state-after-warmup.txt"

adb logcat -c
adb shell am force-stop "$package_name"
adb shell monkey -p "$package_name" -c android.intent.category.LAUNCHER 1 \
  > "$artifact_dir/launch.txt"

app_started=false
for launch_attempt in $(seq 1 30); do
  if adb shell pidof "$package_name" >/dev/null; then
    app_started=true
    break
  fi
  sleep 1
done
if [[ "$app_started" != "true" ]]; then
  echo "Preview app process did not start within 30 seconds" >&2
  exit 1
fi

age_selection_completed=false
system_ui_recovered=false
for selection_attempt in $(seq 1 30); do
  adb shell uiautomator dump /sdcard/ads-age-selection.xml >/dev/null || true
  adb pull /sdcard/ads-age-selection.xml \
    "$artifact_dir/ads-age-selection.xml" >/dev/null || true
  if [[ -s "$artifact_dir/ads-age-selection.xml" ]]; then
    recovery_coordinates="$(node scripts/mobile-system-ui-dialog.mjs \
      "$artifact_dir/ads-age-selection.xml" "$system_ui_recovered")"
    if [[ -n "$recovery_coordinates" ]]; then
      read -r recovery_x recovery_y <<< "$recovery_coordinates"
      adb shell input tap "$recovery_x" "$recovery_y"
      system_ui_recovered=true
      echo "Recovered emulator System UI; waiting for the Preview age screen"
      sleep 1
      continue
    fi
  fi
  if [[ -s "$artifact_dir/ads-age-selection.xml" ]] \
    && grep -F 'content-desc="만 14세 이상입니다"' \
      "$artifact_dir/ads-age-selection.xml" >/dev/null; then
    bounds="$(grep -o 'content-desc="만 14세 이상입니다"[^>]*bounds="[^"]*"' \
      "$artifact_dir/ads-age-selection.xml" \
      | grep -o 'bounds="[^"]*"' \
      | head -n 1)"
    coordinates="$(printf '%s\n' "$bounds" \
      | sed -nE 's/^bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]"$/\1 \2 \3 \4/p')"
    if [[ -z "$coordinates" ]]; then
      echo "Preview age selection bounds were malformed" >&2
      exit 1
    fi
    read -r left top right bottom <<< "$coordinates"
    if (( left >= right || top >= bottom )); then
      echo "Preview age selection bounds were empty" >&2
      exit 1
    fi
    adb shell input tap "$(( (left + right) / 2 ))" "$(( (top + bottom) / 2 ))"
    age_selection_completed=true
    break
  fi
  sleep 1
done
if [[ "$age_selection_completed" != "true" ]]; then
  echo "Preview age selection did not become actionable within 30 seconds" >&2
  exit 1
fi

has_event() {
  local event="$1"
  local placement="$2"
  grep -F "\"event\":\"$event\",\"placement\":\"$placement\"" \
    "$artifact_dir/ads-logcat-current.txt" >/dev/null
}

write_result() {
  printf \
    '{"sdk":"ready","appProcess":"alive","home":"loaded","reels":"loaded"}\n' \
    > "$artifact_dir/ads-runtime-result.json"
}

for attempt in $(seq 1 120); do
  adb logcat -d -s ReactNativeJS:V Ads:V UserMessagingPlatform:V '*:S' \
    > "$artifact_dir/ads-logcat-current.txt"

  if ! adb shell pidof "$package_name" >/dev/null; then
    echo "Preview app process exited before the ad request lifecycle settled" >&2
    exit 1
  fi

  if grep -F '"event":"initialization_ready"' \
      "$artifact_dir/ads-logcat-current.txt" >/dev/null \
    && has_event "native_ad_request_started" "home" \
    && has_event "native_ad_request_started" "reels" \
    && has_event "native_ad_loaded" "home" \
    && has_event "native_ad_loaded" "reels" \
    && has_event "native_ad_media_layout" "home" \
    && has_event "native_ad_media_layout" "reels"; then
    sleep 2
    adb shell pidof "$package_name" >/dev/null
    capture_evidence
    python3 - "$artifact_dir/ads-runtime-smoke.xml" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

tree = ET.parse(sys.argv[1]).getroot()

def bounds(node):
    values = [int(value) for value in re.findall(r"\d+", node.get("bounds", ""))]
    if len(values) != 4:
        raise SystemExit("Native ad bounds were malformed")
    return values

for placement in ("home", "reels"):
    expected_id = f"ads-runtime-smoke-{placement}-ad"
    ad = next((node for node in tree.iter("node")
               if node.get("resource-id", "").endswith(expected_id)), None)
    if ad is None:
        raise SystemExit(f"{placement} native ad was not visible")
    left, top, right, bottom = bounds(ad)
    buttons = [node for node in ad.iter("node")
               if node.get("class") == "android.widget.Button"]
    if not buttons:
        raise SystemExit(f"{placement} native ad CTA was not visible")
    for button in buttons:
        x1, y1, x2, y2 = bounds(button)
        if not (left <= x1 < x2 <= right and top <= y1 < y2 <= bottom):
            raise SystemExit(f"{placement} native ad CTA exceeded its ad view")
print("Home and reels CTAs are visible inside their native ad views")
PY
    if grep -F 'Not all asset views lie inside the native ad view' \
        "$artifact_dir/ads-logcat.txt" >/dev/null; then
      echo "Native ad assets exceeded their owning ad view" >&2
      exit 1
    fi
    write_result
    test -s "$artifact_dir/ads-runtime-smoke.png"
    test -s "$artifact_dir/ads-runtime-smoke.xml"
    test -s "$artifact_dir/ads-runtime-result.json"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for official Google test ads to load and lay out media" >&2
exit 1
