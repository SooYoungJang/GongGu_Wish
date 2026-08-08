import { z } from "zod";

export const influencerSchema = z.object({
  id: z.string().uuid(),
  instagramUsername: z.string().min(1).max(100),
  displayName: z.string().max(100).nullable(),
  profileImageUrl: z.string().url().nullable(),
  isActive: z.boolean(),
  playwrightCollectionEnabled: z.boolean().optional(),
  playwrightLastAttemptAt: z.string().datetime().nullable().optional(),
  playwrightLastSuccessAt: z.string().datetime().nullable().optional(),
  playwrightLastError: z.string().nullable().optional(),
  playwrightFailureCount: z.number().int().nonnegative().optional(),
  playwrightNextRunAt: z.string().datetime().nullable().optional(),
  playwrightRawPostCount: z.number().int().nonnegative().optional(),
  playwrightCandidateCount: z.number().int().nonnegative().optional(),
  playwrightKoreaCandidateCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Influencer = z.infer<typeof influencerSchema>;

export const influencerFormSchema = z.object({
  instagramUsername: z.string().min(1, "인스타그램 계정은 필수입니다").max(100),
  displayName: z.string().min(1, "표시명은 필수입니다").max(100),
  profileImageUrl: z.string().url().nullable().optional(),
});

export type InfluencerForm = z.infer<typeof influencerFormSchema>;

export const influencersResponseSchema = z.array(influencerSchema);
