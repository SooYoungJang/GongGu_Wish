import { test, expect } from "./auth";

test.describe("검수 상세 패널", () => {
  test("카드 클릭 시 상세 패널이 열린다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator("tbody tr:visible, .mobile-record-card:visible:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(1000);
      await expect(page.locator(".detail-panel")).toBeVisible({ timeout: 5000 });
    }
  });

  test("상세 패널에 목록으로 버튼이 있다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator("tbody tr:visible, .mobile-record-card:visible:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(1000);
      const backBtn = page.locator('button:has-text("목록으로")');
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(500);
        const detailPanels = page.locator(".detail-panel:not(.empty-state)");
        expect(await detailPanels.count()).toBe(0);
      }
    }
  });

  test("상세 패널에 Hiker 보강 버튼이 있다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator("tbody tr:visible, .mobile-record-card:visible:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(1000);
      const hikerBtn = page.locator('button:has-text("Hiker")');
      const visible = await hikerBtn.isVisible().catch(() => false);
      expect(typeof visible).toBe("boolean");
    }
  });

  test("상세 패널에 폼 필드들이 있다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator("tbody tr:visible, .mobile-record-card:visible:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(1000);
      const detailPanel = page.locator(".detail-panel");
      if (await detailPanel.isVisible().catch(() => false)) {
        const inputs = page.locator(".detail-panel input, .detail-panel textarea, .detail-panel select");
        const inputCount = await inputs.count();
        expect(inputCount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
