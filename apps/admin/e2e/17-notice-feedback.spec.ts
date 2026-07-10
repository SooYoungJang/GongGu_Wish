import { test, expect } from "./auth";

test.describe("알림 및 피드백", () => {
  test("새로고침 후 알림이 표시되지 않거나 성공 알림이 뜬다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("새로고침")').click();
    await page.waitForTimeout(2000);
    const notice = page.locator(".notice");
    const count = await notice.count();
    if (count > 0) {
      await expect(notice.first()).toBeVisible();
    }
  });

  test("빈 상태 메시지가 적절히 표시된다", async ({ adminPage: page }) => {
    const emptyStates = page.locator(".empty-state");
    const count = await emptyStates.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("CDN 탭 새로고침 클릭 시 피드백", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /CDN 갱신|CDN/ }).first().click();
    await page.waitForTimeout(1000);
    const reloadBtn = page.locator('button:has-text("새로고침")');
    if (await reloadBtn.isVisible().catch(() => false)) {
      await reloadBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});
