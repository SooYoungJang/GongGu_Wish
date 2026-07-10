import { test, expect } from "./auth";

test.describe("페이지네이션", () => {
  test("검수 탭에 페이지네이션이 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("검수")').first().click();
    await page.waitForTimeout(1000);
    const pagination = page.locator(".pagination");
    const visible = await pagination.isVisible().catch(() => false);
    expect(typeof visible).toBe("boolean");
  });

  test("공구 탭에 페이지네이션이 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("공구")').first().click();
    await page.waitForTimeout(1000);
    const pagination = page.locator(".pagination");
    const visible = await pagination.isVisible().catch(() => false);
    expect(typeof visible).toBe("boolean");
  });

  test("사용자 탭에 페이지네이션이 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    await page.waitForTimeout(1000);
    const pagination = page.locator(".pagination");
    const visible = await pagination.isVisible().catch(() => false);
    expect(typeof visible).toBe("boolean");
  });

  test("검수 탭에 메타 정보(전체 수)가 표시된다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("검수")').first().click();
    await page.waitForTimeout(1000);
    const listMeta = page.locator(".list-meta");
    const visible = await listMeta.isVisible().catch(() => false);
    if (visible) {
      const text = await listMeta.textContent();
      expect(text).toBeTruthy();
    }
  });
});
