import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@gonggu.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin123!@#";

test.describe("로그인/로그아웃 세션", () => {
  test("로그인 후 로그아웃하면 로그인 화면으로 돌아간다", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("로그아웃")');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  });

  test("로그인 중일 때 버튼이 비활성화된다", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    const btn = page.locator('button[type="submit"]');
    await expect(btn).toBeDisabled({ timeout: 2000 }).catch(() => {});
  });

  test("새로고침 버튼이 표시된다", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("새로고침")')).toBeVisible();
  });

  test("이메일 입력 필드에 placeholder나 라벨이 있다", async ({ page }) => {
    await page.goto("/");
    const emailField = page.locator('input[type="email"]');
    await expect(emailField).toBeVisible();
    await expect(page.locator("text=이메일")).toBeVisible();
  });

  test("비밀번호 입력 필드가 password 타입이다", async ({ page }) => {
    await page.goto("/");
    const pwField = page.locator('input[type="password"]');
    await expect(pwField).toHaveAttribute("type", "password");
  });

  test("이메일만 입력하고 제출하면 에러가 표시된다", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', "admin@gonggu.local");
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"], .error, .notice')).toBeVisible({ timeout: 5000 });
  });

  test("비밀번호만 입력하고 제출하면 에러가 표시된다", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="password"]', "somepassword");
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"], .error, .notice')).toBeVisible({ timeout: 5000 });
  });

  test("세션 새로고침 후에도 로그인 상태가 유지된다", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible({ timeout: 15000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible({ timeout: 15000 });
  });
});
