import { test, expect } from "./auth";

test.describe("가입자 관리", () => {
  test("사용자 탭 진입 시 목록이 표시된다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    await expect(page.locator("text=가입자 관리")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("table, .mobile-card-list")).toBeVisible({ timeout: 10000 });
  });

  test("사용자 탭 진입 시 인라인 에디터가 자동으로 열리지 않는다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    await page.waitForTimeout(1000);
    const inlineEditors = page.locator(".user-inline-editor.expanded");
    const count = await inlineEditors.count().catch(() => 0);
    expect(count).toBe(0);
  });
});
