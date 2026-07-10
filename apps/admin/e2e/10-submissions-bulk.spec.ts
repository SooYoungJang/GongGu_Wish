import { test, expect } from "./auth";

test.describe("검수 벌크 액션", () => {
  test("검수 탭에 벌크 액션 바가 표시된다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await expect(page.locator(".bulk-bar")).toBeVisible({ timeout: 10000 });
  });

  test("선택된 항목 수가 표시된다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await expect(page.getByText(/\d+개 선택됨/)).toBeVisible({ timeout: 10000 });
  });

  test("선택 해제 버튼이 있다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await expect(page.locator('button:has-text("선택 해제")')).toBeVisible({ timeout: 10000 });
  });

  test("선택 반려 버튼이 있다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await expect(page.locator('button:has-text("선택 반려")')).toBeVisible({ timeout: 10000 });
  });

  test("선택 승인 버튼이 있다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await expect(page.locator('button:has-text("선택 승인")')).toBeVisible({ timeout: 10000 });
  });

  test("일괄 반려 사유 입력 필드가 있다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    const reasonInput = page.locator('input[aria-label="일괄 반려 사유"]');
    await expect(reasonInput).toBeVisible({ timeout: 10000 });
  });

  test("선택 없을 때 벌크 버튼이 비활성화된다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await page.waitForTimeout(1000);
    const bulkBtn = page.locator('button:has-text("선택 승인")');
    await expect(bulkBtn).toBeDisabled({ timeout: 5000 });
  });

  test("체크박스로 항목 선택 시 카운트가 변경된다", async ({ adminPage: page }) => {
    await page.locator("button:visible").filter({ hasText: /위시 검수|검수/ }).first().click();
    await page.waitForTimeout(1000);
    const checkboxes = page.getByRole("checkbox", { name: /위시템 선택/ });
    const count = await checkboxes.count();
    if (count > 0) {
      await checkboxes.first().check();
      await expect(page.getByText(/[1-9]\d*개 선택됨/)).toBeVisible({ timeout: 3000 });
    }
  });
});
