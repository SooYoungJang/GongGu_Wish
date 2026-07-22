import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const evidenceDir = resolve(
  process.env.E2E_EVIDENCE_DIR ??
    process.env.PLAYWRIGHT_OUTPUT_DIR ??
    "test-results",
);

const imageDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480'%3E%3Crect width='100%25' height='100%25' fill='%230f766e'/%3E%3Ctext x='40' y='240' fill='white' font-size='40'%3ELive preview%3C/text%3E%3C/svg%3E";

type MockState = ReturnType<typeof createMockState>;

function createMockState() {
  const submission = {
    id: "submission-live-preview",
    productName: "대기중 라이브 프리뷰 위시",
    brandName: "프리뷰 브랜드",
    instagramUsername: "preview_shop",
    category: "beauty",
    startDate: "2020-07-10T00:00:00.000Z",
    endDate: "2099-12-31T00:00:00.000Z",
    purchaseUrl: "https://example.test/submission",
    discountInfo: "20% 할인 · 배송비 무료",
    priceKrw: 12900,
    summary: "승인 전 라이브 프리뷰를 확인하는 위시입니다.",
    instagramUrl: "https://instagram.example.test/live-preview",
    imageUrls: [imageDataUrl],
    mediaItems: [
      { url: imageDataUrl, mediaType: "IMAGE" },
      {
        url: "https://media.example.test/live-preview.mp4",
        mediaType: "VIDEO",
        thumbnailUrl: imageDataUrl,
      },
    ],
    reporterName: "테스트 제보자",
    reporterContact: "010-0000-0000",
    isAnonymous: false,
    contentHash: "mock-submission-hash",
    status: "PENDING",
    adminMemo: "모킹된 검수 항목",
    reviewedAt: null,
    reviewedBy: null,
    groupBuyId: null,
    isHomeBanner: true,
    homeBannerStartDate: "2020-07-10",
    homeBannerEndDate: "2099-12-31",
    createdAt: "2035-07-01T09:00:00.000Z",
    updatedAt: "2035-07-01T09:00:00.000Z",
  };

  const groupBuy = {
    id: "group-buy-live-preview",
    productName: "승인된 모바일 라이브 프리뷰 공구",
    brandName: "프리뷰 브랜드",
    instagramUsername: "preview_shop",
    category: "beauty",
    startDate: "2020-07-10T00:00:00.000Z",
    endDate: "2099-12-31T00:00:00.000Z",
    purchaseUrl: "https://example.test/group-buy",
    discountInfo: "20% 할인 · 배송비 무료",
    priceKrw: 12900,
    summary: "320px 모바일 상세 프리뷰를 확인하는 승인 공구입니다.",
    thumbnailUrl: imageDataUrl,
    videoUrl: "https://media.example.test/live-preview.mp4",
    mediaUrls: [imageDataUrl, "https://media.example.test/live-preview.mp4"],
    mediaItems: [
      { url: imageDataUrl, mediaType: "IMAGE" },
      {
        url: "https://media.example.test/live-preview.mp4",
        mediaType: "VIDEO",
        thumbnailUrl: imageDataUrl,
      },
    ],
    mediaType: "VIDEO",
    status: "APPROVED",
    sourceType: "SUBMISSION",
    submissionId: submission.id,
    isAllDay: true,
    isMonthlyFeatured: false,
    monthlyFeaturedRank: null,
    isHomeBanner: true,
    homeBannerStartDate: "2020-07-10",
    homeBannerEndDate: "2099-12-31",
    createdAt: "2035-07-01T09:30:00.000Z",
    updatedAt: "2035-07-01T09:30:00.000Z",
  };

  return {
    groupBuy,
    submission,
    hikerDelayMs: 0,
    hikerLookups: 0,
    hikerResolutions: 0,
    updates: [] as Array<{
      path: string;
      method: string;
      body: Record<string, unknown>;
    }>,
  };
}

function dashboard(state: MockState) {
  return {
    totals: {
      submissions: 1,
      pending: 1,
      approved: 1,
      rejected: 0,
      groupBuys: 1,
      activeGroupBuys: 1,
      users: 0,
    },
    pendingQueue: [state.submission],
    recentUsers: [],
    recentGroupBuys: [state.groupBuy],
    categoryDistribution: { beauty: 1 },
  };
}

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

async function installMocks(page: Page, state: MockState) {
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
    expect(request.headers()["authorization"]).toBe(
      "Bearer mock-admin-access-token",
    );
    const payload = request.postDataJSON() as {
      path: string;
      method: string;
      body?: Record<string, unknown>;
    };
    const body = payload.body ?? {};
    let data: unknown;

    switch (payload.path) {
      case "/admin/dashboard":
        data = dashboard(state);
        break;
      case "/admin/submissions":
        data = { items: [state.submission], total: 1 };
        break;
      case "/admin/group-buys":
        data = { items: [state.groupBuy], total: 1 };
        break;
      case `/admin/submissions/${state.submission.id}`:
        expect(payload.method).toBe("PATCH");
        state.updates.push({
          path: payload.path,
          method: payload.method,
          body,
        });
        Object.assign(state.submission, body, {
          updatedAt: "2035-07-02T09:00:00.000Z",
        });
        data = state.submission;
        break;
      case `/admin/submissions/${state.submission.id}/approve`:
        expect(payload.method).toBe("POST");
        state.updates.push({
          path: payload.path,
          method: payload.method,
          body,
        });
        Object.assign(state.submission, body, {
          status: "APPROVED",
          groupBuyId: state.groupBuy.id,
          updatedAt: "2035-07-02T09:15:00.000Z",
        });
        Object.assign(state.groupBuy, body, {
          productName: body.productName,
          priceKrw: body.priceKrw,
          updatedAt: "2035-07-02T09:15:00.000Z",
        });
        data = { submission: state.submission, groupBuy: state.groupBuy };
        break;
      case "/admin/hiker-lookup":
        state.hikerLookups += 1;
        if (state.hikerDelayMs > 0) {
          await new Promise((resolvePromise) =>
            setTimeout(resolvePromise, state.hikerDelayMs),
          );
        }
        state.hikerResolutions += 1;
        data = {
          caption: "늦게 도착한 Hiker 요약",
          username: "late_hiker",
          mediaItems: [],
          mediaUrls: [],
          mediaType: "IMAGE",
        };
        break;
      case `/admin/group-buys/${state.groupBuy.id}`:
        expect(payload.method).toBe("PATCH");
        state.updates.push({
          path: payload.path,
          method: payload.method,
          body,
        });
        Object.assign(state.groupBuy, body, {
          updatedAt: "2035-07-02T09:30:00.000Z",
        });
        data = state.groupBuy;
        break;
      default:
        throw new Error(`Unexpected mocked admin API request: ${payload.path}`);
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("이메일").fill("admin@gonggu.local");
  await page.getByLabel("비밀번호").fill("not-a-real-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
}

async function openSubmissions(page: Page) {
  await page.getByRole("button", { name: /검수/ }).first().click();
}

async function expectCenteredDialog(page: Page, name: RegExp) {
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible();
  const [box, viewport] = await Promise.all([
    dialog.boundingBox(),
    page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    })),
  ]);

  expect(box).not.toBeNull();
  if (!box) return;
  expect(
    Math.abs(box.x + box.width / 2 - viewport.width / 2),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(box.y + box.height / 2 - viewport.height / 2),
  ).toBeLessThanOrEqual(2);
  expect(box.y).toBeGreaterThan(0);
}

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("모킹된 관리자 로그인으로 라이브 프리뷰와 중앙 날짜 선택기를 검증한다", async ({
  browser,
}, testInfo) => {
  test.skip(
    !["chromium", "Mobile Safari"].includes(testInfo.project.name),
    "Mobile Chrome is redundant because this spec creates its own 320px context.",
  );
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePrefix = `admin-live-preview-${testInfo.project.name}`;

  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: evidenceDir, size: { width: 1280, height: 900 } },
  });
  const desktopPage = await desktopContext.newPage();
  const desktopConsoleErrors = collectConsoleErrors(desktopPage);
  const desktopState = createMockState();
  await installMocks(desktopPage, desktopState);

  await login(desktopPage);
  await desktopPage.getByRole("button", { name: "위시 검수" }).click();
  await desktopPage
    .getByRole("row", { name: /대기중 라이브 프리뷰 위시/ })
    .click();

  const submissionDetail = desktopPage.locator(".detail-panel");
  const preview = submissionDetail.locator(".app-live-preview");
  await expect(preview).toBeVisible();
  await expect(
    preview.getByText("홈 배너 노출", { exact: true }),
  ).toBeVisible();
  await expect(submissionDetail.getByLabel("홈 배너에 노출")).toBeChecked();
  await expect(preview.getByRole("tab", { name: "홈 배너" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    preview.locator(".app-live-preview__home-banner-status > strong"),
  ).toHaveText("20%");
  await expect(
    preview.locator(".app-live-preview__home-banner-status > strong"),
  ).toHaveCSS("color", "rgb(240, 68, 94)");
  await expect(
    preview.locator(".app-live-preview__home-banner-price"),
  ).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(
    preview.locator(".app-live-preview__home-banner-price-value"),
  ).toHaveCSS("font-weight", "900");
  await expect(
    preview.locator(".app-live-preview__home-banner-account"),
  ).toHaveText("@preview_shop");
  await preview.locator(".app-live-preview__home-banner").screenshot({
    path: resolve(evidenceDir, `${evidencePrefix}-home-banner.png`),
  });

  await preview.getByRole("tab", { name: "공구 카드" }).click();
  await expect(preview.locator(".app-live-preview__panel")).toHaveClass(
    /app-live-preview__panel--card/,
  );
  await expect(
    preview.locator(".app-live-preview__deal-card-sale-badge"),
  ).toContainText("배송비 무료");
  await expect(
    preview.locator(".app-live-preview__deal-card-brand"),
  ).toHaveText("프리뷰 브랜드 · @preview_shop");
  await expect(
    preview.locator(".app-live-preview__deal-card-price"),
  ).toHaveText("가격 12,900원");
  await expect(
    preview.locator(".app-live-preview__deal-card-deadline-badge"),
  ).toContainText("일 남음");
  await expect(preview.getByRole("tab", { name: "홈 주간 공구" })).toHaveCount(
    0,
  );
  const [cardBox, panelBox] = await Promise.all([
    preview.locator(".app-live-preview__deal-card").boundingBox(),
    preview.locator(".app-live-preview__panel").boundingBox(),
  ]);
  expect(cardBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  if (cardBox && panelBox) {
    expect(cardBox.width).toBeGreaterThanOrEqual(panelBox.width - 24);
  }
  await preview.locator(".app-live-preview__deal-card").screenshot({
    path: resolve(evidenceDir, `${evidencePrefix}-deal-card.png`),
  });

  await preview.getByRole("tab", { name: "상세 화면" }).click();
  await expect(preview.getByRole("tabpanel")).toContainText("12,900원");
  await expect(preview.getByRole("tabpanel")).toContainText("@preview_shop");
  await expect(preview.getByRole("tabpanel")).toContainText("뷰티");
  await expect(preview.getByRole("tabpanel")).not.toContainText("beauty");
  await preview.locator(".app-live-preview__detail").screenshot({
    path: resolve(evidenceDir, `${evidencePrefix}-detail.png`),
  });

  await submissionDetail.getByLabel("가격 (원)").fill("15900");
  await expect(submissionDetail.getByLabel("비디오 URL")).toHaveCount(0);
  await expect(submissionDetail.getByLabel("미디어 JSON")).toHaveCount(0);
  await expect(preview.getByRole("tabpanel")).toContainText("15,900원");

  await expect(preview.getByRole("tabpanel")).toContainText("미디어 2개");
  await submissionDetail.getByRole("button", { name: "저장" }).click();
  await expect(desktopPage.getByRole("status")).toContainText(
    "위시 정보를 저장했습니다.",
  );
  expect(desktopState.updates).toContainEqual(
    expect.objectContaining({
      path: "/admin/submissions/submission-live-preview",
      method: "PATCH",
      body: expect.objectContaining({ priceKrw: 15900, isHomeBanner: true }),
    }),
  );

  await submissionDetail.getByRole("button", { name: /^시작일 / }).click();
  await expectCenteredDialog(desktopPage, /시작일 달력/);
  await desktopPage.screenshot({
    path: resolve(evidenceDir, `${evidencePrefix}-desktop.png`),
    fullPage: true,
  });
  expect(desktopConsoleErrors).toEqual([]);
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 320, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: evidenceDir, size: { width: 320, height: 720 } },
  });
  const mobilePage = await mobileContext.newPage();
  const mobileConsoleErrors = collectConsoleErrors(mobilePage);
  const mobileState = createMockState();
  await installMocks(mobilePage, mobileState);

  await login(mobilePage);
  await mobilePage
    .locator(".bottom-tab-bar button")
    .filter({ hasText: "공구" })
    .click();
  await mobilePage
    .getByRole("button", { name: /승인된 모바일 라이브 프리뷰 공구/ })
    .click();

  const groupBuyDetail = mobilePage.locator(".detail-panel");
  await expect(groupBuyDetail.locator(".app-live-preview")).toBeVisible();
  await mobilePage.getByRole("tab", { name: "공구 카드" }).click();
  await expect(
    mobilePage.locator(".app-live-preview__deal-card"),
  ).toBeVisible();
  await expect(
    mobilePage.locator(".app-live-preview__deal-card-price"),
  ).toHaveText("가격 12,900원");
  await expect(
    mobilePage.getByRole("tab", { name: "홈 주간 공구" }),
  ).toHaveCount(0);
  await mobilePage.locator(".app-live-preview__deal-card").screenshot({
    path: resolve(evidenceDir, `${evidencePrefix}-deal-card-mobile-320.png`),
  });
  await expect(
    mobilePage.getByRole("tab", { name: "상세 화면" }),
  ).toBeVisible();
  await expect(mobilePage.getByText("종일 공구", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    mobilePage.getByText("이달의 공구", { exact: true }),
  ).toHaveCount(0);
  const widths = await mobilePage.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);

  await groupBuyDetail.getByRole("button", { name: /^마감일 / }).click();
  await expectCenteredDialog(mobilePage, /마감일 달력/);
  await mobilePage.screenshot({
    path: resolve(evidenceDir, `${evidencePrefix}-mobile-320.png`),
    fullPage: true,
  });
  expect(mobileConsoleErrors).toEqual([]);
  await mobileContext.close();
});

test("만료된 공구 카드 프리뷰는 음수 대신 마감으로 표시한다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "The deadline label is shared across responsive layouts.",
  );
  mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors = collectConsoleErrors(page);
  const state = createMockState();
  state.submission.endDate = "2000-01-01T00:00:00.000Z";
  await installMocks(page, state);

  await login(page);
  await page.getByRole("button", { name: "위시 검수" }).click();
  await page
    .getByRole("row", { name: /대기중 라이브 프리뷰 위시/ })
    .click();

  const preview = page.locator(".detail-panel .app-live-preview");
  await preview.getByRole("tab", { name: "공구 카드" }).click();
  await expect(
    preview.locator(".app-live-preview__deal-card-deadline-badge"),
  ).toHaveText("마감");
  await preview.locator(".app-live-preview__deal-card").screenshot({
    path: resolve(evidenceDir, "admin-expired-deal-card-deadline.png"),
  });
  expect(consoleErrors).toEqual([]);
});

test("공구 등록은 갱신 뒤에도 현재 입력값만 전송하고 Hiker를 다시 호출하지 않는다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "공유 React 상태 흐름은 Chromium에서 한 번만 검증합니다.",
  );
  const state = createMockState();
  await installMocks(page, state);

  await login(page);
  await openSubmissions(page);
  await page.getByRole("row", { name: /대기중 라이브 프리뷰 위시/ }).click();

  const detail = page.locator(".detail-panel");
  await detail.getByLabel("제품명").fill("스트라이더");
  await detail.getByLabel("가격 (원)").fill("159000");

  await page
    .getByRole("button", { name: "새로고침", exact: true })
    .click({ force: true });
  await expect(
    page.getByRole("button", { name: "새로고침", exact: true }),
  ).toBeEnabled();
  await expect(detail.getByLabel("제품명")).toHaveValue("스트라이더");
  await expect(detail.getByLabel("가격 (원)")).toHaveValue("159000");

  await detail.getByRole("button", { name: "공구 등록" }).click();
  await expect(page.getByRole("status")).toContainText(
    "위시를 공구로 등록했습니다.",
  );

  expect(state.hikerLookups).toBe(0);
  expect(state.updates).toContainEqual(
    expect.objectContaining({
      path: "/admin/submissions/submission-live-preview/approve",
      method: "POST",
      body: expect.objectContaining({
        productName: "스트라이더",
        priceKrw: 159000,
      }),
    }),
  );
});

test("공구 가격 저장 응답과 재조회 결과가 일치한다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "공유 React 상태 흐름은 Chromium에서 한 번만 검증합니다.",
  );
  const state = createMockState();
  await installMocks(page, state);

  await login(page);
  await page
    .locator("button:visible")
    .filter({ hasText: /공구 관리|공구/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: /공구 노출 관리/ }),
  ).toBeVisible();

  const records = page.locator(
    "tbody tr:visible, .mobile-record-card:visible:not(.mobile-record-card--static)",
  );
  await records.first().click({ force: true });
  const detail = page.locator(".detail-panel");
  await expect(detail.getByLabel("가격 (원)")).toHaveValue("12900");
  await detail.getByLabel("가격 (원)").fill("15900");
  await detail.getByLabel("홈 배너에 노출").uncheck();
  await detail.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("status")).toContainText(
    "공구 정보를 저장했습니다.",
  );

  await page.reload();
  if (
    await page
      .getByLabel("이메일")
      .isVisible()
      .catch(() => false)
  ) {
    await login(page);
  }
  await page
    .locator("button:visible")
    .filter({ hasText: /공구 관리|공구/ })
    .first()
    .click();
  const refreshedRecords = page.locator(
    "tbody tr:visible, .mobile-record-card:visible:not(.mobile-record-card--static)",
  );
  await refreshedRecords.first().click({ force: true });
  await expect(
    page.locator(".detail-panel").getByLabel("가격 (원)"),
  ).toHaveValue("15900");
  await expect(
    page.locator(".detail-panel").getByLabel("홈 배너에 노출"),
  ).not.toBeChecked();
  expect(state.updates).toContainEqual(
    expect.objectContaining({
      path: "/admin/group-buys/group-buy-live-preview",
      method: "PATCH",
      body: expect.objectContaining({ priceKrw: 15900, isHomeBanner: false }),
    }),
  );
});

test("닫은 상세의 늦은 Hiker 응답은 다시 연 폼을 덮어쓰지 않는다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "공유 React 상태 흐름은 Chromium에서 한 번만 검증합니다.",
  );
  const state = createMockState();
  state.hikerDelayMs = 500;
  await installMocks(page, state);

  await login(page);
  await openSubmissions(page);
  await page.getByRole("row", { name: /대기중 라이브 프리뷰 위시/ }).click();

  const hikerResponse = page.waitForResponse((response) => {
    const payload = response.request().postDataJSON() as {
      path?: string;
    } | null;
    return payload?.path === "/admin/hiker-lookup";
  });
  await page
    .locator(".detail-panel")
    .getByRole("button", { name: "Hiker 조회" })
    .click();
  await expect(page.locator(".hiker-lookup-overlay")).toBeVisible();
  await expect(page.locator(".hiker-lookup-overlay")).toContainText(
    "Hiker 데이터 조회 중",
  );
  await page
    .locator(".detail-panel")
    .getByRole("button", { name: /목록으로/ })
    .click();

  await page.getByRole("row", { name: /대기중 라이브 프리뷰 위시/ }).click();
  const reopenedDetail = page.locator(".detail-panel");
  await reopenedDetail.getByLabel("요약").fill("관리자가 다시 입력한 요약");

  await hikerResponse;
  await page.evaluate(
    () =>
      new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolveFrame()),
        );
      }),
  );
  expect(state.hikerResolutions).toBe(1);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Hiker 데이터로 승인 폼을 채웠습니다." }),
  ).toHaveCount(0);
  await expect(reopenedDetail.getByLabel("요약")).toHaveValue(
    "관리자가 다시 입력한 요약",
  );
  await expect(
    reopenedDetail.getByRole("button", { name: "공구 등록" }),
  ).toBeEnabled();
});
