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

for attempt in $(seq 1 120); do
  adb logcat -d -s ReactNativeJS:V Ads:V UserMessagingPlatform:V '*:S' \
    > "$artifact_dir/ads-logcat-current.txt"
  if grep -F '"event":"initialization_ready"' \
      "$artifact_dir/ads-logcat-current.txt" >/dev/null \
    && grep -F '"event":"native_ad_loaded","placement":"home"' \
      "$artifact_dir/ads-logcat-current.txt" >/dev/null \
    && grep -F '"event":"native_ad_loaded","placement":"reels"' \
      "$artifact_dir/ads-logcat-current.txt" >/dev/null; then
    sleep 2
    capture_evidence
    test -s "$artifact_dir/ads-runtime-smoke.png"
    test -s "$artifact_dir/ads-runtime-smoke.xml"
    exit 0
  fi

  if ! adb shell pidof "$package_name" >/dev/null; then
    echo "Preview app process exited before the test ad loaded" >&2
    exit 1
  fi
  sleep 1
done

echo "Timed out waiting for both official Google native test ads" >&2
exit 1
