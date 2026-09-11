import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

for (const width of [1440, 320]) test(`요청 공구 연결·완료 ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const user = { id: "mock-admin", aud: "authenticated", role: "authenticated", email: "admin@example.test", app_metadata: { role: "admin" }, user_metadata: {}, created_at: "2026-09-11T00:00:00Z" };
  await page.route("**/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/token") ? { access_token: "mock-only-token", refresh_token: "mock-only-refresh", token_type: "bearer", expires_in: 3600, user } : user }));
  let request = { id: "mock-request", productName: "기다리던 주방용품 공동구매", status: "OPEN", requestCount: 4, createdAt: "2026-09-11T00:00:00Z", latestRequestedAt: "2026-09-11T00:00:00Z" };
  let fulfillCount = 0;
  await page.route("**/functions/v1/admin-api", async route => {
    const payload = route.request().postDataJSON();
    let data: unknown = { items: [], total: 0 };
    if (payload.path === "/admin/dashboard") data = { totals: { submissions: 0, pending: 0, approved: 0, rejected: 0, groupBuys: 0, activeGroupBuys: 0, users: 0 }, pendingQueue: [], recentUsers: [], recentGroupBuys: [], categoryDistribution: {} };
    if (payload.path === "/admin/group-buy-requests") {
      const items = !payload.params.status || payload.params.status === "ALL" || payload.params.status === request.status ? [request] : [];
      data = { items, total: items.length };
    }
    if (payload.path === "/admin/group-buys") {
      expect(payload.params.status).toBe("APPROVED");
      data = { items: [{ id: "mock-deal", productName: "등록된 주방용품 공구", priceKrw: 12000, startDate: "2026-09-11", status: "APPROVED" }], total: 1 };
    }
    if (payload.path === "/admin/group-buy-requests/mock-request/fulfill") {
      expect(payload.method).toBe("POST"); expect(payload.body).toEqual({ groupBuyId: "mock-deal" });
      fulfillCount++; request = { ...request, status: "FULFILLED" };
      data = { requestId: request.id, groupBuyId: "mock-deal", status: "FULFILLED", queued: 1 };
    }
    await route.fulfill({ json: { data } });
  });
  await page.goto("/");
  await page.getByLabel("이메일").fill("admin@example.test");
  await page.getByLabel("비밀번호").fill("not-a-real-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
  await page.getByRole("button", { name: width < 768 ? "요청" : /공구 요청/, exact: width < 768 }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: `${request.productName} 공구 연결`, exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "요청에 등록된 공구 연결" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio").check();
  const evidence = resolve(process.env.E2E_EVIDENCE_DIR ?? "test-results"); mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: resolve(evidence, `${testInfo.project.name}-${width}-request-fulfillment.png`), fullPage: true });
  await dialog.getByRole("button", { name: "공구 연결하고 요청 완료" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("요청에 공구를 연결했습니다.")).toBeVisible();
  expect(fulfillCount).toBe(1); expect(errors).toEqual([]);
});
