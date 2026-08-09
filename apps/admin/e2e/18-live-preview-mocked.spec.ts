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
    originalPostUrl: null as string | null,
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
    confidence: 0.92,
    status: "APPROVED",
    sourceType: "SUBMISSION",
    submissionId: submission.id,
    rejectionReason: null as string | null,
    reviewedAt: null as string | null,
    reviewedBy: null as string | null,
    collectionReviewStatus: null as
      | "PENDING"
      | "APPROVED"
      | "REJECTED"
      | null,
    collectionProposalSnapshot: null as Record<string, unknown> | null,
    collectionReviewedSnapshot: null as Record<string, unknown> | null,
    collectionRulesetVersion: null as string | null,
    collectionHikerUsed: false,
    collectionHikerLookupAt: null as string | null,
    isAllDay: true,
    isMonthlyFeatured: false,
    monthlyFeaturedRank: null,
    isHomeBanner: true,
    homeBannerStartDate: "2020-07-10",
    homeBannerEndDate: "2099-12-31",
    createdAt: "2035-07-01T09:30:00.000Z",
    updatedAt: "2035-07-01T09:30:00.000Z",
  };

  const groupBuyRequest = {
    id: "group-buy-request-live-preview",
    productName:
      "초경량무선청소기흡입력강화저소음알레르기필터물걸레겸용프리미엄패키지",
    status: "OPEN",
    requestCount: 12,
    createdAt: "2035-06-20T09:00:00.000Z",
    latestRequestedAt: "2035-07-02T10:00:00.000Z",
  };

  return {
    groupBuy,
    groupBuyRequest,
    groupBuyRequestCalls: [] as Array<Record<string, unknown>>,
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
      params?: Record<string, unknown>;
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
        {
          const requestedReviewStatus = payload.params
            ?.collectionReviewStatus;
          const items =
            typeof requestedReviewStatus !== "string" ||
            requestedReviewStatus === state.groupBuy.collectionReviewStatus
              ? [state.groupBuy]
              : [];
          data = { items, total: items.length };
        }
        break;
      case "/admin/group-buy-requests":
        state.groupBuyRequestCalls.push(payload.params ?? {});
        data = { items: [state.groupBuyRequest], total: 1 };
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
        data = {
          submission: state.submission,
          groupBuy: state.groupBuy,
          notificationDelivery: {
            status: "skipped",
            queued: 0,
            sent: 0,
            skipped: 0,
            retrying: 0,
            failed: 0,
          },
        };
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
      case `/admin/group-buys/${state.groupBuy.id}/hiker-lookup`:
        expect(payload.method).toBe("POST");
        state.hikerLookups += 1;
        state.groupBuy.collectionHikerUsed = true;
        state.groupBuy.collectionHikerLookupAt =
          "2035-07-02T09:20:00.000Z";
        data = {
          imageUrl: imageDataUrl,
          thumbnailUrl: imageDataUrl,
          videoUrl: null,
          mediaUrls: [imageDataUrl],
          mediaItems: [{ url: imageDataUrl, mediaType: "IMAGE" }],
          mediaType: "IMAGE",
          caption: "Hiker 자동 보완 공구 게시물",
          likeCount: 25,
          username: "hiker_auto_shop",
          profileImageUrl: imageDataUrl,
          takenAt: "2035-07-01T08:00:00.000Z",
          suggestions: {
            source: "llm",
            productName: "Hiker 자동 보완 공구",
            brandName: "Hiker 브랜드",
            category: "living",
            discountInfo: "Hiker 확인 할인",
            startDate: "2035-07-03",
            endDate: "2035-07-15",
            priceKrw: "25900",
          },
        };
        break;
      case `/admin/group-buys/${state.groupBuy.id}/approve`:
        {
          expect(payload.method).toBe("POST");
          state.updates.push({
            path: payload.path,
            method: payload.method,
            body,
          });
          const reviewedData =
            body.reviewedData && typeof body.reviewedData === "object"
              ? (body.reviewedData as Record<string, unknown>)
              : {};
          Object.assign(state.groupBuy, reviewedData, {
            status: "APPROVED",
            collectionReviewStatus: "APPROVED",
            collectionReviewedSnapshot: reviewedData,
            rejectionReason: null,
            reviewedAt: "2035-07-02T09:30:00.000Z",
            reviewedBy: "mock-admin-id",
            updatedAt: "2035-07-02T09:30:00.000Z",
          });
          data = state.groupBuy;
        }
        break;
      case `/admin/group-buys/${state.groupBuy.id}/reject`:
        {
          expect(payload.method).toBe("POST");
          state.updates.push({
            path: payload.path,
            method: payload.method,
            body,
          });
          const reviewedData =
            body.reviewedData && typeof body.reviewedData === "object"
              ? (body.reviewedData as Record<string, unknown>)
              : {};
          Object.assign(state.groupBuy, {
            status: "REJECTED",
            collectionReviewStatus: "REJECTED",
            collectionReviewedSnapshot: reviewedData,
            rejectionReason: String(body.reason ?? ""),
            reviewedAt: "2035-07-02T09:35:00.000Z",
            reviewedBy: "mock-admin-id",
            updatedAt: "2035-07-02T09:35:00.000Z",
          });
          data = state.groupBuy;
        }
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
  ).toHaveText("@preview_shop");
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

test("공구 요청 탭은 집계 수요를 식별 정보 없이 읽기 전용으로 표시한다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "공유 관리자 목록 흐름은 Chromium에서 한 번만 검증합니다.",
  );
  mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors = collectConsoleErrors(page);
  const state = createMockState();
  await installMocks(page, state);
  await login(page);

  await page
    .getByRole("button", { name: /공구 요청/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "공구 요청 현황" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", {
      name: new RegExp(`${state.groupBuyRequest.productName}.*진행 중.*12건`),
    }),
  ).toBeVisible();
  await expect(page.locator(".detail-panel")).toHaveCount(0);
  await page.screenshot({
    path: resolve(evidenceDir, "admin-group-buy-requests-desktop.png"),
    fullPage: true,
  });

  await page.getByRole("textbox", { name: "검색" }).fill("청소기");
  await expect.poll(() => state.groupBuyRequestCalls.at(-1)?.q).toBe("청소기");
  await page.getByRole("combobox", { name: "상태 필터" }).selectOption("OPEN");
  await expect
    .poll(() => state.groupBuyRequestCalls.at(-1)?.status)
    .toBe("OPEN");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCard = page.locator("article.mobile-record-card--static");
  await expect(mobileCard).toBeVisible();
  const mobileProductName = mobileCard.locator(
    ".group-buy-request-product-name",
  );
  await expect(mobileProductName).toHaveText(state.groupBuyRequest.productName);
  await expect(mobileCard).toContainText("12건");
  expect(
    await mobileProductName.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: resolve(evidenceDir, "admin-group-buy-requests-mobile-390.png"),
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});

test("자동 수집 검수 항목은 안전한 Instagram 원본 링크를 제공한다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "자동 수집 원본 링크는 Chromium에서 한 번만 검증합니다.",
  );
  mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors = collectConsoleErrors(page);
  const state = createMockState();
  state.groupBuy.status = "REVIEW_REQUIRED";
  state.groupBuy.sourceType = "PLAYWRIGHT_PUBLIC";
  state.groupBuy.submissionId = null;
  state.groupBuy.collectionReviewStatus = "PENDING";
  state.groupBuy.collectionRulesetVersion = "mock-latest3-v2";
  state.groupBuy.originalPostUrl =
    "https://www.instagram.com/p/automatic-current/";
  state.groupBuy.collectionProposalSnapshot = {
    originalPostUrl: "https://www.instagram.com/p/automatic-source/",
  };
  await installMocks(page, state);

  await login(page);
  const automaticCollectionTab = page
    .locator("nav.nav-tabs button")
    .filter({ hasText: "자동 수집 검수" });
  await expect(automaticCollectionTab).toHaveCount(1);
  await automaticCollectionTab.click();

  const row = page.getByRole("row", {
    name: /승인된 모바일 라이브 프리뷰 공구/,
  });
  await expect(row).toBeVisible();
  const sourceLink = row.getByRole("link", {
    name: "승인된 모바일 라이브 프리뷰 공구 원본 Instagram 게시물 열기",
  });
  await expect(sourceLink).toHaveCount(1);
  await expect(sourceLink).toHaveAttribute(
    "href",
    "https://www.instagram.com/p/automatic-source/",
  );
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
  await page.screenshot({
    path: resolve(evidenceDir, "admin-auto-collection-source-link.png"),
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});

test("자동 수집 검수에서 Hiker 보완 뒤 공구 등록하고 이력을 다시 조회한다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "자동 수집 검수 작업은 Chromium에서 한 번만 검증합니다.",
  );
  mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors = collectConsoleErrors(page);
  const state = createMockState();
  state.groupBuy.status = "REVIEW_REQUIRED";
  state.groupBuy.sourceType = "PLAYWRIGHT_PUBLIC";
  state.groupBuy.submissionId = null;
  state.groupBuy.collectionReviewStatus = "PENDING";
  state.groupBuy.collectionRulesetVersion = "mock-latest3-v2";
  state.groupBuy.originalPostUrl =
    "https://www.instagram.com/p/automatic-current/";
  state.groupBuy.collectionProposalSnapshot = {
    originalPostUrl: "https://www.instagram.com/p/automatic-collected/",
  };
  await installMocks(page, state);

  await login(page);
  await page
    .locator("nav.nav-tabs button")
    .filter({ hasText: "자동 수집 검수" })
    .click();
  await page
    .getByRole("row", { name: /승인된 모바일 라이브 프리뷰 공구/ })
    .click();

  const detail = page.locator(".detail-panel");
  await expect(
    detail.getByRole("link", { name: "Instagram 원본" }),
  ).toHaveAttribute(
    "href",
    "https://www.instagram.com/p/automatic-collected/",
  );
  await detail.getByRole("button", { name: "Hiker 조회" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Hiker 데이터로 자동수집 검수 폼을 채웠습니다.",
  );
  await expect(detail.getByLabel("제품명")).toHaveValue(
    "Hiker 자동 보완 공구",
  );
  await expect(detail.getByLabel("가격 (원)")).toHaveValue("25900");
  expect(state.hikerLookups).toBe(1);
  await page.screenshot({
    path: resolve(evidenceDir, "admin-auto-collection-hiker-pending.png"),
    fullPage: true,
  });

  await detail.getByRole("button", { name: "공구 등록" }).click();
  await expect(page.getByRole("status")).toContainText(
    "자동수집 공구를 등록했습니다.",
  );
  expect(state.updates).toContainEqual(
    expect.objectContaining({
      path: "/admin/group-buys/group-buy-live-preview/approve",
      method: "POST",
      body: expect.objectContaining({
        reviewedData: expect.objectContaining({
          productName: "Hiker 자동 보완 공구",
          priceKrw: 25900,
        }),
      }),
    }),
  );
  state.groupBuy.productName = "공구 관리에서 나중에 수정된 이름";

  await page
    .getByRole("combobox", { name: "상태 필터" })
    .selectOption("APPROVED");
  await page
    .getByRole("row", { name: /공구 관리에서 나중에 수정된 이름/ })
    .click();
  const historyDetail = page.locator(".detail-panel");
  await expect(historyDetail.getByLabel("제품명")).toBeDisabled();
  await expect(historyDetail.getByLabel("제품명")).toHaveValue(
    "Hiker 자동 보완 공구",
  );
  await expect(
    historyDetail.getByRole("button", { name: "공구 등록" }),
  ).toHaveCount(0);
  await expect(historyDetail.locator(".audit-card")).toContainText(
    "mock-admin-id",
  );
  await page.screenshot({
    path: resolve(evidenceDir, "admin-auto-collection-approved-history.png"),
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});

test("자동 수집 검수 반려 사유와 결정 이력을 보존한다", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "자동 수집 반려 작업은 Chromium에서 한 번만 검증합니다.",
  );
  mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors = collectConsoleErrors(page);
  const state = createMockState();
  state.groupBuy.status = "REVIEW_REQUIRED";
  state.groupBuy.sourceType = "PLAYWRIGHT_PUBLIC";
  state.groupBuy.submissionId = null;
  state.groupBuy.collectionReviewStatus = "PENDING";
  state.groupBuy.collectionRulesetVersion = "mock-latest3-v2";
  state.groupBuy.originalPostUrl =
    "https://www.instagram.com/reel/automatic-reject/";
  state.groupBuy.collectionProposalSnapshot = {
    originalPostUrl: state.groupBuy.originalPostUrl,
  };
  await installMocks(page, state);

  await login(page);
  await page
    .locator("nav.nav-tabs button")
    .filter({ hasText: "자동 수집 검수" })
    .click();
  await page
    .getByRole("row", { name: /승인된 모바일 라이브 프리뷰 공구/ })
    .click();

  const detail = page.locator(".detail-panel");
  await detail
    .getByLabel("반려 사유")
    .fill("공구 상품이 아닌 일반 게시물");
  await detail.getByRole("button", { name: "반려", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "자동수집 항목을 반려했습니다.",
  );
  expect(state.updates).toContainEqual(
    expect.objectContaining({
      path: "/admin/group-buys/group-buy-live-preview/reject",
      method: "POST",
      body: expect.objectContaining({
        reason: "공구 상품이 아닌 일반 게시물",
        reviewedData: expect.any(Object),
      }),
    }),
  );

  await page
    .getByRole("combobox", { name: "상태 필터" })
    .selectOption("REJECTED");
  await page
    .getByRole("row", { name: /승인된 모바일 라이브 프리뷰 공구/ })
    .click();
  const historyDetail = page.locator(".detail-panel");
  await expect(historyDetail.getByLabel("제품명")).toBeDisabled();
  await expect(historyDetail.locator(".audit-card")).toContainText(
    "공구 상품이 아닌 일반 게시물",
  );
  await page.screenshot({
    path: resolve(evidenceDir, "admin-auto-collection-rejected-history.png"),
    fullPage: true,
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
  await expect(page.getByRole("status")).toContainText("공구로 등록했습니다.");

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
