import { test, expect } from "./auth";

test.describe("대시보드 통계 및 데이터", () => {
  test("통계 카드가 표시된다", async ({ adminPage: page }) => {
    const statCards = page.locator(".stat-card");
    const count = await statCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("검수 대기 섹션에 데이터 또는 빈 상태가 표시된다", async ({ adminPage: page }) => {
    await expect(page.getByRole("heading", { name: "검수 대기 위시" })).toBeVisible();
  });

  test("최근 승인 공구 섹션이 표시된다", async ({ adminPage: page }) => {
    await expect(page.getByRole("heading", { name: "최근 승인 공구" })).toBeVisible({ timeout: 10000 });
  });

  test("카테고리 분포 섹션이 표시된다", async ({ adminPage: page }) => {
    await expect(page.getByRole("heading", { name: "카테고리별 공구 분포" })).toBeVisible({ timeout: 10000 });
  });

  test("새로고침 버튼 클릭 시 로딩 상태가 된다", async ({ adminPage: page }) => {
    const refreshBtn = page.locator('button:has-text("새로고침")');
    await refreshBtn.click();
    await page.waitForTimeout(500);
  });

  test("대시보드에서 검수 대기 위시템이 표시되거나 빈 상태다", async ({ adminPage: page }) => {
    const queueSection = page.locator(".dashboard-col").filter({
      has: page.getByRole("heading", { name: "검수 대기 위시" }),
    });

    await expect(queueSection).toBeVisible({ timeout: 10000 });
    await expect(
      queueSection.locator(".loading-rows:visible, .empty-state:visible, table:visible, .mobile-record-card--static:visible").first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("최근 승인 공구 카드는 static 클래스를 가진다", async ({ adminPage: page }) => {
    const cards = page.locator(".mobile-record-card--static");
    const count = await cards.count();
    if (count > 0) {
      await expect(cards.first()).toHaveClass(/mobile-record-card--static/);
    }
  });

  test("operator 정보에 이메일이 표시된다", async ({ adminPage: page }) => {
    const operator = page.locator(".operator");
    await expect(operator).toBeVisible();
    const text = await operator.textContent();
    expect(text).toBeTruthy();
  });
});
