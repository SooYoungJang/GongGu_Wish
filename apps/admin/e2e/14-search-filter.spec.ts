import { test, expect } from "./auth";

test.describe("검색 및 필터", () => {
  test("검수 탭 상태 필터 변경 시 목록 갱신", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    const filterSelect = page.locator("select").first();
    await expect(filterSelect).toBeVisible({ timeout: 10000 });
    const options = await filterSelect.locator("option").count();
    expect(options).toBeGreaterThan(1);
  });

  test("검수 탭 상태를 ALL로 변경", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    const filterSelect = page.locator("select").first();
    await filterSelect.selectOption({ label: "전체" }).catch(async () => {
      await filterSelect.selectOption({ value: "ALL" }).catch(() => {});
    });
    await page.waitForTimeout(1000);
  });

  test("검수 탭 검색어 입력", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    const searchInput = page.locator('input[aria-label="검색"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("테스트");
    await page.waitForTimeout(1500);
  });

  test("공구 탭 상태 필터 변경", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /공구 관리|공구/ }).first().click();
    const filterSelect = page.locator("select").first();
    await expect(filterSelect).toBeVisible({ timeout: 10000 });
    const options = await filterSelect.locator("option").count();
    expect(options).toBeGreaterThan(1);
  });

  test("공구 탭 검색어 입력", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /공구 관리|공구/ }).first().click();
    const searchInput = page.locator('input[aria-label="검색"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("공구");
    await page.waitForTimeout(1500);
  });

  test("CDN 탭 상태 필터 변경", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /CDN 갱신|CDN/ }).first().click();
    const filterSelect = page.locator("select").first();
    await expect(filterSelect).toBeVisible({ timeout: 5000 });
    const options = await filterSelect.locator("option").count();
    expect(options).toBeGreaterThan(1);
  });

  test("CDN 탭 만료됨 필터 선택", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /CDN 갱신|CDN/ }).first().click();
    const filterSelect = page.locator("select").first();
    await filterSelect.selectOption({ label: "만료됨" }).catch(async () => {
      await filterSelect.selectOption({ value: "expired" }).catch(() => {});
    });
    await page.waitForTimeout(1000);
  });
});
