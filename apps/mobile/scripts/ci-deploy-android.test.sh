#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_directory="$(mktemp -d)"
fake_bin="$test_directory/bin"
mkdir -p "$fake_bin"
trap 'rm -rf "$test_directory"' EXIT

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
  env:exec)
    environment_name="${1:?environment is required}"
    command_string="${2:?command is required}"
    export APP_VARIANT="$environment_name"
    export EXPO_PUBLIC_API_PROXY_URL="https://api.example.test"
    export EXPO_PUBLIC_SUPABASE_ANON_KEY="test-anon-key"
    export EXPO_PUBLIC_SUPABASE_URL="https://supabase.example.test"
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
  local case_directory="$test_directory/$name"
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
    MOCK_COMPATIBLE_BUILD="$compatible_build" \
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
    MOCK_COMPATIBLE_BUILD="true" \
    MOCK_EAS_LOG="$wrapped_directory/eas.log" \
    "$bash_command" scripts/ci-deploy-android.sh
)
grep -Fxq "mode=ota" "$wrapped_directory/output"
grep -Fq "env:exec preview bash scripts/ci-deploy-android.sh" "$wrapped_directory/eas.log"

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
  "$bash_command" "$script_directory/ci-deploy-android.sh" >/dev/null 2>&1; then
  echo "Missing backend environment unexpectedly passed validation" >&2
  exit 1
fi

echo "ci-deploy-android tests passed"
