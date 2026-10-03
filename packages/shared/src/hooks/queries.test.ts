import { describe, it, expect } from "vitest";
import { QUERY_KEYS } from "./queries";

describe("QUERY_KEYS", () => {
  it("has correct query key structure for groupBuys", () => {
    expect(QUERY_KEYS.groupBuys).toEqual(["group-buys"]);
  });

  it("generates groupBuy key with id", () => {
    expect(QUERY_KEYS.groupBuy("test-id")).toEqual(["group-buys", "test-id"]);
  });

  it("has correct admin query keys", () => {
    expect(QUERY_KEYS.adminGroupBuys).toEqual(["admin", "group-buys"]);
    expect(QUERY_KEYS.influencers).toEqual(["admin", "influencers"]);
    expect(QUERY_KEYS.submissions).toEqual(["admin", "submissions"]);
    expect(QUERY_KEYS.submission("test-id")).toEqual([
      "admin",
      "submissions",
      "test-id",
    ]);
  });
});

describe("shared hooks module exports", () => {
  it("exports query hooks", async () => {
    const hooksModule = await import("./queries");
    expect(typeof hooksModule.useGroupBuys).toBe("function");
    expect(typeof hooksModule.useAdminGroupBuys).toBe("function");
    expect(typeof hooksModule.useAutomaticCollectionGroupBuys).toBe("function");
    expect(typeof hooksModule.useInfluencers).toBe("function");
    expect(typeof hooksModule.useSubmissions).toBe("function");
  });

  it("exports mutation hooks", async () => {
    const hooksModule = await import("./queries");
    expect(typeof hooksModule.useCreateInfluencer).toBe("function");
    expect(typeof hooksModule.useDeactivateInfluencer).toBe("function");
    expect(typeof hooksModule.useCreateSubmission).toBe("function");
    expect(typeof hooksModule.useUpdateSubmission).toBe("function");
    expect(typeof hooksModule.useModerateSubmission).toBe("function");
  });
});
