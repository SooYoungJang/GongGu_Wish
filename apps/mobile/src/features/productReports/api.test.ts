import { describe, expect, it, vi } from "vitest";
import { submitProductReport } from "./api";

const post = vi.hoisted(() => vi.fn());
vi.mock("../../lib/postgrest-client", () => ({ postgrestPost: post }));

describe("product report submission", () => {
  it("sends only the expected account, product, and selected reason", async () => {
    post.mockResolvedValueOnce([{ id: "report-id", status: "OPEN" }]);
    await expect(submitProductReport("owner", "product", "PRICE")).resolves.toEqual({ id: "report-id", status: "OPEN" });
    expect(post).toHaveBeenCalledWith("rpc/submit_product_report", {
      p_expected_user_id: "owner", p_group_buy_id: "product", p_reason: "PRICE",
    });
  });
  it("does not announce success for an invalid response or failed request", async () => {
    post.mockResolvedValueOnce([]);
    await expect(submitProductReport("owner", "product", "LINK")).rejects.toThrow();
    post.mockRejectedValueOnce(new Error("Too many reports"));
    await expect(submitProductReport("owner", "product", "LINK")).rejects.toThrow("Too many reports");
  });
});
