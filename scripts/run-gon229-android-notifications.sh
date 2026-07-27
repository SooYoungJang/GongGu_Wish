#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
artifact_dir="artifacts/android"
mkdir -p "$artifact_dir"

# A fresh local Supabase instance is started for every Android CI run. Create a
# real account so notification and follow mutations exercise the authenticated
# path after the flow first verifies the guest login gate.
curl --silent --show-error --fail --output /dev/null \
  --request POST \
  --header "apikey: ${EXPO_PUBLIC_SUPABASE_ANON_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"email":"gon229.e2e@example.com","password":"Gon229E2E2026!"}' \
  "${EXPO_PUBLIC_SUPABASE_URL}/auth/v1/signup"

copy_flow_evidence() {
  local prefix="$1"
  find . -maxdepth 1 -name 'gon229-android-*.png' \
    -exec cp {} "$artifact_dir/" \;
  local latest_dir
  latest_dir="$(find "$HOME/.maestro/tests" -mindepth 1 -maxdepth 1 \
    -type d | sort | tail -n 1)"
  if [[ -n "$latest_dir" ]]; then
    cp "$latest_dir/maestro.log" "$artifact_dir/${prefix}-maestro.log"
    find "$latest_dir" -maxdepth 1 -name 'commands-*.json' \
      -exec cp {} "$artifact_dir/${prefix}-commands.json" \;
  fi
}

set +e
maestro test .maestro/gon-229-notification-preferences.yaml 2>&1 \
  | tee "$artifact_dir/gon229-preferences-output.log"
preferences_status=${PIPESTATUS[0]}
set -e
copy_flow_evidence "gon229-preferences"

tap_status=1
if [[ "$preferences_status" -eq 0 ]]; then
  adb shell am start -W \
    -a android.intent.action.VIEW \
    -d "gongguwish://group-buy/gon263-e2e-price-200000" \
    com.gonggu.wish.preview \
    | tee "$artifact_dir/gon229-deep-link-launch.txt"
  sleep 2
  adb shell dumpsys activity activities \
    > "$artifact_dir/gon229-deep-link-state.txt"

  set +e
  maestro test .maestro/gon-229-notification-tap.yaml 2>&1 \
    | tee "$artifact_dir/gon229-tap-output.log"
  tap_status=${PIPESTATUS[0]}
  set -e
  copy_flow_evidence "gon229-tap"
fi

adb shell dumpsys alarm > "$artifact_dir/gon229-alarm-state.txt" || true

test "$preferences_status" -eq 0
test "$tap_status" -eq 0
test -s "$artifact_dir/gon229-preferences-commands.json"
test -s "$artifact_dir/gon229-tap-commands.json"
test -s "$artifact_dir/gon229-deep-link-launch.txt"
test -s "$artifact_dir/gon229-deep-link-state.txt"
grep -F "com.gonggu.wish.preview" "$artifact_dir/gon229-deep-link-state.txt"
test "$(find "$artifact_dir" -name 'gon229-android-*.png' | wc -l)" -ge 7
