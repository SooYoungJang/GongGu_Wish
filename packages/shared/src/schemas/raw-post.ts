import { z } from "zod";

export const parsingStatusSchema = z.enum([
  "NEW",
  "PENDING",
  "EXPORTED",
  "PARSED",
  "NOT_GROUP_BUY",
  "NOT_KOREA",
  "FAILED",
]);

export type ParsingStatus = z.infer<typeof parsingStatusSchema>;

export const rawPostSchema = z.object({
  id: z.string().uuid(),
  instagramPostId: z.string(),
  influencerId: z.string().uuid(),
  caption: z.string(),
  postUrl: z.string().url(),
  imageUrl: z.string().url().nullable(),
  takenAt: z.string().datetime(),
  contentHash: z.string(),
  isCandidate: z.boolean(),
  isKoreaCandidate: z.boolean().optional(),
  collectionSource: z
    .enum(["LEGACY_INSTAGRAPI", "PLAYWRIGHT_PUBLIC"])
    .optional(),
  parsingStatus: parsingStatusSchema,
  exportedAt: z.string().datetime().nullable(),
  parsedAt: z.string().datetime().nullable(),
  parseError: z.string().nullable(),
  collectedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RawPost = z.infer<typeof rawPostSchema>;

export const rawPostsResponseSchema = z.array(rawPostSchema);

export const exportRawPostSchema = z.object({
  rawPostId: z.string().uuid(),
  instagramPostId: z.string(),
  influencerUsername: z.string(),
  caption: z.string(),
  postUrl: z.string().url(),
  imageUrl: z.string().url().nullable(),
  takenAt: z.string().datetime(),
});

export type ExportRawPost = z.infer<typeof exportRawPostSchema>;

export const importParsedGroupBuySchema = z.object({
  rawPostId: z.string().uuid(),
  isGroupBuy: z.boolean(),
  productName: z.string().max(200).optional(),
  brandName: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  purchaseUrl: z.string().url().optional(),
  discountInfo: z.string().max(200).optional(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1),
  parseError: z.string().optional(),
});

export type ImportParsedGroupBuy = z.infer<typeof importParsedGroupBuySchema>;
