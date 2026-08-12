#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
wrapper_properties="$repo_root/apps/mobile/android/gradle/wrapper/gradle-wrapper.properties"
gradle_cache_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
gradle_distribution="$gradle_cache_dir/gradle-9.0.0-bin.zip"
gradle_checksum="8fad3d78296ca518113f3d29016617c7f9367dc005f932bd9d93bf45ba46072b"

test -s "$wrapper_properties"
mkdir -p "$gradle_cache_dir"

# A single Gradle wrapper request can receive a truncated response or a
# transient 5xx from the distribution CDN. Retry the download, then verify the
# official checksum before pointing any native build at the local archive.
curl --fail --location --silent --show-error \
  --retry 5 --retry-all-errors --retry-delay 3 \
  --output "$gradle_distribution" \
  https://services.gradle.org/distributions/gradle-9.0.0-bin.zip
printf '%s  %s\n' "$gradle_checksum" "$gradle_distribution" \
  | sha256sum --check
sed -i \
  "s#^distributionUrl=.*#distributionUrl=file\:$gradle_distribution#" \
  "$wrapper_properties"
grep -F 'distributionUrl=file:' "$wrapper_properties"
