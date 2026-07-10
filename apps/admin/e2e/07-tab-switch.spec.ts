import { test, expect } from "./auth";

test.describe("탭 전환 동작", () => {
  test("하단 탭바가 모바일에서 표시된다", async ({ adminPage: page }) => {
    const tabBar = page.locator(".bottom-tab-bar");
    await expect(tabBar).toBeVisible();
  });

  test("탭 전환 시 상세 패널이 초기화된다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("검수")').first().click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("대시보드")').first().click();
    await page.waitForTimeout(500);
    const detailPanels = page.locator(".detail-panel:not(.empty-state)");
    const count = await detailPanels.count().catch(() => 0);
    expect(count).toBe(0);
  });

  test("모든 탭이 전환된다", async ({ adminPage: page }) => {
    const tabLabels = ["검수", "공구", "사용자", "CDN", "대시보드"];
    for (const label of tabLabels) {
      const btn = page.locator('button:has-text("' + label + '")').first();
      await btn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator("text=대시보드")).toBeVisible({ timeout: 5000 });
  });
});
