import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

for (const width of [1440, 320]) test(`앱 진단 조회와 복구 ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const user = { id: "mock-admin", aud: "authenticated", role: "authenticated", email: "admin@example.test", app_metadata: { role: "admin" }, user_metadata: {}, created_at: "2026-09-12T00:00:00Z" };
  await page.route("**/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/token") ? { access_token: "mock-only-token", refresh_token: "mock-only-refresh", token_type: "bearer", expires_in: 3600, user } : user }));
  let calls = 0;
  let unavailable = true;
  await page.route("**/functions/v1/admin-api", async route => {
    const payload = route.request().postDataJSON();
    let data: unknown = { items: [], total: 0 };
    if (payload.path === "/admin/dashboard") data = { totals: { submissions: 0, pending: 0, approved: 0, rejected: 0, groupBuys: 0, activeGroupBuys: 0, users: 0 }, pendingQueue: [], recentUsers: [], recentGroupBuys: [], categoryDistribution: {} };
    if (payload.path === "/admin/app-diagnostics") {
      calls++;
      if (unavailable) { await route.fulfill({ status: 503, json: { error: "Test outage" } }); return; }
      data = { days: payload.params.days, items: [
        { eventName: "query_error", screen: "SearchScreen", platform: "android", appVersion: "1.2.3", releaseId: "8d4141f2-6813-4c2a-9949-2e3c821130bc", errorKind: "ApiError", httpStatus: 503, value: null, count: 4, sessions: 2 },
        { eventName: "purchase_link_open", screen: "Detail", platform: "ios", appVersion: "1.2.3", releaseId: "native", errorKind: null, httpStatus: null, value: "success", count: 12, sessions: 8 },
      ] };
    }
    await route.fulfill({ json: { data } });
  });
  await page.goto("/");
  await page.getByLabel("이메일").fill("admin@example.test");
  await page.getByLabel("비밀번호").fill("not-a-real-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
  await page.getByRole("button", { name: /앱 진단/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole("alert")).toContainText("진단을 불러오지 못했습니다.");
  unavailable = false;
  const failedCalls = calls;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("4건 · 2세션")).toBeVisible();
  await page.getByLabel("조회 기간").selectOption("1");
  await expect(page.getByText("ApiError · HTTP 503")).toBeVisible();
  const evidence = resolve(process.env.E2E_EVIDENCE_DIR ?? "test-results"); mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: resolve(evidence, `${testInfo.project.name}-${width}-app-diagnostics.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(calls).toBe(failedCalls + 2); expect(errors).toEqual([]);
});
