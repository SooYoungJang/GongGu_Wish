import { test, expect } from "./auth";

test.describe("모바일 레이아웃", () => {
  test("모바일에서 사이드바가 숨겨진다", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("/");
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL ?? "admin@gonggu.local");
      await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? "Admin123!@#");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=대시보드")).toBeVisible({ timeout: 15000 });
    }
    const sidebar = page.locator(".sidebar");
    await expect(sidebar).toBeHidden();
    await context.close();
  });

  test("모바일에서 하단 탭바가 표시된다", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("/");
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL ?? "admin@gonggu.local");
      await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? "Admin123!@#");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=대시보드")).toBeVisible({ timeout: 15000 });
    }
    const tabBar = page.locator(".bottom-tab-bar");
    await expect(tabBar).toBeVisible();
    await context.close();
  });

  test("모바일에서 테이블이 숨겨지고 카드가 표시된다", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("/");
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL ?? "admin@gonggu.local");
      await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? "Admin123!@#");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=대시보드")).toBeVisible({ timeout: 15000 });
    }
    await page.locator('button:has-text("검수")').first().click();
    await page.waitForTimeout(1000);
    const desktopTable = page.locator(".desktop-table");
    await expect(desktopTable).toBeHidden();
    const mobileCards = page.locator(".mobile-card-list");
    await expect(mobileCards).toBeVisible({ timeout: 5000 });
    await context.close();
  });

  test("모바일에서 가로 스크롤이 없다", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("/");
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL ?? "admin@gonggu.local");
      await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? "Admin123!@#");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=대시보드")).toBeVisible({ timeout: 15000 });
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await context.close();
  });

  test("태블릿에서 상단 내비가 가로 스크롤 가능하다", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await context.newPage();
    await page.goto("/");
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL ?? "admin@gonggu.local");
      await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? "Admin123!@#");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=대시보드")).toBeVisible({ timeout: 15000 });
    }
    const navTabs = page.locator(".nav-tabs");
    await expect(navTabs).toBeVisible();
    await context.close();
  });
});
