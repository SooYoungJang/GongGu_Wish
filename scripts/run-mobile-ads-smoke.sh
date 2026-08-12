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
for selection_attempt in $(seq 1 30); do
  adb shell uiautomator dump /sdcard/ads-age-selection.xml >/dev/null || true
  adb pull /sdcard/ads-age-selection.xml \
    "$artifact_dir/ads-age-selection.xml" >/dev/null || true
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
    && has_event "native_ad_loaded" "reels"; then
    sleep 2
    adb shell pidof "$package_name" >/dev/null
    write_result
    capture_evidence
    test -s "$artifact_dir/ads-runtime-smoke.png"
    test -s "$artifact_dir/ads-runtime-smoke.xml"
    test -s "$artifact_dir/ads-runtime-result.json"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for both official Google test ads to load" >&2
exit 1
