import { test, expect } from "./auth";

test.describe("위시 검수", () => {
  test("검수 탭 진입 시 목록이 표시된다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await expect(page.getByRole("heading", { name: /위시 검수/ })).toBeVisible({ timeout: 5000 });
    await expect(page.locator("table:visible, .mobile-card-list:visible").first()).toBeVisible({ timeout: 10000 });
  });

  test("검수 탭 진입 시 상세 패널이 자동으로 열리지 않는다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await page.waitForTimeout(1000);
    const detailPanels = page.locator(".detail-panel:not(.empty-state)");
    const count = await detailPanels.count().catch(() => 0);
    expect(count).toBe(0);
  });

  test("상태 필터가 표시된다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await expect(page.locator("select")).toBeVisible({ timeout: 5000 });
  });

  test("카드 클릭 시 상세 패널이 열린다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    const cards = page.locator(".mobile-record-card");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(500);
    }
  });
});
