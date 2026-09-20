import { describe, expect, it } from "vitest";

import { useOptimizedProguard } from "../../plugins/withAndroidOptimizedProguard.js";

describe("Android release optimization", () => {
  it.each(['"', "'"])("replaces the unoptimized defaults with %s quotes", (quote) => {
    const source = `proguardFiles getDefaultProguardFile(${quote}proguard-android.txt${quote}), "proguard-rules.pro"`;
    expect(useOptimizedProguard(source)).toBe(
      'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"',
    );
  });

  it("is safe across repeated prebuilds", () => {
    const source = 'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"';
    expect(useOptimizedProguard(useOptimizedProguard(source))).toBe(source);
  });

  it("fails visibly when a new template no longer has the expected defaults", () => {
    expect(() => useOptimizedProguard('proguardFiles "custom.pro"')).toThrow(
      "missing the default ProGuard rules",
    );
  });
});
