import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const evidenceDir = resolve(
  process.env.E2E_EVIDENCE_DIR ?? "test-results/push-admin-audience",
);

function sessionResponse() {
  const user = {
    id: "mock-admin-id",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@gonggu.local",
    email_confirmed_at: "2035-07-01T00:00:00.000Z",
    app_metadata: { role: "admin", roles: ["admin"] },
    user_metadata: {},
    created_at: "2035-07-01T00:00:00.000Z",
    updated_at: "2035-07-01T00:00:00.000Z",
  };

  return {
    access_token: "mock-admin-access-token",
    refresh_token: "mock-admin-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
}

function createState() {
  return {
    notificationRequest: null as Record<string, unknown> | null,
  };
}

async function installMocks(page: Page, state: ReturnType<typeof createState>) {
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    const session = sessionResponse();
    if (url.includes("/token")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(session),
      });
      return;
    }
    if (url.includes("/user")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(session.user),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.route("**/functions/v1/admin-api", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as {
      path: string;
      method: string;
      body?: Record<string, unknown>;
    };

    if (payload.path === "/admin/dashboard") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            totals: {
              submissions: 0,
              pending: 0,
              approved: 0,
              rejected: 0,
              groupBuys: 0,
              activeGroupBuys: 0,
              users: 2,
            },
            pendingQueue: [],
            recentUsers: [],
            recentGroupBuys: [],
            categoryDistribution: {},
          },
        }),
      });
      return;
    }

    if (payload.path === "/admin/users") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            total: 2,
            items: [
              {
                id: "user-ready",
                email: "ready@example.com",
                nickname: "푸시 가능 사용자",
                fcmToken: null,
                hasPushToken: true,
                createdAt: "2035-07-01T00:00:00.000Z",
                updatedAt: "2035-07-01T00:00:00.000Z",
                status: "ACTIVE",
              },
              {
                id: "user-offline",
                email: "offline@example.com",
                nickname: "토큰 없음 사용자",
                fcmToken: null,
                hasPushToken: false,
                createdAt: "2035-07-01T00:00:00.000Z",
                updatedAt: "2035-07-01T00:00:00.000Z",
                status: "ACTIVE",
              },
            ],
          },
        }),
      });
      return;
    }

    if (payload.path === "/admin/notifications") {
      expect(payload.method).toBe("POST");
      state.notificationRequest = payload.body ?? null;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            provider: "expo",
            targeted: 1,
            sent: 1,
            failed: 0,
            invalidTokensRemoved: 0,
          },
        }),
      });
      return;
    }

    throw new Error(`Unexpected mocked admin API request: ${payload.path}`);
  });
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("이메일").fill("admin@gonggu.local");
  await page.getByLabel("비밀번호").fill("not-a-real-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
}

test("관리자는 선택 사용자에게 푸시를 발송하고 확인 결과를 볼 수 있다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "핵심 푸시 발송 흐름은 Chromium에서 한 번만 검증합니다.",
  );
  mkdirSync(evidenceDir, { recursive: true });
  const state = createState();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await installMocks(page, state);
  await login(page);

  await page.getByRole("button", { name: "푸시 발송" }).click();
  await page.getByRole("radio", { name: /^선택 사용자/ }).check();
  await expect(page.getByText("푸시 가능 사용자")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "토큰 없음 사용자 선택" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "푸시 가능 사용자 선택" }).check();
  await page.locator("#push-title").fill("개별 안내");
  await page.locator("#push-body").fill("선택 사용자 본문");
  await page.getByRole("button", { name: "선택 사용자에게 발송" }).click();
  await expect(
    page.getByRole("dialog", { name: "푸시를 발송할까요?" }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDir, "push-admin-confirmation-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "확인하고 발송" }).click();
  await expect(page.getByRole("status")).toContainText("발송 완료");

  expect(state.notificationRequest).toEqual({
    title: "개별 안내",
    body: "선택 사용자 본문",
    userIds: ["user-ready"],
  });
  expect(consoleErrors).toEqual([]);
  await page.screenshot({
    path: resolve(evidenceDir, "push-admin-selected-desktop.png"),
    fullPage: true,
  });
});
