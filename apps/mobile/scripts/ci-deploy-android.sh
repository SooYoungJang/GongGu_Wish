#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${GITHUB_REF:-}" in
  refs/heads/main)
    environment="production"
    profile="production-apk"
    channel="production"
    ;;
  refs/heads/develop)
    environment="preview"
    profile="preview"
    channel="preview"
    ;;
  *)
    echo "::error::Android deployment only supports main and develop."
    exit 1
    ;;
esac

force_preview_apk="${FORCE_PREVIEW_APK:-false}"
if [[ "$force_preview_apk" != "true" && "$force_preview_apk" != "false" ]]; then
  echo "::error::FORCE_PREVIEW_APK must be true or false."
  exit 1
fi
if [[ "$force_preview_apk" == "true" && "$environment" != "preview" ]]; then
  echo "::error::FORCE_PREVIEW_APK is restricted to the Preview environment."
  exit 1
fi

for internal_ota_variable in \
  GONGGU_OTA_RUNTIME_VERSION \
  GONGGU_OTA_ADMOB_MODE \
  GONGGU_OTA_AD_REQUESTS_ENABLED; do
  if [[ -n "${!internal_ota_variable:-}" ]]; then
    echo "::error::$internal_ota_variable is internal to the OTA publish command and must not be preset."
    exit 1
  fi
done

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}"

if [[ "${EAS_ENV_READY:-}" != "true" ]]; then
  google_services_path="$RUNNER_TEMP/google-services.$environment.json"
  google_services_variable="$(
    eas env:get "$environment" \
      --variable-name GOOGLE_SERVICES_JSON \
      --format short \
      --non-interactive
  )"
  GOOGLE_SERVICES_VARIABLE="$google_services_variable" \
    node - "$google_services_path" <<'NODE'
const fs = require("node:fs");

const outputPath = process.argv[2];
const output = process.env.GOOGLE_SERVICES_VARIABLE ?? "";
const valuePrefix = "GOOGLE_SERVICES_JSON=";
const valueStart = output.indexOf(valuePrefix);
if (valueStart < 0) {
  throw new Error(
    "Could not read GOOGLE_SERVICES_JSON from the selected EAS environment",
  );
}
const fileContents = output.slice(valueStart + valuePrefix.length).trim();
JSON.parse(fileContents);
fs.writeFileSync(outputPath, `${fileContents}\n`, { mode: 0o600 });
fs.chmodSync(outputPath, 0o600);
NODE
  export GOOGLE_SERVICES_JSON="$google_services_path"
  trap 'rm -f "$google_services_path"' EXIT

  EAS_ENV_READY=true \
    APP_VARIANT="$environment" \
    FORCE_PREVIEW_APK="$force_preview_apk" \
    GOOGLE_SERVICES_JSON="$google_services_path" \
    eas env:exec "$environment" \
    'bash scripts/ci-deploy-android.sh' \
    --non-interactive
  exit 0
fi

required_environment_variables=(
  APP_VARIANT
  EXPO_PUBLIC_API_PROXY_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  EXPO_PUBLIC_SUPABASE_URL
  GOOGLE_SERVICES_JSON
)

for variable_name in "${required_environment_variables[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "::error::$variable_name is required for the $environment Android deployment."
    exit 1
  fi
done

if [[ "$APP_VARIANT" != "$environment" ]]; then
  echo "::error::APP_VARIANT must be $environment, received $APP_VARIANT."
  exit 1
fi

profile_ads_environment="$(
  PROFILE="$profile" EAS_JSON_PATH="$script_directory/../eas.json" node <<'NODE'
const fs = require("node:fs");

const eas = JSON.parse(fs.readFileSync(process.env.EAS_JSON_PATH, "utf8"));
const profiles = eas.build ?? {};

function resolveProfile(name, resolving = new Set()) {
  if (resolving.has(name)) throw new Error(`Circular EAS profile: ${name}`);
  const profile = profiles[name];
  if (!profile) throw new Error(`Unknown EAS build profile: ${name}`);
  const nextResolving = new Set(resolving).add(name);
  const parent = profile.extends
    ? resolveProfile(profile.extends, nextResolving)
    : {};
  return { ...parent, ...profile, env: { ...parent.env, ...profile.env } };
}

const profile = resolveProfile(process.env.PROFILE);
const mode = profile.env?.EXPO_PUBLIC_ADMOB_MODE;
const requestsEnabled = profile.env?.EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED;
if (!/^(?:off|test|production)$/.test(mode ?? "")) {
  throw new Error("Build profile must define EXPO_PUBLIC_ADMOB_MODE");
}
if (!/^(?:true|false)$/.test(requestsEnabled ?? "")) {
  throw new Error(
    "Build profile must define EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED",
  );
}
process.stdout.write(`${mode}\n${requestsEnabled}\n`);
NODE
)"
mapfile -t profile_ads_values <<<"$profile_ads_environment"
if [[ "${#profile_ads_values[@]}" -ne 2 ]]; then
  echo "::error::Could not resolve the Android build profile ad environment."
  exit 1
fi
if [[ -n "${EXPO_PUBLIC_ADMOB_MODE:-}" && \
  "$EXPO_PUBLIC_ADMOB_MODE" != "${profile_ads_values[0]}" ]]; then
  echo "::error::The EAS environment AdMob mode does not match build profile $profile."
  exit 1
fi
if [[ -n "${EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED:-}" && \
  "$EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED" != "${profile_ads_values[1]}" ]]; then
  echo "::error::The EAS environment AdMob request setting does not match build profile $profile."
  exit 1
fi
export EXPO_PUBLIC_ADMOB_MODE="${profile_ads_values[0]}"
export EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED="${profile_ads_values[1]}"

node <<'NODE'
const fs = require("node:fs");

const expectedPackage =
  process.env.APP_VARIANT === "production"
    ? "com.gonggu.wish"
    : "com.gonggu.wish.preview";
const filePath = process.env.GOOGLE_SERVICES_JSON;
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch {
  throw new Error(
    `GOOGLE_SERVICES_JSON must be a readable JSON file for ${expectedPackage}`,
  );
}

const packageNames = Array.isArray(firebaseConfig.client)
  ? firebaseConfig.client
      .map(
        (client) =>
          client?.client_info?.android_client_info?.package_name,
      )
      .filter((packageName) => typeof packageName === "string")
  : [];
if (!packageNames.includes(expectedPackage)) {
  throw new Error(
    `GOOGLE_SERVICES_JSON does not contain Android package ${expectedPackage}`,
  );
}
NODE

node "$script_directory/validate-supabase-public-config.mjs"

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  echo "::add-mask::$EXPO_PUBLIC_SUPABASE_ANON_KEY"
fi

public_build_config_path="$script_directory/../src/lib/public-build-config.ts"
public_build_config_backup="$RUNNER_TEMP/public-build-config.$$.ts"
android_bundle_path=""
cp "$public_build_config_path" "$public_build_config_backup"
restore_public_build_config() {
  cp "$public_build_config_backup" "$public_build_config_path"
  rm -f "$public_build_config_backup"
  if [[ -n "$android_bundle_path" ]]; then
    rm -f "$android_bundle_path"
  fi
}
trap restore_public_build_config EXIT

node "$script_directory/materialize-public-build-config.mjs" \
  "$public_build_config_path"

fingerprint_json="$(
  eas fingerprint:generate \
    --platform android \
    --build-profile "$profile" \
    --json \
    --non-interactive
)"

fingerprint_hash="$(
  node -e '
    const fs = require("node:fs");
    const value = JSON.parse(fs.readFileSync(0, "utf8"));
    const hash = value.hash ?? value.fingerprint?.hash;
    if (typeof hash !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(hash)) {
      throw new Error("EAS fingerprint output did not include a valid hash");
    }
    process.stdout.write(hash);
  ' <<<"$fingerprint_json"
)"

publish_ota() {
  local compatibility_label="$1"
  local compatibility_id="$2"

  local runtime_config_json
  runtime_config_json="$(
    EXPO_NO_DOTENV=1 \
      GONGGU_OTA_RUNTIME_VERSION="$fingerprint_hash" \
      GONGGU_OTA_ADMOB_MODE="${profile_ads_values[0]}" \
      GONGGU_OTA_AD_REQUESTS_ENABLED="${profile_ads_values[1]}" \
      npx expo config --type public --json
  )"
  printf '%s' "$runtime_config_json" | \
    node "$script_directory/validate-ota-runtime.mjs" \
      config "$fingerprint_hash" \
      "${profile_ads_values[0]}" "${profile_ads_values[1]}"

  local update_json
  update_json="$(
    GONGGU_OTA_RUNTIME_VERSION="$fingerprint_hash" \
      GONGGU_OTA_ADMOB_MODE="${profile_ads_values[0]}" \
      GONGGU_OTA_AD_REQUESTS_ENABLED="${profile_ads_values[1]}" \
      eas update \
        --channel "$channel" \
        --environment "$environment" \
        --platform android \
        --message "$environment: ${GITHUB_SHA:-manual}" \
        --json \
        --non-interactive
  )"

  printf '%s' "$update_json" | \
    node "$script_directory/validate-ota-runtime.mjs" \
      update "$fingerprint_hash"

  {
    echo "mode=ota"
    echo "environment=$environment"
    echo "fingerprint=$fingerprint_hash"
  } >>"$GITHUB_OUTPUT"

  {
    echo "## Android OTA update"
    echo ""
    echo "- Environment: \`$environment\`"
    echo "- $compatibility_label: \`$compatibility_id\`"
    echo "- Fingerprint: \`$fingerprint_hash\`"
    echo "- Runtime version: \`$fingerprint_hash\`"
  } >>"$GITHUB_STEP_SUMMARY"
  exit 0
}

is_eas_local_build_quota_error() {
  node - "$1" <<'NODE'
const fs = require("node:fs");

const lines = fs
  .readFileSync(process.argv[2], "utf8")
  .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
  .replace(/\r/g, "\n")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
const quotaIndex = lines.findIndex((line) =>
  /^This account has used its local builds from the free plan this month, which will reset .+\(on [^)]+\)\.$/.test(
    line,
  ),
);
const tail = quotaIndex >= 0 ? lines.slice(quotaIndex) : [];
const isExpectedQuotaFailure =
  tail.length === 3 &&
  /^Request ID: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    tail[1] ?? "",
  ) &&
  /^Error: GraphQL request failed\.$/.test(tail[2] ?? "");
process.exitCode = isExpectedQuotaFailure ? 0 : 1;
NODE
}

if [[ "$environment" == "preview" ]]; then
  if [[ "$force_preview_apk" != "true" ]]; then
    preview_baseline_artifact_id="$(
      node "$script_directory/find-preview-runtime-baseline.mjs" "$fingerprint_hash"
    )"

    if [[ -n "$preview_baseline_artifact_id" ]]; then
      publish_ota "GitHub baseline artifact" "$preview_baseline_artifact_id"
    fi
  fi
else
  # Android APK uploads retain the fingerprint but not the app identifier metadata.
  compatible_builds_json="$(
    eas build:list \
      --platform android \
      --status finished \
      --fingerprint-hash "$fingerprint_hash" \
      --limit 1 \
      --json \
      --non-interactive
  )"

  compatible_build_id="$(
    node -e '
      const fs = require("node:fs");
      const value = JSON.parse(fs.readFileSync(0, "utf8"));
      const builds = Array.isArray(value) ? value : value.builds ?? [];
      const id = builds[0]?.id ?? "";
      if (id !== "" && !/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
        throw new Error("EAS build list returned an invalid build ID");
      }
      process.stdout.write(id);
    ' <<<"$compatible_builds_json"
  )"

  if [[ -n "$compatible_build_id" ]]; then
    publish_ota "Compatible EAS build" "$compatible_build_id"
  fi
fi

gradle_user_home="$RUNNER_TEMP/gradle-user-home"
mkdir -p "$gradle_user_home"
printf '%s\n' \
  'org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g -Dfile.encoding=UTF-8' \
  'org.gradle.workers.max=2' \
  'org.gradle.parallel=false' \
  'kotlin.daemon.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g' \
  >"$gradle_user_home/gradle.properties"
export GRADLE_USER_HOME="$gradle_user_home"

artifact_directory="$RUNNER_TEMP/mobile-apk"
apk_path="$artifact_directory/gonggu-wish-$environment-${GITHUB_SHA:-local}.apk"
mkdir -p "$artifact_directory"

eas build \
  --platform android \
  --profile "$profile" \
  --local \
  --output "$apk_path" \
  --freeze-credentials \
  --non-interactive

if [[ ! -s "$apk_path" ]]; then
  echo "::error::Local Android build did not produce an APK."
  exit 1
fi

# Hermes bytecode is binary. Scanning its raw bytes can join unrelated binary
# regions into a JWT-shaped false positive, so validate only logical strings
# emitted by the Hermes disassembler.
android_bundle_path="$RUNNER_TEMP/index.android.$$.bundle"
unzip -p "$apk_path" assets/index.android.bundle >"$android_bundle_path"

hermesc_path="${HERMESC_BINARY:-}"
if [[ -z "$hermesc_path" ]]; then
  hermesc_path="$(node "$script_directory/resolve-hermesc-path.mjs")"
fi
if [[ ! -x "$hermesc_path" ]]; then
  echo "::error::Hermes disassembler is not executable."
  exit 1
fi

"$hermesc_path" -b -dump-bytecode "$android_bundle_path" | \
  node "$script_directory/validate-supabase-public-config.mjs" \
    --bundle-stdin

apk_sha256="$(
  node -e '
    const { createHash } = require("node:crypto");
    const { readFileSync } = require("node:fs");
    process.stdout.write(
      createHash("sha256").update(readFileSync(process.argv[1])).digest("hex"),
    );
  ' "$apk_path"
)"

if [[ "$environment" == "preview" ]]; then
  apk_artifact_name="gonggu-wish-preview-runtime-$fingerprint_hash"
else
  apk_artifact_name="gonggu-wish-production-${GITHUB_SHA:-local}"
fi

{
  echo "mode=build"
  echo "environment=$environment"
  echo "fingerprint=$fingerprint_hash"
  echo "apk-path=$apk_path"
  echo "artifact-name=$apk_artifact_name"
  echo "apk-sha256=$apk_sha256"
} >>"$GITHUB_OUTPUT"

eas_registration="not-requested"
expo_url=""
if [[ "$environment" == "production" ]]; then
  upload_stderr_path="$RUNNER_TEMP/eas-upload.stderr"
  rm -f "$upload_stderr_path"
  if upload_json="$(
    # Register Production local builds with EAS when the account quota permits
    # so they can become compatibility baselines for later OTA updates.
    eas upload \
      --platform android \
      --build-path "$apk_path" \
      --fingerprint "$fingerprint_hash" \
      --json \
      --non-interactive \
      2>"$upload_stderr_path"
  )"; then
    upload_succeeded="true"
  else
    upload_succeeded="false"
  fi
  while IFS= read -r upload_log_line; do
    printf '%s\n' "$upload_log_line" >&2
  done <"$upload_stderr_path"

  if [[ "$upload_succeeded" == "true" ]]; then
    eas_registration="registered"
    expo_url="$(
      node -e '
      const fs = require("node:fs");
      const value = JSON.parse(fs.readFileSync(0, "utf8"));
      const seen = new Set();
      const urls = [];
      const ids = [];

      function visit(node, key = "") {
        if (node === null || node === undefined || seen.has(node)) return;
        if (typeof node === "string") {
          if (/^https:\/\//.test(node) && /url|uri|link|artifact|download/i.test(key)) {
            urls.push(node);
          }
          if (/^[0-9a-f-]{20,}$/i.test(node) && /(^|_)id$/i.test(key)) {
            ids.push(node);
          }
          return;
        }
        if (typeof node !== "object") return;
        seen.add(node);
        for (const [childKey, child] of Object.entries(node)) visit(child, childKey);
      }

      visit(value);
      const preferred = urls.find((url) => /\.apk(?:\?|$)/i.test(url))
        ?? urls.find((url) => /expo\.dev/i.test(url))
        ?? urls[0];
      const fallback = ids[0]
        ? `https://expo.dev/accounts/sooyoung.jang/projects/gonggu-wish/builds/${ids[0]}`
        : "";
      const candidate = preferred ?? fallback;
      if (candidate) {
        const parsed = new URL(candidate);
        if (parsed.protocol !== "https:") {
          throw new Error("EAS upload returned a non-HTTPS URL");
        }
        process.stdout.write(parsed.href);
      }
      ' <<<"$upload_json"
    )"
  elif is_eas_local_build_quota_error "$upload_stderr_path"; then
    eas_registration="quota-exhausted"
    echo "::warning::EAS local-build quota is exhausted; preserving the verified Production APK as a GitHub Actions artifact without registering an OTA baseline."
  else
    rm -f "$upload_stderr_path"
    echo "::error::EAS upload failed for the Production APK."
    exit 1
  fi
  rm -f "$upload_stderr_path"
  echo "eas-registration=$eas_registration" >>"$GITHUB_OUTPUT"
  if [[ "$eas_registration" == "registered" ]]; then
    echo "expo-url=$expo_url" >>"$GITHUB_OUTPUT"
  fi
else
  echo "eas-registration=$eas_registration" >>"$GITHUB_OUTPUT"
fi

{
  echo "## Android local APK build"
  echo ""
  echo "- Environment: \`$environment\`"
  echo "- Builder: GitHub Actions runner (local EAS build)"
  echo "- Fingerprint: \`$fingerprint_hash\`"
  if [[ "$environment" == "preview" ]]; then
    echo "- Distribution: GitHub Actions artifact only"
  elif [[ -n "$expo_url" ]]; then
    echo "- Expo download: $expo_url"
  elif [[ "$eas_registration" == "quota-exhausted" ]]; then
    echo "- Distribution: GitHub Actions artifact only"
    echo "- EAS registration: deferred until the monthly local-build quota resets"
    echo "- OTA baseline was not registered; the next deployment will build a full APK again"
  fi
} >>"$GITHUB_STEP_SUMMARY"
