import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@gonggu.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin123!@#";

test.describe("관리자 로그인", () => {
  test("로그인 화면이 표시된다", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("빈 입력으로 제출 시 에러가 표시된다", async ({ page }) => {
    await page.goto("/");
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"], .error, .notice')).toBeVisible({ timeout: 5000 });
  });

  test("잘못된 자격증명으로 로그인 시 에러가 표시된다", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"], .error, .notice')).toBeVisible({ timeout: 5000 });
  });

  test("올바른 자격증명으로 로그인 후 대시보드 진입", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
   await page.click('button[type="submit"]');
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible({ timeout: 15000 });
  });
});
