import { z } from "zod";

export const groupBuyStatusSchema = z.enum([
  "APPROVED",
  "REVIEW_REQUIRED",
  "REJECTED",
  "EXPIRED",
]);

export type GroupBuyStatus = z.infer<typeof groupBuyStatusSchema>;

export const groupBuyCategorySchema = z.enum([
  "beauty",
  "fashion",
  "food",
  "lifestyle",
  "baby",
  "digital",
]);

export type GroupBuyCategory = z.infer<typeof groupBuyCategorySchema>;

export const groupBuySchema = z.object({
  id: z.string().uuid(),
  rawPostId: z.string().uuid().nullable(),
  productName: z.string().max(200).nullable(),
  brandName: z.string().max(100).nullable(),
  category: groupBuyCategorySchema.nullable().default(null),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  purchaseUrl: z.string().url().nullable(),
  discountInfo: z.string().max(200).nullable(),
  summary: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  status: groupBuyStatusSchema,
  rejectionReason: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  sourceType: z.string(),
  submissionId: z.string().uuid().nullable(),
  isAllDay: z.boolean(),
  isMonthlyFeatured: z.boolean().default(false),
  monthlyFeaturedRank: z.number().int().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GroupBuy = z.infer<typeof groupBuySchema>;

export const groupBuysResponseSchema = z.array(groupBuySchema);

export const groupBuyAdminSchema = groupBuySchema.extend({
  rawPost: z.object({
    id: z.string().uuid(),
    instagramPostId: z.string(),
    caption: z.string(),
    postUrl: z.string().url(),
    imageUrl: z.string().url().nullable(),
    takenAt: z.string().datetime(),
    influencer: z.object({
      id: z.string().uuid(),
      instagramUsername: z.string(),
      displayName: z.string().nullable(),
    }),
  }),
});

export type GroupBuyAdmin = z.infer<typeof groupBuyAdminSchema>;

/** Calendar API response: grouped by date */
export const calendarGroupBuyItemSchema = z.object({
  date: z.string(), // "YYYY-MM-DD"
  groupBuys: z.array(groupBuySchema),
});

export type CalendarGroupBuyItem = z.infer<typeof calendarGroupBuyItemSchema>;

export const calendarGroupBuyResponseSchema = z.object({
  items: z.array(calendarGroupBuyItemSchema),
  meta: z.object({
    total: z.number(),
    month: z.string(), // "YYYY-MM"
  }),
});

export type CalendarGroupBuyResponse = z.infer<typeof calendarGroupBuyResponseSchema>;
