import { z } from "zod";

export const groupBuyStatusSchema = z.enum([
  "APPROVED",
  "REVIEW_REQUIRED",
  "REJECTED",
  "EXPIRED",
]);

export type GroupBuyStatus = z.infer<typeof groupBuyStatusSchema>;

export const groupBuyCategorySchema = z.enum([
  "food",
  "living",
  "beauty",
  "fashion",
  "home",
  "kitchen",
  "electronics",
  "pet",
  "auto",
  "hobby",
  "baby",
  "sports",
  "stationery",
  "books",
  "media",
  "travel",
  "lifestyle",
  "digital",
]);

export type GroupBuyCategory = z.infer<typeof groupBuyCategorySchema>;

const publicDateSchema = z.string().min(1);
const publicMediaTypeSchema = z.enum(["IMAGE", "VIDEO"]);

export const publicMediaAssetSchema = z.object({
  url: z.string().min(1),
  mediaType: publicMediaTypeSchema,
  thumbnailUrl: z.string().nullable().optional(),
});

export type PublicMediaAsset = z.infer<typeof publicMediaAssetSchema>;

/**
 * The read-only contract shared by PostgREST, the mobile app and previews.
 * It intentionally excludes review/admin-only fields and exposes the
 * presentation-ready raw-post subset consumed by public cards.
 */
export const publicGroupBuySchema = z.object({
  id: z.string().min(1),
  productName: z.string().max(200).nullable(),
  brandName: z.string().max(100).nullable(),
  category: groupBuyCategorySchema.nullable().optional().default(null),
  startDate: publicDateSchema.nullable(),
  endDate: publicDateSchema.nullable(),
  purchaseUrl: z.string().url().nullable(),
  discountInfo: z.string().max(200).nullable(),
  priceKrw: z.number().int().nonnegative().max(2_147_483_647).nullable().optional().default(null),
  summary: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  thumbnailUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  mediaUrls: z.array(z.string().min(1)).default([]),
  mediaItems: z.array(publicMediaAssetSchema).default([]),
  mediaType: publicMediaTypeSchema.nullable(),
  isMonthlyFeatured: z.boolean().optional().default(false),
  monthlyFeaturedRank: z.number().int().nullable().optional().default(null),
  isHomeBanner: z.boolean().optional().default(false),
  homeBannerStartDate: publicDateSchema.nullable().optional().default(null),
  homeBannerEndDate: publicDateSchema.nullable().optional().default(null),
  createdAt: publicDateSchema.optional(),
  rawPost: z.object({
    postUrl: z.string(),
    influencer: z.object({
      instagramUsername: z.string(),
    }),
  }),
});

export type PublicGroupBuy = z.infer<typeof publicGroupBuySchema>;

export const publicGroupBuysResponseSchema = z.array(publicGroupBuySchema);

export const publicGroupBuySummarySchema = publicGroupBuySchema.pick({
  id: true,
  productName: true,
  brandName: true,
  category: true,
  startDate: true,
  endDate: true,
  discountInfo: true,
  priceKrw: true,
  thumbnailUrl: true,
  mediaType: true,
});

export type PublicGroupBuySummary = z.infer<typeof publicGroupBuySummarySchema>;

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
  priceKrw: z.number().int().nonnegative().max(2_147_483_647).nullable().default(null),
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
  isHomeBanner: z.boolean().default(false),
  homeBannerStartDate: z.string().date().nullable().default(null),
  homeBannerEndDate: z.string().date().nullable().default(null),
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
