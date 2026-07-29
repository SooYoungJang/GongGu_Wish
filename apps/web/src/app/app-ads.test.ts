import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./app-ads.txt/route";

const originalAppAdsTxt = process.env.ADMOB_APP_ADS_TXT;

afterEach(() => {
  if (originalAppAdsTxt === undefined) {
    delete process.env.ADMOB_APP_ADS_TXT;
  } else {
    process.env.ADMOB_APP_ADS_TXT = originalAppAdsTxt;
  }
});

describe("GET /app-ads.txt", () => {
  it("fails closed until the exact AdMob publisher snippet is configured", async () => {
    delete process.env.ADMOB_APP_ADS_TXT;

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("rejects malformed or placeholder content", async () => {
    process.env.ADMOB_APP_ADS_TXT =
      "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0";

    const response = await GET();

    expect(response.status).toBe(503);
  });

  it("serves a configured Google publisher line directly as text/plain", async () => {
    const snippet =
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0";
    process.env.ADMOB_APP_ADS_TXT = snippet;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe(`${snippet}\n`);
  });
});
