import { z } from "zod";

export const submissionStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REVIEW_REQUIRED",
  "REJECTED",
  "DUPLICATE",
]);

export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const submissionCategorySchema = z.enum([
  "beauty",
  "fashion",
  "food",
  "lifestyle",
  "baby",
  "digital",
]);

export const submissionSchema = z.object({
  id: z.string().uuid(),
  // 제보 내용
  productName: z.string().max(200),
  brandName: z.string().max(100).nullable(),
  category: submissionCategorySchema.nullable().default(null),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  purchaseUrl: z.string().url().nullable(),
  discountInfo: z.string().max(200).nullable(),
  summary: z.string().nullable(),
  instagramUrl: z.string().url().nullable(),
  imageUrls: z.array(z.string().url()),

  // 제보자 정보
  reporterName: z.string().nullable(),
  reporterContact: z.string().nullable(),
  isAnonymous: z.boolean(),

  // 중복 검출용
  contentHash: z.string(),

  // 상태 관리
  status: submissionStatusSchema,
  adminMemo: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewedBy: z.string().nullable(),

  // 승인 시 생성된 GroupBuy 참조
  groupBuyId: z.string().uuid().nullable(),
  groupBuy: z
    .object({
      id: z.string().uuid(),
      productName: z.string().nullable(),
      brandName: z.string().nullable(),
      category: submissionCategorySchema.nullable().default(null),
      startDate: z.string().datetime().nullable(),
      endDate: z.string().datetime().nullable(),
      purchaseUrl: z.string().url().nullable(),
      discountInfo: z.string().nullable(),
      summary: z.string().nullable(),
      status: z.string(),
      confidence: z.number(),
      rejectionReason: z.string().nullable(),
      reviewedAt: z.string().datetime().nullable(),
      sourceType: z.string(),
      submissionId: z.string().uuid(),
      isAllDay: z.boolean(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
    .nullable(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Submission = z.infer<typeof submissionSchema>;

export const submissionsResponseSchema = z.object({
  items: z.array(submissionSchema),
  total: z.number(),
});

export const submissionFormSchema = z
  .object({
    productName: z.string().min(1, "제품명은 필수입니다").max(200),
    brandName: z.string().max(100).optional(),
    category: submissionCategorySchema.optional(),
    startDate: z.string().datetime().optional().or(z.literal("")),
    endDate: z.string().datetime().optional().or(z.literal("")),
    purchaseUrl: z.string().url("올바른 구매 URL을 입력해주세요").optional().or(z.literal("")),
    discountInfo: z.string().max(200).optional(),
    summary: z.string().max(500).optional(),
    instagramUrl: z.string().url("올바른 인스타그램 URL을 입력해주세요").optional().or(z.literal("")),
    imageUrls: z.array(z.string().url()).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: "시작일은 종료일보다 이전이어야 합니다",
      path: ["startDate"],
    }
  );

export type SubmissionForm = z.infer<typeof submissionFormSchema>;

export const submissionReviewFormSchema = z.object({
  productName: z.string().max(200).optional(),
  brandName: z.string().max(100).optional(),
  category: submissionCategorySchema.optional(),
  startDate: z.string().datetime().optional().or(z.literal("")),
  endDate: z.string().datetime().optional().or(z.literal("")),
  purchaseUrl: z.string().url().optional().or(z.literal("")),
  discountInfo: z.string().max(200).optional(),
  summary: z.string().optional(),
});

export type SubmissionReviewForm = z.infer<typeof submissionReviewFormSchema>;

export const submissionActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export type SubmissionAction = z.infer<typeof submissionActionSchema>;

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  PENDING: "대기 중",
  APPROVED: "승인됨",
  REVIEW_REQUIRED: "검수 필요",
  REJECTED: "반려됨",
  DUPLICATE: "중복",
};
