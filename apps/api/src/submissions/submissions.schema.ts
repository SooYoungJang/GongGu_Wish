import { z } from 'zod';

const imageUrlsSchema = z.array(z.string().url()).max(5).default([]);
const categorySchema = z.enum(['beauty', 'fashion', 'food', 'lifestyle', 'baby', 'digital']);

export const createSubmissionSchema = z.object({
  productName: z.string().min(2).max(100),
  brandName: z.string().max(50).optional(),
  category: categorySchema.optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  purchaseUrl: z.string().url().optional(),
  discountInfo: z.string().max(200).optional(),
  summary: z.string().max(500).optional(),
  instagramUrl: z.string().url().optional(),
  imageUrls: imageUrlsSchema.optional(),
  reporterName: z.string().max(30).optional(),
  reporterContact: z.string().max(100).optional(),
  isAnonymous: z.boolean().default(true),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const listSubmissionsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'CANCELLED']).optional(),
  q: z.string().optional(),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
  sortBy: z.enum(['createdAt', 'productName', 'status', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  cursor: z.string().uuid().optional(),
});

export type ListSubmissionsQuery = z.infer<typeof listSubmissionsSchema>;

export const approveSubmissionSchema = z.object({
  isAllDay: z.boolean().default(false),
  adminMemo: z.string().optional(),
});

export type ApproveSubmissionInput = z.infer<typeof approveSubmissionSchema>;

export const rejectSubmissionSchema = z.object({
  reason: z.string().min(1),
  guideMessage: z.string().optional(),
});

export type RejectSubmissionInput = z.infer<typeof rejectSubmissionSchema>;

export function validateEndDateAfterStartDate(input: CreateSubmissionInput): CreateSubmissionInput {
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('날짜 형식이 올바르지 않습니다.');
    }
    if (start > end) {
      throw new Error('시작일은 종료일보다 늦을 수 없습니다.');
    }
  }
  return input;
}
