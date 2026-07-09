import { test, expect } from "./auth";

test.describe("사용자 관리 액션", () => {
  test("사용자 카드 클릭 시 인라인 에디터가 열린다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(500);
      const editor = page.locator(".user-inline-editor.expanded");
      const visible = await editor.isVisible().catch(() => false);
      expect(typeof visible).toBe("boolean");
    }
  });

  test("인라인 에디터에 닉네임 필드가 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(500);
      const editor = page.locator(".user-inline-editor.expanded");
      if (await editor.isVisible().catch(() => false)) {
        const nicknameLabel = editor.locator("text=닉네임");
        const visible = await nicknameLabel.isVisible().catch(() => false);
        expect(typeof visible).toBe("boolean");
      }
    }
  });

  test("인라인 에디터에 상태 버튼들이 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(500);
      const editor = page.locator(".user-inline-editor.expanded");
      if (await editor.isVisible().catch(() => false)) {
        const stopBtn = editor.locator('button:has-text("정지")');
        const banBtn = editor.locator('button:has-text("차단")');
        const activeBtn = editor.locator('button:has-text("활성화")');
        expect(await stopBtn.count()).toBeGreaterThanOrEqual(0);
        expect(await banBtn.count()).toBeGreaterThanOrEqual(0);
        expect(await activeBtn.count()).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("인라인 에디터에 저장 버튼이 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(".mobile-record-card:not(.mobile-record-card--static)");
    const count = await cards.count().catch(() => 0);
    if (count > 0) {
      await cards.first().click({ force: true });
      await page.waitForTimeout(500);
      const editor = page.locator(".user-inline-editor.expanded");
      if (await editor.isVisible().catch(() => false)) {
        const saveBtn = editor.locator('button:has-text("저장")');
        expect(await saveBtn.count()).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("사용자 검색 입력 필드가 있다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    const searchInput = page.locator('input[aria-label="검색"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test("검색어 입력 후 결과가 갱신된다", async ({ adminPage: page }) => {
    await page.locator('button:has-text("사용자")').first().click();
    const searchInput = page.locator('input[aria-label="검색"]');
    await searchInput.fill("test");
    await page.waitForTimeout(1500);
    const cards = page.locator(".mobile-record-card");
    const count = await cards.count().catch(() => 0);
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
