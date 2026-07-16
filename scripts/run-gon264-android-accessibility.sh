#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
artifact_dir="artifacts/android"
mkdir -p "$artifact_dir"

original_font_scale="$(adb shell settings get system font_scale | tr -d '\r')"
original_night_mode="$(adb shell cmd uimode night | tr -d '\r')"
original_accessibility_enabled="$(adb shell settings get secure accessibility_enabled | tr -d '\r')"
original_accessibility_services="$(adb shell settings get secure enabled_accessibility_services | tr -d '\r')"

restore_android_accessibility_settings() {
  set +e
  if [[ -z "$original_font_scale" || "$original_font_scale" == "null" ]]; then
    adb shell settings delete system font_scale >/dev/null
  else
    adb shell settings put system font_scale "$original_font_scale"
  fi

  case "$original_night_mode" in
    *yes*) adb shell cmd uimode night yes >/dev/null ;;
    *no*) adb shell cmd uimode night no >/dev/null ;;
    *) adb shell cmd uimode night auto >/dev/null ;;
  esac

  if [[ -z "$original_accessibility_enabled" || "$original_accessibility_enabled" == "null" ]]; then
    adb shell settings delete secure accessibility_enabled >/dev/null
  else
    adb shell settings put secure accessibility_enabled "$original_accessibility_enabled"
  fi
  if [[ -z "$original_accessibility_services" || "$original_accessibility_services" == "null" ]]; then
    adb shell settings delete secure enabled_accessibility_services >/dev/null
  else
    adb shell settings put secure enabled_accessibility_services "$original_accessibility_services"
  fi
  set -e
}
trap restore_android_accessibility_settings EXIT

adb shell settings put system font_scale 2.0
adb shell cmd uimode night yes
adb shell am force-stop com.gonggu.wish

set +e
maestro test .maestro/gon-264-android-accessibility.yaml 2>&1 \
  | tee "$artifact_dir/gon264-output.log"
flow_status=${PIPESTATUS[0]}
set -e

find . -maxdepth 1 -name 'gon264-android-*.png' \
  -exec cp {} "$artifact_dir/" \;
latest_dir="$(find "$HOME/.maestro/tests" -mindepth 1 -maxdepth 1 \
  -type d | sort | tail -n 1)"
if [[ -n "$latest_dir" ]]; then
  cp "$latest_dir/maestro.log" "$artifact_dir/gon264-maestro.log"
  find "$latest_dir" -maxdepth 1 -name 'commands-*.json' \
    -exec cp {} "$artifact_dir/gon264-commands.json" \;
fi

adb shell uiautomator dump /sdcard/gon264-reels-accessibility.xml
adb pull /sdcard/gon264-reels-accessibility.xml \
  "$artifact_dir/gon264-reels-accessibility.xml"

tree="$artifact_dir/gon264-reels-accessibility.xml"
home_tab_count="$(grep -o 'content-desc="홈 탭"' "$tree" | wc -l || true)"
reels_tab_count="$(grep -o 'content-desc="릴스 탭"' "$tree" | wc -l || true)"
test "${home_tab_count//[[:space:]]/}" -eq 0
test "${reels_tab_count//[[:space:]]/}" -eq 0

talkback_component="com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService"
if adb shell pm path com.google.android.marvin.talkback | grep -q '^package:'; then
  adb shell settings put secure enabled_accessibility_services "$talkback_component"
  adb shell settings put secure accessibility_enabled 1
  sleep 3
  adb shell dumpsys accessibility > "$artifact_dir/gon264-talkback-state.txt"
  grep -F "TalkBackService" "$artifact_dir/gon264-talkback-state.txt"
else
  printf '%s\n' 'TalkBack package unavailable on this emulator image.' \
    > "$artifact_dir/gon264-talkback-state.txt"
fi

test "$flow_status" -eq 0
test "$(find "$artifact_dir" -name 'gon264-android-*.png' | wc -l)" -ge 8
test -s "$artifact_dir/gon264-commands.json"
test -s "$artifact_dir/gon264-talkback-state.txt"
