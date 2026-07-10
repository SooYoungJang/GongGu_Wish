import { test, expect } from "./auth";

test.describe("탭 전환 동작", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("하단 탭바가 모바일에서 표시된다", async ({ adminPage: page }) => {
    const tabBar = page.getByLabel("모바일 하단 탭");
    await expect(tabBar).toBeVisible();
  });

  test("탭 전환 시 상세 패널이 초기화된다", async ({ adminPage: page }) => {
    await page.getByLabel("모바일 하단 탭").getByRole("button", { name: "검수" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("모바일 하단 탭").getByRole("button", { name: "대시보드" }).click();
    await page.waitForTimeout(500);
    const detailPanels = page.locator(".detail-panel:not(.empty-state)");
    const count = await detailPanels.count().catch(() => 0);
    expect(count).toBe(0);
  });

  test("모든 탭이 전환된다", async ({ adminPage: page }) => {
    const tabBar = page.getByLabel("모바일 하단 탭");
    const tabLabels = ["검수", "공구", "사용자", "CDN", "대시보드"];
    for (const label of tabLabels) {
      await tabBar.getByRole("button", { name: label }).click();
      await page.waitForTimeout(500);
    }
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible({ timeout: 5000 });
  });
});
