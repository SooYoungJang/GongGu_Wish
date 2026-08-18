import { describe, expect, it } from "vitest";

import { GET } from "./.well-known/assetlinks.json/route";

describe("GET /.well-known/assetlinks.json", () => {
  it("associates only the Production Android app and signing certificate", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    await expect(response.json()).resolves.toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.gonggu.wish",
          sha256_cert_fingerprints: [
            "6F:7F:CA:68:AD:F9:52:27:20:9B:3D:5F:D5:61:35:C7:91:5A:A3:C2:8C:13:89:64:BF:B9:34:E7:29:19:0D:0C",
          ],
        },
      },
    ]);
  });
});
