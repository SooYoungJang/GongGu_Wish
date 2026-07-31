#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_directory="$(mktemp -d)"
fake_bin="$test_directory/bin"
mkdir -p "$fake_bin"
trap 'rm -rf "$test_directory"' EXIT

preview_google_services="$test_directory/google-services.preview.json"
production_google_services="$test_directory/google-services.production.json"
printf '%s\n' \
  '{"project_info":{"project_id":"gonggu-test"},"client":[{"client_info":{"mobilesdk_app_id":"1:123456789012:android:preview","android_client_info":{"package_name":"com.gonggu.wish.preview"}}}]}' \
  >"$preview_google_services"
printf '%s\n' \
  '{"project_info":{"project_id":"gonggu-test"},"client":[{"client_info":{"mobilesdk_app_id":"1:123456789012:android:production","android_client_info":{"package_name":"com.gonggu.wish"}}}]}' \
  >"$production_google_services"

bash_command="${BASH:-bash}"
real_node="$(command -v node)"
export REAL_NODE="$real_node"
"$real_node" --test "$script_directory/validate-supabase-public-config.test.mjs"
if ! command -v bash >/dev/null 2>&1; then
  cp "$bash_command" "$fake_bin/bash.exe"
  bash_command="$fake_bin/bash.exe"
fi

cat >"$fake_bin/eas" <<'FAKE_EAS'
#!/usr/bin/env bash

set -euo pipefail

printf '%s\n' "$*" >>"$MOCK_EAS_LOG"
command_name="${1:?command is required}"
shift

case "$command_name" in
  env:get)
    printf 'GOOGLE_SERVICES_JSON='
    cat "$MOCK_GOOGLE_SERVICES_JSON"
    ;;
  env:exec)
    environment_name="${1:?environment is required}"
    command_string="${2:?command is required}"
    if [[ "${APP_VARIANT:-}" != "$environment_name" ]]; then
      echo "APP_VARIANT must be set before eas env:exec evaluates app config" >&2
      exit 1
    fi
    export APP_VARIANT="$environment_name"
    export EXPO_PUBLIC_API_PROXY_URL="https://api.example.test"
    export EXPO_PUBLIC_SUPABASE_ANON_KEY="test-anon-key"
    export EXPO_PUBLIC_SUPABASE_URL="https://supabase.example.test"
    export GOOGLE_SERVICES_JSON="${GOOGLE_SERVICES_JSON:-$MOCK_GOOGLE_SERVICES_JSON}"
    bash -c "$command_string"
    ;;
  fingerprint:generate)
    printf '{"hash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}\n'
    ;;
  build:list)
    if [[ "$MOCK_COMPATIBLE_BUILD" == "true" ]]; then
      if [[ " $* " == *" --app-identifier "* ]]; then
        printf '[]\n'
      else
        printf '[{"id":"compatible-build-id"}]\n'
      fi
    else
      printf '[]\n'
    fi
    ;;
  update)
    ;;
  build)
    : "${GRADLE_USER_HOME:?GRADLE_USER_HOME is required for local builds}"
    grep -Fxq \
      'org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g -Dfile.encoding=UTF-8' \
      "$GRADLE_USER_HOME/gradle.properties"
    grep -Fxq 'org.gradle.workers.max=2' \
      "$GRADLE_USER_HOME/gradle.properties"
    grep -Fxq \
      'kotlin.daemon.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g' \
      "$GRADLE_USER_HOME/gradle.properties"
    output=""
    while [[ $# -gt 0 ]]; do
      if [[ "$1" == "--output" ]]; then
        output="${2:?output value is required}"
        break
      fi
      shift
    done
    [[ -n "$output" ]]
    mkdir -p "$(dirname "$output")"
    printf 'test-apk' >"$output"
    ;;
  upload)
    case "${MOCK_UPLOAD_FAIL:-false}" in
      quota)
        echo "This account has used its local builds from the free plan this month, which will reset in 1 day, 4 hours (on Sat Aug 01 2026)." >&2
        echo "Request ID: 43586c48-2b64-423c-97b9-5d3ef44ff4b0" >&2
        echo "    Error: GraphQL request failed." >&2
        exit 1
        ;;
      quota-phrase-only)
        echo "This account has used its local builds from the free plan this month." >&2
        exit 1
        ;;
      quota-reset-only)
        echo "The local-build allowance will reset in 1 day." >&2
        exit 1
        ;;
      quota-near-match)
        echo "This account has used its cloud builds from the free plan this month, which will reset in 1 day." >&2
        exit 1
        ;;
      quota-mixed-error)
        echo "This account has used its local builds from the free plan this month, which will reset in 1 day, 4 hours (on Sat Aug 01 2026)." >&2
        echo "Request ID: 43586c48-2b64-423c-97b9-5d3ef44ff4b0" >&2
        echo "    Error: GraphQL request failed." >&2
        echo "Authentication failed after quota evaluation." >&2
        exit 1
        ;;
      true)
        echo "Unexpected EAS GraphQL failure" >&2
        exit 1
        ;;
    esac
    printf '{"id":"uploaded-build-id","url":"https://expo.dev/artifacts/test.apk"}\n'
    ;;
  *)
    printf 'Unexpected EAS command: %s\n' "$command_name" >&2
    exit 1
    ;;
esac
FAKE_EAS
if command -v chmod >/dev/null 2>&1; then
  chmod +x "$fake_bin/eas"
fi

cat >"$fake_bin/gh" <<'FAKE_GH'
#!/usr/bin/env bash

set -euo pipefail

printf '%s\n' "$*" >>"$MOCK_GH_LOG"
fingerprint="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
head_sha="0123456789abcdef0123456789abcdef01234567"
apk_name="gonggu-wish-preview-runtime-$fingerprint"
baseline_name="$apk_name-baseline"

if [[ "$1" == "run" && "$2" == "download" ]]; then
  output_directory=""
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--dir" ]]; then
      output_directory="${2:?download directory is required}"
      break
    fi
    shift
  done
  [[ -n "$output_directory" ]]
  mkdir -p "$output_directory"
  manifest_fingerprint="$fingerprint"
  if [[ "$MOCK_GITHUB_BASELINE" == "bad-manifest" ]]; then
    manifest_fingerprint="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  fi
  printf '%s\n' "{\"schemaVersion\":1,\"environment\":\"preview\",\"packageName\":\"com.gonggu.wish.preview\",\"mode\":\"build\",\"fingerprint\":\"$manifest_fingerprint\",\"commitSha\":\"$head_sha\",\"workflowRunId\":\"42\",\"apkArtifactId\":\"456\",\"apkArtifactName\":\"$apk_name\",\"apkSha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}" \
    >"$output_directory/preview-runtime-baseline.json"
  exit 0
fi

endpoint="${!#}"
case "$endpoint" in
  */actions/workflows/ci.yml)
    if [[ "$MOCK_GITHUB_BASELINE" == "api-error" ]]; then
      echo "GitHub API unavailable" >&2
      exit 1
    fi
    printf '%s\n' '{"id":777}'
    ;;
  */actions/artifacts\?*)
    case "$MOCK_GITHUB_BASELINE" in
      trusted|failed|wrong-workflow|bad-manifest|bad-apk)
        printf '%s\n' "{\"artifacts\":[{\"id\":123,\"name\":\"$baseline_name\",\"expired\":false,\"created_at\":\"2026-07-26T10:00:00Z\",\"workflow_run\":{\"id\":42,\"head_branch\":\"develop\",\"head_sha\":\"$head_sha\"}}]}"
        ;;
      candidate-fallback)
        printf '%s\n' "{\"artifacts\":[{\"id\":122,\"name\":\"$baseline_name\",\"expired\":false,\"created_at\":\"2026-07-26T11:00:00Z\",\"workflow_run\":{\"id\":41,\"head_branch\":\"develop\",\"head_sha\":\"$head_sha\"}},{\"id\":123,\"name\":\"$baseline_name\",\"expired\":false,\"created_at\":\"2026-07-26T10:00:00Z\",\"workflow_run\":{\"id\":42,\"head_branch\":\"develop\",\"head_sha\":\"$head_sha\"}}]}"
        ;;
      expired)
        printf '%s\n' "{\"artifacts\":[{\"id\":123,\"name\":\"$baseline_name\",\"expired\":true,\"workflow_run\":{\"id\":42,\"head_branch\":\"develop\",\"head_sha\":\"$head_sha\"}}]}"
        ;;
      *)
        printf '%s\n' '{"artifacts":[]}'
        ;;
    esac
    ;;
  */actions/runs/41)
    printf '%s\n' "{\"workflow_id\":777,\"path\":\".github/workflows/ci.yml\",\"status\":\"completed\",\"conclusion\":\"failure\",\"event\":\"push\",\"head_branch\":\"develop\",\"head_sha\":\"$head_sha\"}"
    ;;
  */actions/runs/42)
    workflow_id=777
    conclusion="success"
    if [[ "$MOCK_GITHUB_BASELINE" == "failed" ]]; then
      conclusion="failure"
    elif [[ "$MOCK_GITHUB_BASELINE" == "wrong-workflow" ]]; then
      workflow_id=778
    fi
    printf '%s\n' "{\"workflow_id\":$workflow_id,\"path\":\".github/workflows/ci.yml\",\"status\":\"completed\",\"conclusion\":\"$conclusion\",\"event\":\"push\",\"head_branch\":\"develop\",\"head_sha\":\"$head_sha\"}"
    ;;
  */actions/artifacts/456)
    artifact_name="$apk_name"
    expired=false
    if [[ "$MOCK_GITHUB_BASELINE" == "bad-apk" ]]; then
      artifact_name="unexpected-artifact"
    fi
    printf '%s\n' "{\"id\":456,\"name\":\"$artifact_name\",\"expired\":$expired,\"size_in_bytes\":123456,\"workflow_run\":{\"id\":42,\"head_branch\":\"develop\",\"head_sha\":\"$head_sha\"}}"
    ;;
  *)
    printf 'Unexpected GitHub API endpoint: %s\n' "$endpoint" >&2
    exit 1
    ;;
esac
FAKE_GH
if command -v chmod >/dev/null 2>&1; then
  chmod +x "$fake_bin/gh"
fi

cat >"$fake_bin/node" <<'FAKE_NODE'
#!/usr/bin/env bash

set -euo pipefail

if [[ "${1:-}" == *"validate-supabase-public-config.mjs" ]]; then
  if [[ -n "${MOCK_SUPABASE_VALIDATION_LOG:-}" ]]; then
    printf '%s\n' "$*" >>"$MOCK_SUPABASE_VALIDATION_LOG"
  fi
  if [[ "${MOCK_SUPABASE_KEY_VALID:-true}" != "true" ]]; then
    echo "::error::Supabase public configuration was rejected (HTTP 401)." >&2
    exit 1
  fi
  exit 0
fi

exec "$REAL_NODE" "$@"
FAKE_NODE
if command -v chmod >/dev/null 2>&1; then
  chmod +x "$fake_bin/node"
fi

run_deployment() {
  local name="$1"
  local ref="$2"
  local github_baseline="$3"
  local compatible_build="$4"
  local upload_fail="${5:-false}"
  local force_preview_apk="${6:-false}"
  local supabase_key_valid="${7:-true}"
  local case_directory="$test_directory/$name"
  local google_services_file="$preview_google_services"
  if [[ "$ref" == "refs/heads/main" ]]; then
    google_services_file="$production_google_services"
  fi
  mkdir -p "$case_directory/runner"

  PATH="$fake_bin:$PATH" \
    GITHUB_REF="$ref" \
    GITHUB_SHA="abc123" \
    GITHUB_REPOSITORY="SooYoungJang/GongGu_Wish" \
    GH_TOKEN="test-token" \
    GITHUB_OUTPUT="$case_directory/output" \
    GITHUB_STEP_SUMMARY="$case_directory/summary" \
    RUNNER_TEMP="$case_directory/runner" \
    EAS_ENV_READY="true" \
    APP_VARIANT="$([[ "$ref" == "refs/heads/main" ]] && echo production || echo preview)" \
    EXPO_PUBLIC_API_PROXY_URL="https://api.example.test" \
    EXPO_PUBLIC_SUPABASE_ANON_KEY="test-anon-key" \
    EXPO_PUBLIC_SUPABASE_URL="https://supabase.example.test" \
    GOOGLE_SERVICES_JSON="$google_services_file" \
    MOCK_GOOGLE_SERVICES_JSON="$google_services_file" \
    MOCK_GITHUB_BASELINE="$github_baseline" \
    MOCK_COMPATIBLE_BUILD="$compatible_build" \
    MOCK_UPLOAD_FAIL="$upload_fail" \
    MOCK_SUPABASE_KEY_VALID="$supabase_key_valid" \
    FORCE_PREVIEW_APK="$force_preview_apk" \
    MOCK_EAS_LOG="$case_directory/eas.log" \
    MOCK_GH_LOG="$case_directory/gh.log" \
    MOCK_SUPABASE_VALIDATION_LOG="$case_directory/supabase-validation.log" \
    REAL_NODE="$real_node" \
    "$bash_command" "$script_directory/ci-deploy-android.sh"
}

assert_eas_commands() {
  local case_name="$1"
  local expected="$2"
  local actual
  actual="$(awk '{ values = values separator $1; separator = " " } END { print values }' \
    "$test_directory/$case_name/eas.log")"
  if [[ "$actual" != "$expected" ]]; then
    printf 'Unexpected Preview EAS commands for %s: %s\n' "$case_name" "$actual" >&2
    exit 1
  fi
}

run_deployment "preview-ota" "refs/heads/develop" "trusted" "false"
grep -Fxq "mode=ota" "$test_directory/preview-ota/output"
grep -Fxq "environment=preview" "$test_directory/preview-ota/output"
grep -Fq "update --channel preview --environment preview" "$test_directory/preview-ota/eas.log"
grep -Fq "/actions/workflows/ci.yml" "$test_directory/preview-ota/gh.log"
grep -Fq "/actions/artifacts?name=gonggu-wish-preview-runtime-" \
  "$test_directory/preview-ota/gh.log"
grep -Fq "/actions/runs/42" "$test_directory/preview-ota/gh.log"
grep -Fq "run download 42" "$test_directory/preview-ota/gh.log"
grep -Fq "/actions/artifacts/456" "$test_directory/preview-ota/gh.log"
grep -Fq "validate-supabase-public-config.mjs" \
  "$test_directory/preview-ota/supabase-validation.log"
assert_eas_commands "preview-ota" "fingerprint:generate update"
if grep -Eq "build:list|build --platform|upload --platform" \
  "$test_directory/preview-ota/eas.log"; then
  echo "Preview OTA unexpectedly used an EAS build record" >&2
  exit 1
fi

if run_deployment \
  "preview-invalid-supabase-key" \
  "refs/heads/develop" \
  "trusted" \
  "false" \
  "false" \
  "false" \
  "false"; then
  echo "A revoked Preview Supabase key unexpectedly passed validation" >&2
  exit 1
fi
if [[ -s "$test_directory/preview-invalid-supabase-key/eas.log" ]]; then
  echo "A revoked Preview Supabase key reached EAS deployment" >&2
  exit 1
fi

run_deployment \
  "preview-forced-build" \
  "refs/heads/develop" \
  "trusted" \
  "false" \
  "false" \
  "true"
grep -Fxq "mode=build" "$test_directory/preview-forced-build/output"
grep -Fq "build --platform android --profile preview --local" \
  "$test_directory/preview-forced-build/eas.log"
assert_eas_commands "preview-forced-build" "fingerprint:generate build"
if [[ -s "$test_directory/preview-forced-build/gh.log" ]]; then
  echo "Forced Preview APK build unexpectedly queried an existing baseline" >&2
  exit 1
fi

run_deployment \
  "preview-ota-candidate-fallback" \
  "refs/heads/develop" \
  "candidate-fallback" \
  "false"
grep -Fxq "mode=ota" "$test_directory/preview-ota-candidate-fallback/output"
grep -Fq "/actions/runs/41" "$test_directory/preview-ota-candidate-fallback/gh.log"
grep -Fq "/actions/runs/42" "$test_directory/preview-ota-candidate-fallback/gh.log"
assert_eas_commands \
  "preview-ota-candidate-fallback" \
  "fingerprint:generate update"

for baseline in \
  missing \
  expired \
  failed \
  wrong-workflow \
  bad-manifest \
  bad-apk \
  api-error; do
  case_name="preview-build-$baseline"
  run_deployment "$case_name" "refs/heads/develop" "$baseline" "true" "true"
  grep -Fxq "mode=build" "$test_directory/$case_name/output"
  if grep -q '^expo-url=' "$test_directory/$case_name/output"; then
    echo "A Preview-only APK unexpectedly published an Expo URL output" >&2
    exit 1
  fi
  grep -Fxq \
    "artifact-name=gonggu-wish-preview-runtime-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
    "$test_directory/$case_name/output"
  grep -Eq '^apk-sha256=[0-9a-f]{64}$' "$test_directory/$case_name/output"
  grep -Fq "build --platform android --profile preview --local" \
    "$test_directory/$case_name/eas.log"
  grep -Fq "GitHub Actions artifact only" "$test_directory/$case_name/summary"
  assert_eas_commands "$case_name" "fingerprint:generate build"
  if grep -Eq "build:list|upload --platform" "$test_directory/$case_name/eas.log"; then
    echo "Preview build unexpectedly queried or uploaded an EAS build" >&2
    exit 1
  fi
done
grep -Fxq 'org.gradle.parallel=false' \
  "$test_directory/preview-build-missing/runner/gradle-user-home/gradle.properties"

run_deployment "production-ota" "refs/heads/main" "missing" "true"
grep -Fxq "mode=ota" "$test_directory/production-ota/output"
grep -Fq "update --channel production --environment production" "$test_directory/production-ota/eas.log"
if grep -Fq -- "--app-identifier" "$test_directory/production-ota/eas.log"; then
  echo "Android uploaded builds must be looked up without an app identifier filter" >&2
  exit 1
fi

if run_deployment \
  "production-forced-preview-build" \
  "refs/heads/main" \
  "missing" \
  "true" \
  "false" \
  "true"; then
  echo "Production unexpectedly accepted the Preview-only force build flag" >&2
  exit 1
fi

run_deployment "production-build" "refs/heads/main" "missing" "false"
grep -Fxq "mode=build" "$test_directory/production-build/output"
grep -Fxq "environment=production" "$test_directory/production-build/output"
grep -Fxq "artifact-name=gonggu-wish-production-abc123" \
  "$test_directory/production-build/output"
grep -Fq "build --platform android --profile production-apk --local" "$test_directory/production-build/eas.log"
grep -Fq "upload --platform android" "$test_directory/production-build/eas.log"
grep -Fq "expo-url=https://expo.dev/artifacts/test.apk" "$test_directory/production-build/output"

if run_deployment \
  "production-build-upload-failure" \
  "refs/heads/main" \
  "missing" \
  "false" \
  "true"; then
  echo "Production unexpectedly tolerated an EAS upload failure" >&2
  exit 1
fi

failed_output="$test_directory/production-build-upload-failure/output"
grep -Fxq "mode=build" "$failed_output"
grep -Fxq "environment=production" "$failed_output"
grep -Fxq "fingerprint=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  "$failed_output"
grep -Fxq "artifact-name=gonggu-wish-production-abc123" "$failed_output"
failed_apk_path="$(grep '^apk-path=' "$failed_output" | cut -d= -f2-)"
[[ -s "$failed_apk_path" ]]
grep -Eq '^apk-sha256=[0-9a-f]{64}$' "$failed_output"
expected_apk_sha256="$(
  node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update("test-apk").digest("hex"))'
)"
grep -Fxq "apk-sha256=$expected_apk_sha256" "$failed_output"
if grep -q '^expo-url=' "$failed_output"; then
  echo "A failed EAS upload unexpectedly published an Expo URL output" >&2
  exit 1
fi
if grep -q '^eas-registration=' "$failed_output"; then
  echo "A failed EAS upload unexpectedly published a registration state" >&2
  exit 1
fi
[[ ! -s "$test_directory/production-build-upload-failure/summary" ]]
grep -Fq "upload --platform android" \
  "$test_directory/production-build-upload-failure/eas.log"

for false_quota_match in \
  quota-phrase-only \
  quota-reset-only \
  quota-near-match \
  quota-mixed-error; do
  case_name="production-build-upload-$false_quota_match"
  if run_deployment \
    "$case_name" \
    "refs/heads/main" \
    "missing" \
    "false" \
    "$false_quota_match"; then
    echo "Production unexpectedly accepted $false_quota_match as a quota fallback" >&2
    exit 1
  fi
  false_match_output="$test_directory/$case_name/output"
  grep -Fxq "mode=build" "$false_match_output"
  grep -Eq '^apk-sha256=[0-9a-f]{64}$' "$false_match_output"
  if grep -Eq '^(eas-registration|expo-url)=' "$false_match_output"; then
    echo "A false quota match unexpectedly published successful EAS outputs" >&2
    exit 1
  fi
  [[ ! -s "$test_directory/$case_name/summary" ]]
done

run_deployment \
  "production-build-upload-quota" \
  "refs/heads/main" \
  "missing" \
  "false" \
  "quota"
quota_output="$test_directory/production-build-upload-quota/output"
grep -Fxq "mode=build" "$quota_output"
grep -Fxq "environment=production" "$quota_output"
grep -Fxq "eas-registration=quota-exhausted" "$quota_output"
if grep -q '^expo-url=' "$quota_output"; then
  echo "A quota-deferred EAS registration unexpectedly published an Expo URL output" >&2
  exit 1
fi
quota_apk_path="$(grep '^apk-path=' "$quota_output" | cut -d= -f2-)"
[[ -s "$quota_apk_path" ]]
grep -Eq '^apk-sha256=[0-9a-f]{64}$' "$quota_output"
grep -Fq "upload --platform android" \
  "$test_directory/production-build-upload-quota/eas.log"
grep -Fq "GitHub Actions artifact only" \
  "$test_directory/production-build-upload-quota/summary"
grep -Fq "OTA baseline was not registered" \
  "$test_directory/production-build-upload-quota/summary"

run_deployment \
  "production-build-upload-quota-repeat" \
  "refs/heads/main" \
  "missing" \
  "false" \
  "quota"
assert_eas_commands \
  "production-build-upload-quota-repeat" \
  "fingerprint:generate build:list build upload"
if grep -Fq "update --channel production" \
  "$test_directory/production-build-upload-quota-repeat/eas.log"; then
  echo "A quota-deferred APK was incorrectly treated as an EAS OTA baseline" >&2
  exit 1
fi

apk_path="$(grep '^apk-path=' "$test_directory/production-build/output" | cut -d= -f2-)"
[[ -s "$apk_path" ]]

wrapped_directory="$test_directory/wrapped-preview"
mkdir -p "$wrapped_directory/runner"
(
  cd "$script_directory/.."
  PATH="$fake_bin:$PATH" \
    GITHUB_REF="refs/heads/develop" \
    GITHUB_SHA="abc123" \
    GITHUB_REPOSITORY="SooYoungJang/GongGu_Wish" \
    GH_TOKEN="test-token" \
    GITHUB_OUTPUT="$wrapped_directory/output" \
    GITHUB_STEP_SUMMARY="$wrapped_directory/summary" \
    RUNNER_TEMP="$wrapped_directory/runner" \
    MOCK_GOOGLE_SERVICES_JSON="$preview_google_services" \
    MOCK_GITHUB_BASELINE="trusted" \
    MOCK_COMPATIBLE_BUILD="false" \
    MOCK_EAS_LOG="$wrapped_directory/eas.log" \
    MOCK_GH_LOG="$wrapped_directory/gh.log" \
    "$bash_command" scripts/ci-deploy-android.sh
)
grep -Fxq "mode=ota" "$wrapped_directory/output"
grep -Fq "env:get preview --variable-name GOOGLE_SERVICES_JSON --format short" \
  "$wrapped_directory/eas.log"
grep -Fq "env:exec preview bash scripts/ci-deploy-android.sh" "$wrapped_directory/eas.log"

wrapped_production_directory="$test_directory/wrapped-production"
mkdir -p "$wrapped_production_directory/runner"
(
  cd "$script_directory/.."
  PATH="$fake_bin:$PATH" \
    GITHUB_REF="refs/heads/main" \
    GITHUB_SHA="abc123" \
    GITHUB_OUTPUT="$wrapped_production_directory/output" \
    GITHUB_STEP_SUMMARY="$wrapped_production_directory/summary" \
    RUNNER_TEMP="$wrapped_production_directory/runner" \
    MOCK_GOOGLE_SERVICES_JSON="$production_google_services" \
    MOCK_COMPATIBLE_BUILD="true" \
    MOCK_EAS_LOG="$wrapped_production_directory/eas.log" \
    "$bash_command" scripts/ci-deploy-android.sh
)
grep -Fxq "mode=ota" "$wrapped_production_directory/output"
grep -Fxq "environment=production" "$wrapped_production_directory/output"
grep -Fq "env:get production --variable-name GOOGLE_SERVICES_JSON --format short" \
  "$wrapped_production_directory/eas.log"
grep -Fq "env:exec production bash scripts/ci-deploy-android.sh" \
  "$wrapped_production_directory/eas.log"

invalid_ref_directory="$test_directory/invalid-ref"
mkdir -p "$invalid_ref_directory/runner"
if GITHUB_REF="refs/heads/feature" \
  GITHUB_OUTPUT="$invalid_ref_directory/output" \
  GITHUB_STEP_SUMMARY="$invalid_ref_directory/summary" \
  RUNNER_TEMP="$invalid_ref_directory/runner" \
  "$bash_command" "$script_directory/ci-deploy-android.sh" >/dev/null 2>&1; then
  echo "Unsupported branch unexpectedly passed deployment validation" >&2
  exit 1
fi

missing_env_directory="$test_directory/missing-env"
mkdir -p "$missing_env_directory/runner"
if PATH="$fake_bin:$PATH" \
  GITHUB_REF="refs/heads/develop" \
  GITHUB_OUTPUT="$missing_env_directory/output" \
  GITHUB_STEP_SUMMARY="$missing_env_directory/summary" \
  RUNNER_TEMP="$missing_env_directory/runner" \
  EAS_ENV_READY="true" \
  APP_VARIANT="preview" \
  EXPO_PUBLIC_API_PROXY_URL="" \
  EXPO_PUBLIC_SUPABASE_ANON_KEY="test-anon-key" \
  EXPO_PUBLIC_SUPABASE_URL="https://supabase.example.test" \
  GOOGLE_SERVICES_JSON="$preview_google_services" \
  "$bash_command" "$script_directory/ci-deploy-android.sh" >/dev/null 2>&1; then
  echo "Missing backend environment unexpectedly passed validation" >&2
  exit 1
fi

missing_firebase_directory="$test_directory/missing-firebase"
mkdir -p "$missing_firebase_directory/runner"
if PATH="$fake_bin:$PATH" \
  GITHUB_REF="refs/heads/develop" \
  GITHUB_OUTPUT="$missing_firebase_directory/output" \
  GITHUB_STEP_SUMMARY="$missing_firebase_directory/summary" \
  RUNNER_TEMP="$missing_firebase_directory/runner" \
  EAS_ENV_READY="true" \
  APP_VARIANT="preview" \
  EXPO_PUBLIC_API_PROXY_URL="https://api.example.test" \
  EXPO_PUBLIC_SUPABASE_ANON_KEY="test-anon-key" \
  EXPO_PUBLIC_SUPABASE_URL="https://supabase.example.test" \
  GOOGLE_SERVICES_JSON="" \
  "$bash_command" "$script_directory/ci-deploy-android.sh" >/dev/null 2>&1; then
  echo "Missing Firebase environment unexpectedly passed validation" >&2
  exit 1
fi

mismatched_firebase_directory="$test_directory/mismatched-firebase"
mkdir -p "$mismatched_firebase_directory/runner"
if PATH="$fake_bin:$PATH" \
  GITHUB_REF="refs/heads/develop" \
  GITHUB_OUTPUT="$mismatched_firebase_directory/output" \
  GITHUB_STEP_SUMMARY="$mismatched_firebase_directory/summary" \
  RUNNER_TEMP="$mismatched_firebase_directory/runner" \
  EAS_ENV_READY="true" \
  APP_VARIANT="preview" \
  EXPO_PUBLIC_API_PROXY_URL="https://api.example.test" \
  EXPO_PUBLIC_SUPABASE_ANON_KEY="test-anon-key" \
  EXPO_PUBLIC_SUPABASE_URL="https://supabase.example.test" \
  GOOGLE_SERVICES_JSON="$production_google_services" \
  MOCK_COMPATIBLE_BUILD="true" \
  MOCK_UPLOAD_FAIL="false" \
  MOCK_EAS_LOG="$mismatched_firebase_directory/eas.log" \
  "$bash_command" "$script_directory/ci-deploy-android.sh" >/dev/null 2>&1; then
  echo "Mismatched Firebase package unexpectedly passed validation" >&2
  exit 1
fi

echo "ci-deploy-android tests passed"
