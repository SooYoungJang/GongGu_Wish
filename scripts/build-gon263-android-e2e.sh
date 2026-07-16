#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
mkdir -p artifacts/android

# Gradle reads ORG_GRADLE_PROJECT_* as a project property. Keep the CI release
# build aligned with the x86_64 emulator instead of compiling four unused ABIs.
test "${ORG_GRADLE_PROJECT_reactNativeArchitectures:-}" = "x86_64"
printf 'reactNativeArchitectures=%s\n' \
  "$ORG_GRADLE_PROJECT_reactNativeArchitectures" \
  | tee artifacts/android/build-config.txt
df -h "$repo_root" > artifacts/android/disk-before-build.txt

pushd apps/mobile >/dev/null
npx expo prebuild --platform android --no-install \
  2>&1 | tee "$repo_root/artifacts/android/android-prebuild.log"
popd >/dev/null
test -s apps/mobile/android/gradlew
cp apps/mobile/android/app/src/main/AndroidManifest.xml \
  artifacts/android/android-manifest.xml
grep -F 'android:usesCleartextTraffic="true"' \
  artifacts/android/android-manifest.xml

pushd apps/mobile/android >/dev/null
./gradlew app:assembleRelease \
  -x lint \
  -x test \
  --configure-on-demand \
  --build-cache \
  -PreactNativeArchitectures="$ORG_GRADLE_PROJECT_reactNativeArchitectures" \
  2>&1 | tee "$repo_root/artifacts/android/android-build.log"
popd >/dev/null

test -s apps/mobile/android/app/build/outputs/apk/release/app-release.apk
df -h "$repo_root" > artifacts/android/disk-after-build.txt
