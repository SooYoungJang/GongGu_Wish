import { test as base, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@gonggu.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin123!@#";

export type AdminFixtures = {
  adminPage: Page;
};

export const test = base.extend<AdminFixtures>({
  adminPage: async ({ page }, use) => {
    await page.goto("/");
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.fill('input[type="email"]', ADMIN_EMAIL);
      await page.fill('input[type="password"]', ADMIN_PASSWORD);
     await page.click('button[type="submit"]');
      await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible({ timeout: 15000 });
    }
    await use(page);
  },
});

export { expect };
