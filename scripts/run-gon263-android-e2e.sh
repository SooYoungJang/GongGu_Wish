#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
mkdir -p artifacts/android

capture_final_disk() {
  df -h "$repo_root" > artifacts/android/disk-final.txt || true
}
trap capture_final_disk EXIT

test "${ORG_GRADLE_PROJECT_reactNativeArchitectures:-}" = "x86_64"
test -s artifacts/android/build-config.txt
test -s artifacts/android/disk-after-build.txt

probe_device_http() {
  local port="$1"
  local path="$2"
  local output="$3"

  printf 'GET %s HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n' \
    "$path" \
    | adb shell toybox nc -w 10 -q 2 127.0.0.1 "$port" \
    | tr -d '\r' \
    | tee "$output"
  grep -Eq '^HTTP/1\.[01] 200' "$output"
}

# Route device-local URLs to the runner so API and media use the same stable
# loopback origin on every emulator backend.
adb reverse tcp:54321 tcp:54321
adb reverse tcp:58080 tcp:58080
adb reverse --list | tee artifacts/android/adb-reverse.txt
grep -F "tcp:54321 tcp:54321" artifacts/android/adb-reverse.txt
grep -F "tcp:58080 tcp:58080" artifacts/android/adb-reverse.txt

adb install -r \
  apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb reverse --list | tee artifacts/android/adb-reverse-after-install.txt
grep -F "tcp:54321 tcp:54321" \
  artifacts/android/adb-reverse-after-install.txt
grep -F "tcp:58080 tcp:58080" \
  artifacts/android/adb-reverse-after-install.txt
probe_device_http 54321 /auth/v1/health \
  artifacts/android/device-supabase-probe.txt
probe_device_http 58080 /health artifacts/android/device-media-probe.txt

set +e
maestro test .maestro/gon-263-critical-journeys.yaml 2>&1 \
  | tee artifacts/android/critical-output.log
critical_status=${PIPESTATUS[0]}
set -e
find . -maxdepth 1 -name 'gon263-critical-*.png' \
  -exec cp {} artifacts/android/ \;
latest_dir="$(find "$HOME/.maestro/tests" -mindepth 1 -maxdepth 1 \
  -type d | sort | tail -n 1)"
if [[ -n "$latest_dir" ]]; then
  cp "$latest_dir/maestro.log" artifacts/android/critical-maestro.log
  find "$latest_dir" -maxdepth 1 -name 'commands-*.json' \
    -exec cp {} artifacts/android/critical-commands.json \;
fi

reels_status=1
if [[ "$critical_status" -eq 0 ]]; then
  set +e
  maestro test .maestro/gon-263-reels-lifecycle.yaml 2>&1 \
    | tee artifacts/android/reels-output.log
  reels_status=${PIPESTATUS[0]}
  set -e
  find . -maxdepth 1 -name 'gon263-reels-*.png' \
    -exec cp {} artifacts/android/ \;
  latest_dir="$(find "$HOME/.maestro/tests" -mindepth 1 -maxdepth 1 \
    -type d | sort | tail -n 1)"
  if [[ -n "$latest_dir" ]]; then
    cp "$latest_dir/maestro.log" artifacts/android/reels-maestro.log
    find "$latest_dir" -maxdepth 1 -name 'commands-*.json' \
      -exec cp {} artifacts/android/reels-commands.json \;
  fi
fi

adb logcat -d > artifacts/android/logcat.txt || true
test "$critical_status" -eq 0
test "$reels_status" -eq 0
