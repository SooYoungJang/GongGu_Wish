#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
artifact_dir="$repo_root/artifacts/mobile-ads-smoke"
cd "$repo_root"
mkdir -p "$artifact_dir"

test "${APP_VARIANT:-}" = "preview"
test "${EXPO_PUBLIC_ADS_RUNTIME_SMOKE:-}" = "true"
test "${EXPO_PUBLIC_E2E_MODE:-}" = "false"
test "${ORG_GRADLE_PROJECT_reactNativeArchitectures:-}" = "x86_64"
printf 'reactNativeArchitectures=%s\n' \
  "$ORG_GRADLE_PROJECT_reactNativeArchitectures" \
  > "$artifact_dir/build-config.txt"
df -h "$repo_root" > "$artifact_dir/disk-before-build.txt"

pushd apps/mobile >/dev/null
npx expo prebuild --platform android --no-install \
  2>&1 | tee "$artifact_dir/android-prebuild.log"
popd >/dev/null

manifest="apps/mobile/android/app/src/main/AndroidManifest.xml"
test -s "$manifest"
cp "$manifest" "$artifact_dir/android-manifest.xml"
grep -Fx 'android.kotlinVersion=2.3.0' \
  apps/mobile/android/gradle.properties
grep -F 'android:value="ca-app-pub-3940256099942544~3347511713"' \
  "$manifest"

# The wrapper's single request occasionally receives a truncated Gradle ZIP
# from services.gradle.org on GitHub-hosted runners. Download with bounded
# retries and verify the official checksum before any native build starts.
gradle_distribution="$RUNNER_TEMP/gradle-9.0.0-bin.zip"
curl --fail --location --silent --show-error \
  --retry 5 --retry-all-errors --retry-delay 3 \
  --output "$gradle_distribution" \
  https://services.gradle.org/distributions/gradle-9.0.0-bin.zip
printf '%s  %s\n' \
  '8fad3d78296ca518113f3d29016617c7f9367dc005f932bd9d93bf45ba46072b' \
  "$gradle_distribution" \
  | sha256sum --check
sed -i \
  "s#^distributionUrl=.*#distributionUrl=file\\:$gradle_distribution#" \
  apps/mobile/android/gradle/wrapper/gradle-wrapper.properties
grep -F 'distributionUrl=file:' \
  apps/mobile/android/gradle/wrapper/gradle-wrapper.properties

node scripts/generate-gon263-android-codegen.mjs \
  2>&1 | tee "$artifact_dir/android-codegen.log"

pushd apps/mobile/android >/dev/null
./gradlew :app:generateCodegenArtifactsFromSchema \
  --configure-on-demand \
  --build-cache \
  -Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=768m" \
  -Dorg.gradle.parallel=false \
  -Dorg.gradle.workers.max=2 \
  -PnewArchEnabled=true \
  -PreactNativeArchitectures="$ORG_GRADLE_PROJECT_reactNativeArchitectures" \
  2>&1 | tee -a "$artifact_dir/android-codegen.log"
./gradlew app:assembleRelease \
  -x lint \
  -x test \
  --configure-on-demand \
  --build-cache \
  -Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=768m" \
  -Dorg.gradle.parallel=false \
  -Dorg.gradle.workers.max=2 \
  -PnewArchEnabled=true \
  -PreactNativeArchitectures="$ORG_GRADLE_PROJECT_reactNativeArchitectures" \
  2>&1 | tee "$artifact_dir/android-build.log"
popd >/dev/null

test -s apps/mobile/android/app/build/outputs/apk/release/app-release.apk
df -h "$repo_root" > "$artifact_dir/disk-after-build.txt"
