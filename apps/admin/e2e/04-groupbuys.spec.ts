import { test, expect } from "./auth";

test.describe("공구 관리", () => {
  test("공구 탭 진입 시 목록이 표시된다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /공구 관리|공구/ }).first().click();
    await expect(page.getByRole("heading", { name: /공구 관리/ })).toBeVisible({ timeout: 5000 });
    await expect(page.locator("table:visible, .mobile-card-list:visible").first()).toBeVisible({ timeout: 10000 });
  });

  test("공구 탭 진입 시 상세 패널이 자동으로 열리지 않는다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /공구 관리|공구/ }).first().click();
    await page.waitForTimeout(1000);
    const detailPanels = page.locator(".detail-panel:not(.empty-state)");
    const count = await detailPanels.count().catch(() => 0);
    expect(count).toBe(0);
  });
});
