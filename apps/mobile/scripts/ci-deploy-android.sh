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

  EAS_ENV_READY=true GOOGLE_SERVICES_JSON="$google_services_path" \
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

  eas update \
    --channel "$channel" \
    --environment "$environment" \
    --platform android \
    --message "$environment: ${GITHUB_SHA:-manual}" \
    --non-interactive

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
  } >>"$GITHUB_STEP_SUMMARY"
  exit 0
}

if [[ "$environment" == "preview" ]]; then
  preview_baseline_artifact_id="$(
    node "$script_directory/find-preview-runtime-baseline.mjs" "$fingerprint_hash"
  )"

  if [[ -n "$preview_baseline_artifact_id" ]]; then
    publish_ota "GitHub baseline artifact" "$preview_baseline_artifact_id"
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

expo_url=""
if [[ "$environment" == "production" ]]; then
  if ! upload_json="$(
    # Production local builds must be registered with EAS before they can
    # become a compatibility baseline for later OTA updates.
    eas upload \
      --platform android \
      --build-path "$apk_path" \
      --fingerprint "$fingerprint_hash" \
      --json \
      --non-interactive
  )"; then
    echo "::error::EAS upload failed for the Production APK."
    exit 1
  fi

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
fi

{
  echo "mode=build"
  echo "environment=$environment"
  echo "fingerprint=$fingerprint_hash"
  echo "apk-path=$apk_path"
  echo "artifact-name=$apk_artifact_name"
  echo "apk-sha256=$apk_sha256"
  echo "expo-url=$expo_url"
} >>"$GITHUB_OUTPUT"

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
  fi
} >>"$GITHUB_STEP_SUMMARY"
