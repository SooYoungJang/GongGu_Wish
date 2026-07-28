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

has_event() {
  local event="$1"
  local placement="$2"
  grep -F "\"event\":\"$event\",\"placement\":\"$placement\"" \
    "$artifact_dir/ads-logcat-current.txt" >/dev/null
}

has_terminal_event() {
  local placement="$1"
  has_event "native_ad_loaded" "$placement" \
    || has_event "native_ad_failed" "$placement"
}

write_result() {
  local home_status="external_no_fill"
  local reels_status="external_no_fill"
  if has_event "native_ad_loaded" "home"; then
    home_status="loaded"
  fi
  if has_event "native_ad_loaded" "reels"; then
    reels_status="loaded"
  fi
  printf \
    '{"sdk":"ready","appProcess":"alive","home":"%s","reels":"%s"}\n' \
    "$home_status" "$reels_status" \
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
    && has_terminal_event "home" \
    && has_terminal_event "reels"; then
    if { has_event "native_ad_failed" "home" \
        || has_event "native_ad_failed" "reels"; } \
      && ! grep -F 'Ad failed to load : 3' \
        "$artifact_dir/ads-logcat-current.txt" >/dev/null; then
      echo "A native ad request failed for a reason other than Google no-fill" >&2
      exit 1
    fi
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

echo "Timed out waiting for both official Google test ad request lifecycles" >&2
exit 1
