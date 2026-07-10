import { test, expect } from "./auth";

test.describe("CDN 갱신", () => {
  test("CDN 탭 진입 시 패널이 표시된다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /CDN 갱신|CDN/ }).first().click();
    await expect(page.getByRole("heading", { name: /CDN 미디어 갱신/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "배치 갱신" })).toBeVisible();
  });

  test("CDN 탭에 상태 필터가 있다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /CDN 갱신|CDN/ }).first().click();
    await expect(page.locator("select")).toBeVisible({ timeout: 5000 });
  });

  test("CDN 탭 진입 시 상세 패널이 열리지 않는다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /CDN 갱신|CDN/ }).first().click();
    await page.waitForTimeout(1000);
    const detailPanels = page.locator(".detail-panel:not(.empty-state)");
    const count = await detailPanels.count().catch(() => 0);
    expect(count).toBe(0);
  });
});
