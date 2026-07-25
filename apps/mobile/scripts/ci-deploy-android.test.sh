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
    if [[ "${MOCK_UPLOAD_FAIL:-false}" == "true" ]]; then
      echo "EAS upload quota exhausted" >&2
      exit 1
    fi
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

run_deployment() {
  local name="$1"
  local ref="$2"
  local compatible_build="$3"
  local upload_fail="${4:-false}"
  local case_directory="$test_directory/$name"
  local google_services_file="$preview_google_services"
  if [[ "$ref" == "refs/heads/main" ]]; then
    google_services_file="$production_google_services"
  fi
  mkdir -p "$case_directory/runner"

  PATH="$fake_bin:$PATH" \
    GITHUB_REF="$ref" \
    GITHUB_SHA="abc123" \
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
    MOCK_COMPATIBLE_BUILD="$compatible_build" \
    MOCK_UPLOAD_FAIL="$upload_fail" \
    MOCK_EAS_LOG="$case_directory/eas.log" \
    "$bash_command" "$script_directory/ci-deploy-android.sh"
}

run_deployment "preview-ota" "refs/heads/develop" "true"
grep -Fxq "mode=ota" "$test_directory/preview-ota/output"
grep -Fxq "environment=preview" "$test_directory/preview-ota/output"
grep -Fq "update --channel preview --environment preview" "$test_directory/preview-ota/eas.log"
if grep -Fq -- "--app-identifier" "$test_directory/preview-ota/eas.log"; then
  echo "Android uploaded builds must be looked up without an app identifier filter" >&2
  exit 1
fi
if grep -Fq "build --platform" "$test_directory/preview-ota/eas.log"; then
  echo "Preview OTA case unexpectedly started a build" >&2
  exit 1
fi

run_deployment "preview-build" "refs/heads/develop" "false"
grep -Fxq "mode=build" "$test_directory/preview-build/output"
grep -Fq "build --platform android --profile preview --local" "$test_directory/preview-build/eas.log"
grep -Fxq 'org.gradle.parallel=false' \
  "$test_directory/preview-build/runner/gradle-user-home/gradle.properties"

run_deployment "preview-build-upload-fallback" "refs/heads/develop" "false" "true"
grep -Fxq "mode=build" "$test_directory/preview-build-upload-fallback/output"
grep -Fxq "expo-url=" "$test_directory/preview-build-upload-fallback/output"
grep -Fq "Expo upload: unavailable" \
  "$test_directory/preview-build-upload-fallback/summary"

run_deployment "production-ota" "refs/heads/main" "true"
grep -Fxq "mode=ota" "$test_directory/production-ota/output"
grep -Fq "update --channel production --environment production" "$test_directory/production-ota/eas.log"
if grep -Fq -- "--app-identifier" "$test_directory/production-ota/eas.log"; then
  echo "Android uploaded builds must be looked up without an app identifier filter" >&2
  exit 1
fi

run_deployment "production-build" "refs/heads/main" "false"
grep -Fxq "mode=build" "$test_directory/production-build/output"
grep -Fxq "environment=production" "$test_directory/production-build/output"
grep -Fq "build --platform android --profile production-apk --local" "$test_directory/production-build/eas.log"
grep -Fq "upload --platform android" "$test_directory/production-build/eas.log"
grep -Fq "expo-url=https://expo.dev/artifacts/test.apk" "$test_directory/production-build/output"

if run_deployment \
  "production-build-upload-failure" \
  "refs/heads/main" \
  "false" \
  "true"; then
  echo "Production unexpectedly tolerated an EAS upload failure" >&2
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
    GITHUB_OUTPUT="$wrapped_directory/output" \
    GITHUB_STEP_SUMMARY="$wrapped_directory/summary" \
    RUNNER_TEMP="$wrapped_directory/runner" \
    MOCK_GOOGLE_SERVICES_JSON="$preview_google_services" \
    MOCK_COMPATIBLE_BUILD="true" \
    MOCK_EAS_LOG="$wrapped_directory/eas.log" \
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
