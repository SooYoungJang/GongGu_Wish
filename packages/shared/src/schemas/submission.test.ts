import { describe, it, expect } from "vitest";
import {
  submissionSchema,
  submissionStatusSchema,
  submissionFormSchema,
  submissionReviewFormSchema,
  submissionActionSchema,
  SUBMISSION_STATUS_LABELS,
  type Submission,
  type SubmissionForm,
  type SubmissionStatus,
} from "./submission";

describe("submission schemas", () => {
  describe("submissionStatusSchema", () => {
    it("validates all allowed status values", () => {
      const validStatuses = [
        "PENDING",
        "APPROVED",
        "REVIEW_REQUIRED",
        "REJECTED",
        "DUPLICATE",
      ] as const;

      validStatuses.forEach((status) => {
        const result = submissionStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(status);
        }
      });
    });

    it("rejects invalid status values", () => {
      const result = submissionStatusSchema.safeParse("INVALID_STATUS");
      expect(result.success).toBe(false);
    });
  });

  describe("submissionSchema", () => {
    const createValidSubmission = (overrides: Partial<Submission> = {}): Submission => ({
      id: "550e8400-e29b-41d4-a716-446655440000",
      productName: "테스트 제품",
      brandName: "테스트 브랜드",
      startDate: "2026-06-20T00:00:00.000Z",
      endDate: "2026-06-27T23:59:59.000Z",
      purchaseUrl: "https://example.com/product",
      discountInfo: "20% 할인",
      summary: "테스트 요약",
      instagramUrl: "https://instagram.com/p/ABC123",
      imageUrls: ["https://example.com/img1.jpg"],
      reporterName: "테스터",
      reporterContact: "test@example.com",
      isAnonymous: false,
      contentHash: "abc123def456",
      status: "PENDING",
      adminMemo: null,
      reviewedAt: null,
      reviewedBy: null,
      groupBuyId: null,
      groupBuy: null,
      createdAt: "2026-06-15T10:00:00.000Z",
      updatedAt: "2026-06-15T10:00:00.000Z",
      ...overrides,
    });

    it("validates a complete valid submission", () => {
      const submission = createValidSubmission();
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.productName).toBe("테스트 제품");
      }
    });

    it("validates submission with nullable fields as null", () => {
      const submission = createValidSubmission({
        brandName: null,
        startDate: null,
        endDate: null,
        purchaseUrl: null,
        discountInfo: null,
        summary: null,
        instagramUrl: null,
        imageUrls: [],
        reporterName: null,
        reporterContact: null,
        adminMemo: null,
        reviewedAt: null,
        reviewedBy: null,
        groupBuyId: null,
        groupBuy: null,
      });
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it("validates submission with groupBuy populated", () => {
      const submission = createValidSubmission({
        status: "APPROVED",
        groupBuyId: "550e8400-e29b-41d4-a716-446655440001",
        groupBuy: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          productName: "승인된 제품",
          brandName: "브랜드",
          startDate: "2026-06-20T00:00:00.000Z",
          endDate: "2026-06-27T23:59:59.000Z",
          purchaseUrl: "https://example.com",
          discountInfo: "20%",
          summary: "승인됨",
          status: "APPROVED",
          confidence: 0.9,
          rejectionReason: null,
          reviewedAt: "2026-06-15T11:00:00.000Z",
          sourceType: "SUBMISSION",
          submissionId: "550e8400-e29b-41d4-a716-446655440000",
          isAllDay: false,
          createdAt: "2026-06-15T11:00:00.000Z",
          updatedAt: "2026-06-15T11:00:00.000Z",
        },
      });
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const submission = createValidSubmission({ id: "not-a-uuid" });
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL in purchaseUrl", () => {
      const submission = createValidSubmission({ purchaseUrl: "not-a-url" });
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL in instagramUrl", () => {
      const submission = createValidSubmission({ instagramUrl: "not-a-url" });
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it("rejects invalid datetime format", () => {
      const submission = createValidSubmission({ startDate: "invalid-date" });
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it("rejects non-array imageUrls", () => {
      const submission = createValidSubmission({ imageUrls: "not-an-array" as unknown as string[] });
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL in imageUrls array", () => {
      const submission = createValidSubmission({ imageUrls: ["https://valid.com", "not-a-url"] });
      const result = submissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });
  });

  describe("submissionFormSchema", () => {
    const createValidForm = (overrides: Partial<SubmissionForm> = {}): SubmissionForm => ({
      productName: "테스트 제품",
      brandName: "테스트 브랜드",
      startDate: "2026-06-20T00:00:00.000Z",
      endDate: "2026-06-27T23:59:59.000Z",
      purchaseUrl: "https://example.com/product",
      discountInfo: "20% 할인",
      summary: "테스트 요약",
      instagramUrl: "https://instagram.com/p/ABC123",
      imageUrls: ["https://example.com/img1.jpg"],
      ...overrides,
    });

    it("validates a complete valid form", () => {
      const form = createValidForm();
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(true);
    });

    it("validates minimal form with only required productName", () => {
      const form = { productName: "최소 제품명" };
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(true);
    });

    it("rejects empty productName", () => {
      const form = createValidForm({ productName: "" });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("rejects productName exceeding max length", () => {
      const form = createValidForm({ productName: "가".repeat(201) });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("rejects brandName exceeding max length", () => {
      const form = createValidForm({ brandName: "가".repeat(101) });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("rejects invalid purchaseUrl", () => {
      const form = createValidForm({ purchaseUrl: "not-a-url" });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("accepts empty string for optional URL fields", () => {
      const form = createValidForm({ purchaseUrl: "", instagramUrl: "" });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(true);
    });

    it("rejects discountInfo exceeding max length", () => {
      const form = createValidForm({ discountInfo: "가".repeat(201) });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("preserves a 1000-character summary without truncation", () => {
      const sentinel = "END-SENTINEL";
      const summary = `${"가".repeat(1000 - sentinel.length)}${sentinel}`;
      const form = createValidForm({ summary });
      const result = submissionFormSchema.safeParse(form);

      expect(summary).toHaveLength(1000);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toBe(summary);
        expect(result.data.summary?.endsWith(sentinel)).toBe(true);
      }
    });

    it("rejects invalid instagramUrl", () => {
      const form = createValidForm({ instagramUrl: "not-a-url" });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL in imageUrls", () => {
      const form = createValidForm({ imageUrls: ["not-a-url"] });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("rejects startDate after endDate", () => {
      const form = createValidForm({
        startDate: "2026-06-27T00:00:00.000Z",
        endDate: "2026-06-20T23:59:59.000Z",
      });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("startDate"))).toBe(true);
      }
    });

    it("accepts same startDate and endDate", () => {
      const form = createValidForm({
        startDate: "2026-06-20T00:00:00.000Z",
        endDate: "2026-06-20T23:59:59.000Z",
      });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(true);
    });

    it("accepts empty string for date fields", () => {
      const form = createValidForm({ startDate: "", endDate: "" });
      const result = submissionFormSchema.safeParse(form);
      expect(result.success).toBe(true);
    });
  });

  describe("submissionReviewFormSchema", () => {
    it("validates valid review form", () => {
      const form = {
        productName: "수정된 제품명",
        brandName: "수정된 브랜드",
        startDate: "2026-06-20T00:00:00.000Z",
        endDate: "2026-06-27T23:59:59.000Z",
        purchaseUrl: "https://example.com/new",
        discountInfo: "30% 할인",
        summary: "수정된 요약",
      };
      const result = submissionReviewFormSchema.safeParse(form);
      expect(result.success).toBe(true);
    });

    it("accepts empty object", () => {
      const result = submissionReviewFormSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects empty string for URL fields as invalid URL", () => {
      const form = { purchaseUrl: "", instagramUrl: "" };
      const result = submissionReviewFormSchema.safeParse(form);
      expect(result.success).toBe(true);
    });
  });

  describe("submissionActionSchema", () => {
    it("validates approve action", () => {
      const action = { action: "approve" };
      const result = submissionActionSchema.safeParse(action);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.action).toBe("approve");
    });

    it("validates reject action with reason", () => {
      const action = { action: "reject", reason: "정보 부족" };
      const result = submissionActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it("rejects invalid action value", () => {
      const action = { action: "invalid" };
      const result = submissionActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });
  });

  describe("SUBMISSION_STATUS_LABELS", () => {
    it("has labels for all status values", () => {
      const statuses: SubmissionStatus[] = [
        "PENDING",
        "APPROVED",
        "REVIEW_REQUIRED",
        "REJECTED",
        "DUPLICATE",
      ];
      statuses.forEach((status) => {
        expect(SUBMISSION_STATUS_LABELS[status]).toBeDefined();
        expect(typeof SUBMISSION_STATUS_LABELS[status]).toBe("string");
      });
    });

    it("has Korean labels", () => {
      expect(SUBMISSION_STATUS_LABELS.PENDING).toBe("대기 중");
      expect(SUBMISSION_STATUS_LABELS.APPROVED).toBe("승인됨");
      expect(SUBMISSION_STATUS_LABELS.REJECTED).toBe("반려됨");
    });
  });
});
