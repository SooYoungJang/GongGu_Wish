#!/usr/bin/env bash

set -euo pipefail

case "${GITHUB_REF:-}" in
  refs/heads/main)
    environment="production"
    profile="production-apk"
    channel="production"
    app_identifier="com.gonggu.wish"
    ;;
  refs/heads/develop)
    environment="preview"
    profile="preview"
    channel="preview"
    app_identifier="com.gonggu.wish.preview"
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
  EAS_ENV_READY=true eas env:exec "$environment" \
    'bash scripts/ci-deploy-android.sh' \
    --non-interactive
  exit 0
fi

required_environment_variables=(
  APP_VARIANT
  EXPO_PUBLIC_API_PROXY_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  EXPO_PUBLIC_SUPABASE_URL
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

compatible_builds_json="$(
  eas build:list \
    --platform android \
    --status finished \
    --fingerprint-hash "$fingerprint_hash" \
    --app-identifier "$app_identifier" \
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
    echo "- Compatible build: \`$compatible_build_id\`"
    echo "- Fingerprint: \`$fingerprint_hash\`"
  } >>"$GITHUB_STEP_SUMMARY"
  exit 0
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

upload_json="$(
  # Uploading registers the locally built APK and its fingerprint. It does not
  # invoke an EAS cloud build, and it gives testers a shareable download link.
  eas upload \
    --platform android \
    --build-path "$apk_path" \
    --fingerprint "$fingerprint_hash" \
    --json \
    --non-interactive
)"

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

{
  echo "mode=build"
  echo "environment=$environment"
  echo "fingerprint=$fingerprint_hash"
  echo "apk-path=$apk_path"
  echo "expo-url=$expo_url"
} >>"$GITHUB_OUTPUT"

{
  echo "## Android local APK build"
  echo ""
  echo "- Environment: \`$environment\`"
  echo "- Builder: GitHub Actions runner (local EAS build)"
  echo "- Fingerprint: \`$fingerprint_hash\`"
  if [[ -n "$expo_url" ]]; then
    echo "- Expo download: $expo_url"
  fi
} >>"$GITHUB_STEP_SUMMARY"
