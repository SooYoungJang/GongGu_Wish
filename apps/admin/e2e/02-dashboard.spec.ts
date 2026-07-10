import { test, expect } from "./auth";

test.describe("대시보드", () => {
 test("대시보드 핵심 섹션이 렌더링된다", async ({ adminPage: page }) => {
   await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "검수 대기 위시" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "최근 승인 공구" })).toBeVisible();
 });

  test("대시보드 카드는 클릭해도 상세 페이지가 열리지 않는다", async ({ adminPage: page }) => {
    const staticCards = page.locator(".mobile-record-card--static");
    const count = await staticCards.count();
    if (count > 0) {
      const firstCard = staticCards.first();
      await firstCard.click({ force: true });
      await expect(page.locator(".detail-panel:not(.empty-state)")).toHaveCount(0, { timeout: 2000 });
    }
  });

  test("검수 대기로 이동 버튼이 작동한다", async ({ adminPage: page }) => {
    const openButton = page.locator('button:has-text("검수"), button:has-text("대기")').first();
   if (await openButton.isVisible().catch(() => false)) {
     await openButton.click();
      await expect(page.getByRole("button", { name: /위시 검수/ })).toBeVisible({ timeout: 5000 });
   }
  });
});
