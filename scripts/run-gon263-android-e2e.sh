#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
mkdir -p artifacts/android

# Route device-local URLs to the runner so API and media use the same stable
# loopback origin on every emulator backend.
adb reverse tcp:54321 tcp:54321
adb reverse tcp:58080 tcp:58080
adb reverse --list | tee artifacts/android/adb-reverse.txt
grep -F "tcp:54321 tcp:54321" artifacts/android/adb-reverse.txt
grep -F "tcp:58080 tcp:58080" artifacts/android/adb-reverse.txt

pushd apps/mobile >/dev/null
npx expo run:android --variant release --no-bundler
popd >/dev/null

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
