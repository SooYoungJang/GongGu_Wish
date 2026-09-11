import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

for (const width of [1440, 320]) test(`상품 신고 조회·검수·화면 접근 ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const user = { id: "mock-admin", aud: "authenticated", role: "authenticated", email: "admin@example.test", app_metadata: { role: "admin" }, user_metadata: {}, created_at: "2026-09-09T00:00:00Z" };
  await page.route("**/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/token")
    ? { access_token: "mock-only-token", refresh_token: "mock-only-refresh", token_type: "bearer", expires_in: 3600, user } : user }));
  let report = { id: "mock-report", groupBuyId: "mock-product", productName: "가격 확인이 필요한 공동구매 상품", reason: "PRICE", status: "OPEN", createdAt: "2026-09-09T00:00:00Z", reviewedAt: null as string | null, reviewNote: "" };
  await page.route("**/functions/v1/admin-api", async route => {
    const payload = route.request().postDataJSON();
    let data: unknown = { items: [], total: 0 };
    if (payload.path === "/admin/dashboard") data = { totals: { submissions: 0, pending: 0, approved: 0, rejected: 0, groupBuys: 0, activeGroupBuys: 0, users: 0 }, pendingQueue: [], recentUsers: [], recentGroupBuys: [], categoryDistribution: {} };
    if (payload.path === "/admin/product-reports") {
      const items = payload.params.status === "ALL" || payload.params.status === report.status ? [report] : [];
      data = { items, total: items.length };
    }
    if (payload.path === "/admin/product-reports/mock-report") {
      expect(payload.method).toBe("PATCH");
      expect(payload.body).toEqual({ status: "RESOLVED", reviewNote: "판매 가격 수정 확인" });
      report = { ...report, ...payload.body, reviewedAt: new Date().toISOString() };
      data = report;
    }
    await route.fulfill({ json: { data } });
  });
  await page.goto("/");
  await page.getByLabel("이메일").fill("admin@example.test");
  await page.getByLabel("비밀번호").fill("not-a-real-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
  await page.getByRole("button", { name: /정보 신고/ }).filter({ visible: true }).first().click();
  await expect(page.getByText(report.productName)).toBeVisible();
  await page.getByLabel("검수 메모").fill("판매 가격 수정 확인");
  const evidence = resolve(process.env.E2E_EVIDENCE_DIR ?? "test-results");
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: resolve(evidence, `${testInfo.project.name.replaceAll(" ", "-")}-${width}-product-reports.png`), fullPage: true });
  await page.getByRole("button", { name: "수정 완료", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("신고 처리 상태를 저장했습니다.");
  await page.getByLabel("처리 상태", { exact: true }).selectOption("RESOLVED");
  await expect(page.getByText("판매 가격 수정 확인", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
