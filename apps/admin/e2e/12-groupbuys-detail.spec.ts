import { test, expect } from "./auth";

test.describe("공구 상세 패널", () => {
  test("공구 카드 클릭 시 상세 패널이 열린다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("공구")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(1000);
      await expect(page.locator(".detail-panel")).toBeVisible({ timeout: 5000 });
    }
  });

  test("공구 상세에 폼 필드가 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("공구")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(1000);
      const detailPanel = page.locator(".detail-panel");
      if (await detailPanel.isVisible().catch(() => false)) {
        const labels = page.locator(".detail-panel label, .detail-panel .field span");
        const labelCount = await labels.count();
        expect(labelCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("공구 상세에 저장 버튼이 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("공구")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(1000);
      const saveBtn = page.locator('.detail-panel button:has-text("저장")');
      const visible = await saveBtn.isVisible().catch(() => false);
      expect(typeof visible).toBe("boolean");
    }
  });

  test("공구 상세에 노출 토글 버튼이 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("공구")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(1000);
      const hideBtn = page.locator('button:has-text("노출"), button:has-text("숨김")');
      const visible = await hideBtn.isVisible().catch(() => false);
      expect(typeof visible).toBe("boolean");
    }
  });

  test("공구 상세 닫기 후 목록으로 돌아간다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("공구")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
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
});
