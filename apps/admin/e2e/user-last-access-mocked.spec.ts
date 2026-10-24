import { expect, test } from "@playwright/test";

test.use({ video: "off", trace: "off", screenshot: "off", timezoneId: "America/Los_Angeles" });

for (const width of [320, 768, 1024, 1440]) {
  test(`가입자 최근 접속 한국시간 표시와 저장 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const admin = { id: "mock-admin", aud: "authenticated", role: "authenticated", email: "admin@example.test", app_metadata: { role: "admin" }, user_metadata: {}, created_at: "2026-09-12T00:00:00Z" };
    await page.route("**/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/token") ? { access_token: "mock-only-token", refresh_token: "mock-only-refresh", token_type: "bearer", expires_in: 3600, user: admin } : admin }));
    const timestamp = "2026-10-24T15:04:09.000Z";
    const users = [
      { id: "recent-user", email: "recent@example.test", nickname: "Recent User", status: "ACTIVE", createdAt: "2026-10-01T01:00:00Z", lastAccessAt: timestamp },
      { id: "no-record-user", email: "old@example.test", nickname: "No record", status: "ACTIVE", createdAt: "2026-09-01T01:00:00Z", lastAccessAt: null },
    ];
    let saves = 0;
    await page.route("**/functions/v1/admin-api", async route => {
      const payload = route.request().postDataJSON();
      let data: unknown = { items: [], total: 0 };
      if (payload.path === "/admin/dashboard") data = { totals: { submissions: 0, pending: 0, approved: 0, rejected: 0, groupBuys: 0, activeGroupBuys: 0, users: 2 }, pendingQueue: [], recentUsers: [], recentGroupBuys: [], categoryDistribution: {} };
      if (payload.path === "/admin/users") data = { items: users, total: users.length };
      if (payload.path === "/admin/users/recent-user" && payload.method === "PATCH") {
        saves++;
        users[0].nickname = payload.body.nickname;
        data = users[0];
      }
      await route.fulfill({ json: { data } });
    });
    await page.goto("/");
    await page.getByLabel("이메일").fill("admin@example.test");
    await page.getByLabel("비밀번호").fill("not-a-real-password");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
    const menu = page.getByRole("button", { name: "대시보드 전체 메뉴", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("button", { name: /가입자 관리/ }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "가입자 관리", level: 2, exact: true })).toBeVisible();
    const time = page.locator(`time[datetime="${timestamp}"]`).filter({ visible: true }).first();
    await expect(time).toHaveText(/2026.*10.*25.*00:04:09/);
    await expect(time).toHaveAttribute("title", "한국시간 (UTC+9)");
    await expect(page.getByText("기록 없음", { exact: true }).filter({ visible: true })).toBeVisible();
    expect(await time.evaluate(element => {
      const parent = element.parentElement!;
      return parent.scrollWidth <= parent.clientWidth + 1;
    })).toBe(true);
    await page.getByText("recent@example.test", { exact: true }).filter({ visible: true }).first().click();
    const nickname = page.getByLabel("닉네임", { exact: true }).filter({ visible: true }).first();
    await nickname.fill("Updated nickname");
    await page.getByRole("button", { name: "저장", exact: true }).filter({ visible: true }).first().click();
    await expect.poll(() => saves).toBe(1);
    await expect(time).toHaveText(/2026.*10.*25.*00:04:09/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
