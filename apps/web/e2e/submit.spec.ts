import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const SUBMIT_URL = `${BASE_URL}/submit`;

/**
 * Helper: fill a field by its id.
 */
async function fillField(page: Page, id: string, value: string) {
  await page.locator(`#${id}`).fill(value);
}

/**
 * Get the feedback message div (our app's feedback, not Next.js route announcer).
 * Uses :not to exclude the Next.js internal announcer.
 */
function appFeedback(page: Page) {
  return page.locator('div[role="alert"]:not([id="__next-route-announcer__"])');
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe("SubmitScreen Page Rendering", () => {
  test("제출 페이지가 정상적으로 렌더링된다", async ({ page }) => {
    await page.goto(SUBMIT_URL);

    await expect(page.locator("h1")).toContainText("공구 제보하기");

    const fields = [
      "productName", "brandName", "startDate", "endDate",
      "purchaseUrl", "discountInfo", "instagramUrl", "imageUrls", "summary",
    ];
    for (const field of fields) {
      await expect(page.locator(`#${field}`)).toBeVisible();
    }

    await expect(page.locator('button[type="submit"]')).toContainText("제보 제출");
  });

  test("필수 필드 표시: 제품명에 * 표시가 있다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    const productLabel = page.locator('label[for="productName"]');
    await expect(productLabel).toBeVisible();
    await expect(productLabel.locator("span.text-error-500")).toContainText("*");
  });
});

test.describe("SubmitScreen HTML5 Native Validation", () => {
  test("빈 폼 제출 시 브라우저 기본 유효성 검사가 동작한다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    
    // Try submitting empty form — browser native validation should block it.
    // Instead of clicking the submit button (which native validation intercepts),
    // check that the form's validation is active.
    const isValid = await page.evaluate(() => {
      const form = document.querySelector("form");
      return form?.checkValidity();
    });
    
    // With empty productName (required), the form should be invalid
    expect(isValid).toBe(false);
  });

  test("제품명 필드가 required 속성을 가진다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await expect(page.locator("#productName")).toHaveAttribute("required", "");
  });

  test("제품명 필드가 minLength=2 속성을 가진다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await expect(page.locator("#productName")).toHaveAttribute("minLength", "2");
  });
});

test.describe("SubmitScreen JavaScript Validation (bypass native)", () => {
  // Bypass native validation by adding novalidate to the form,
  // then test the React validation layer for URL/date fields.

  async function bypassNativeValidation(page: Page) {
    await page.evaluate(() => {
      document.querySelector("form")?.setAttribute("novalidate", "");
    });
  }

  test("잘못된 구매 링크 URL 형식이면 에러 메시지가 표시된다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await bypassNativeValidation(page);
    await fillField(page, "productName", "테스트 제품");
    await fillField(page, "purchaseUrl", "not-a-url");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 5000 });
    await expect(feedback).toContainText("http(s)");
  });

  test("잘못된 인스타그램 URL 형식이면 에러 메시지가 표시된다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await bypassNativeValidation(page);
    await fillField(page, "productName", "테스트 제품");
    await fillField(page, "instagramUrl", "invalid-ig-url");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 5000 });
    await expect(feedback).toContainText("인스타그램 URL");
  });

  test("시작일이 종료일보다 늦으면 에러 메시지가 표시된다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await bypassNativeValidation(page);
    await fillField(page, "productName", "테스트 제품");
    await fillField(page, "startDate", "2026-07-01");
    await fillField(page, "endDate", "2026-06-01");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 5000 });
    await expect(feedback).toContainText("시작일은 종료일보다 늦을 수 없습니다");
  });

  test("잘못된 이미지 URL 형식이면 에러 메시지가 표시된다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await bypassNativeValidation(page);
    await fillField(page, "productName", "테스트 제품");
    await fillField(page, "imageUrls", "not-a-image-url");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 5000 });
    await expect(feedback).toContainText("이미지 URL");
  });
});

test.describe("SubmitScreen Happy Path (Mock API)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the submission API
    await page.route("**/api/v1/submissions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-submission-1",
          productName: "테스트 제품",
          status: "REVIEW_REQUIRED",
        }),
      });
    });
  });

  test("필수 필드만 입력하고 제출에 성공한다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await fillField(page, "productName", "비건 선크림");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 10000 });
    await expect(feedback).toContainText("접수되었습니다");
  });

  test("모든 필드를 입력하고 제출에 성공한다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await fillField(page, "productName", "프리미엄 유아용품 세트");
    await fillField(page, "brandName", "맘편한세상");
    await fillField(page, "startDate", "2026-06-15");
    await fillField(page, "endDate", "2026-07-15");
    await fillField(page, "purchaseUrl", "https://smartstore.naver.com/test");
    await fillField(page, "discountInfo", "35% 할인");
    await fillField(page, "instagramUrl", "https://www.instagram.com/p/ABC123/");
    await fillField(page, "imageUrls", "https://example.com/image.jpg");
    await fillField(page, "summary", "신생아부터 돌까지 필요한 유아용품을 한 번에.");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 10000 });
    await expect(feedback).toContainText("접수되었습니다");
  });

  test("인스타그램 URL 없이 기본 필드만으로 제출할 수 있다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await fillField(page, "productName", "올인원 홈트레이닝 키트");
    await fillField(page, "brandName", "핏스타그램");
    await fillField(page, "purchaseUrl", "https://example.com/fitness");
    await fillField(page, "discountInfo", "25% 할인");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 10000 });
    await expect(feedback).toContainText("접수되었습니다");
  });
});

test.describe("SubmitScreen API Error Handling", () => {
  test("API 400 에러 시 적절한 에러 메시지가 표시된다", async ({ page }) => {
    await page.route("**/api/v1/submissions", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "입력값을 확인해주세요." }),
      });
    });
    await page.goto(SUBMIT_URL);
    await fillField(page, "productName", "테스트 제품");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 10000 });
    // The apiClient throws an error with the message from the response body
    await expect(feedback).toContainText("입력값을 확인해주세요");
  });

  test("네트워크 오류 시 에러 메시지가 표시된다", async ({ page }) => {
    await page.route("**/api/v1/submissions", async (route) => {
      await route.abort("connectionrefused");
    });
    await page.goto(SUBMIT_URL);
    await fillField(page, "productName", "네트워크 테스트");
    await page.click('button[type="submit"]');

    const feedback = appFeedback(page);
    await expect(feedback).toBeVisible({ timeout: 10000 });
    // fetch failed with "Failed to fetch" — the error.message shows this
    await expect(feedback).toContainText("Failed to fetch");
  });
});

test.describe("SubmitScreen Accessibility", () => {
  test("입력 필드에 label이 연결되어 있다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    const fields = [
      "productName", "brandName", "startDate", "endDate",
      "purchaseUrl", "discountInfo", "instagramUrl", "imageUrls", "summary",
    ];
    for (const field of fields) {
      await expect(page.locator(`label[for="${field}"]`)).toBeVisible();
    }
  });

  test("submit 버튼이 초기에 활성화되어 있다", async ({ page }) => {
    await page.goto(SUBMIT_URL);
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });
});
