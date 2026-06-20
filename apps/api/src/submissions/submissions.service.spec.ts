import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SubmissionStatus, GroupBuyStatus } from '@prisma/client';

import { SubmissionsService } from './submissions.service';

describe('SubmissionsService', () => {
  function createPrismaMock(overrides: Record<string, jest.Mock> = {}) {
    return {
      gongguSubmission: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        ...overrides.gongguSubmission,
      },
      groupBuy: {
        create: jest.fn(),
        ...overrides.groupBuy,
      },
      $transaction: jest.fn(async (callback) => callback({
        gongguSubmission: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        groupBuy: {
          create: jest.fn(),
        },
      })),
      ...overrides,
    };
  }

  const validDto = {
    productName: '테스트 제품',
    brandName: '테스트 브랜드',
    startDate: '2026-06-20',
    endDate: '2026-06-27',
    purchaseUrl: 'https://example.com/product',
    discountInfo: '20% 할인',
    summary: '테스트 요약',
    instagramUrl: 'https://instagram.com/p/ABC123',
    imageUrls: ['https://example.com/img1.jpg'],
    reporterName: '테스터',
    reporterContact: 'test@example.com',
    isAnonymous: false,
  };

  describe('create', () => {
    it('creates an anonymous PENDING submission with content hash and empty imageUrls by default', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue(null);
      prisma.gongguSubmission.create.mockImplementation(async (args) => ({
        id: 'submission-1',
        status: SubmissionStatus.PENDING,
        ...args.data,
      }));
      const service = new SubmissionsService(prisma as never);

      const result = await service.create({
        productName: '마롱드파리 크로와상',
        startDate: '2026-06-20',
        purchaseUrl: 'https://example.com/product',
      });

      expect(prisma.gongguSubmission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productName: '마롱드파리 크로와상',
          imageUrls: [],
          isAnonymous: true,
          contentHash: expect.any(String),
        }),
      });
      expect(result.status).toBe(SubmissionStatus.PENDING);
    });

    it('creates submission with all fields provided', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue(null);
      prisma.gongguSubmission.create.mockImplementation(async (args) => ({
        id: 'submission-1',
        status: SubmissionStatus.PENDING,
        ...args.data,
      }));
      const service = new SubmissionsService(prisma as never);

      const result = await service.create(validDto);

      expect(prisma.gongguSubmission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productName: '테스트 제품',
          brandName: '테스트 브랜드',
          startDate: new Date('2026-06-20'),
          endDate: new Date('2026-06-27'),
          purchaseUrl: 'https://example.com/product',
          discountInfo: '20% 할인',
          summary: '테스트 요약',
          instagramUrl: 'https://instagram.com/p/ABC123',
          imageUrls: ['https://example.com/img1.jpg'],
          reporterName: '테스터',
          reporterContact: 'test@example.com',
          isAnonymous: false,
          contentHash: expect.any(String),
        }),
      });
      expect(result.status).toBe(SubmissionStatus.PENDING);
    });

    it('blocks duplicate submissions with 409 Conflict', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue({
        id: 'existing-submission',
        status: SubmissionStatus.APPROVED,
        groupBuyId: 'group-buy-1',
        imageUrls: [],
        groupBuy: { id: 'group-buy-1' },
      });
      const service = new SubmissionsService(prisma as never);

      await expect(service.create({
        productName: '중복 제품',
        startDate: '2026-06-20',
        purchaseUrl: 'https://example.com/product',
      })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.gongguSubmission.update).not.toHaveBeenCalled();
    });

    it('rejects reversed date ranges before persistence', async () => {
      const prisma = createPrismaMock();
      const service = new SubmissionsService(prisma as never);

      await expect(service.create({
        productName: '날짜 역전 제품',
        startDate: '2026-06-30',
        endDate: '2026-06-20',
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.gongguSubmission.findUnique).not.toHaveBeenCalled();
      expect(prisma.gongguSubmission.create).not.toHaveBeenCalled();
    });

    it('updates existing PENDING submission with merged images (current implementation behavior)', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue({
        id: 'existing-submission',
        status: SubmissionStatus.PENDING,
        groupBuyId: null,
        imageUrls: ['https://existing.com/img1.jpg'],
        groupBuy: null,
      });
      prisma.gongguSubmission.update.mockImplementation(async (args) => ({
        id: 'existing-submission',
        status: SubmissionStatus.PENDING,
        ...args.data,
        imageUrls: ['https://existing.com/img1.jpg', 'https://example.com/img2.jpg'],
      }));
      const service = new SubmissionsService(prisma as never);

      const result = await service.create({
        productName: '중복 제품',
        startDate: '2026-06-20',
        purchaseUrl: 'https://example.com/product',
        imageUrls: ['https://example.com/img2.jpg'],
      });

      expect(prisma.gongguSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-submission' },
          data: expect.objectContaining({
            imageUrls: ['https://existing.com/img1.jpg', 'https://example.com/img2.jpg'],
          }),
        })
      );
      expect(result.id).toBe('existing-submission');
      expect(result.imageUrls).toContain('https://example.com/img2.jpg');
    });

    it('throws ConflictException when existing is APPROVED with groupBuyId', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue({
        id: 'approved-submission',
        status: SubmissionStatus.APPROVED,
        groupBuyId: 'group-buy-1',
        imageUrls: [],
        groupBuy: { id: 'group-buy-1' },
      });
      const service = new SubmissionsService(prisma as never);

      await expect(service.create({
        productName: '이미 승인된 제품',
        startDate: '2026-06-20',
        purchaseUrl: 'https://example.com/product',
      })).rejects.toBeInstanceOf(ConflictException);
    });

    it('reopens existing row when existing is REJECTED to preserve contentHash uniqueness', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue({
        id: 'rejected-submission',
        status: SubmissionStatus.REJECTED,
        groupBuyId: null,
        imageUrls: [],
        groupBuy: null,
      });
      prisma.gongguSubmission.update.mockImplementation(async (args) => ({
        id: 'rejected-submission',
        ...args.data,
      }));
      const service = new SubmissionsService(prisma as never);

      const result = await service.create({
        productName: '재제보 제품',
        startDate: '2026-06-20',
        purchaseUrl: 'https://example.com/product',
      });

      expect(prisma.gongguSubmission.update).toHaveBeenCalledWith({
        where: { id: 'rejected-submission' },
        data: expect.objectContaining({
          status: SubmissionStatus.PENDING,
          productName: '재제보 제품',
          contentHash: expect.any(String),
          reviewedAt: null,
          reviewedBy: null,
          adminMemo: null,
          groupBuyId: null,
        }),
      });
      expect(prisma.gongguSubmission.create).not.toHaveBeenCalled();
      expect(result.id).toBe('rejected-submission');
      expect(result.status).toBe(SubmissionStatus.PENDING);
    });

    it('reopens existing row when existing is CANCELLED to preserve contentHash uniqueness', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue({
        id: 'cancelled-submission',
        status: SubmissionStatus.CANCELLED,
        groupBuyId: null,
        imageUrls: [],
        groupBuy: null,
      });
      prisma.gongguSubmission.update.mockImplementation(async (args) => ({
        id: 'cancelled-submission',
        ...args.data,
      }));
      const service = new SubmissionsService(prisma as never);

      const result = await service.create({
        productName: '취소 후 재제보',
        startDate: '2026-06-20',
        purchaseUrl: 'https://example.com/product',
      });

      expect(prisma.gongguSubmission.update).toHaveBeenCalledWith({
        where: { id: 'cancelled-submission' },
        data: expect.objectContaining({
          status: SubmissionStatus.PENDING,
          productName: '취소 후 재제보',
          contentHash: expect.any(String),
          reviewedAt: null,
          reviewedBy: null,
          adminMemo: null,
          groupBuyId: null,
        }),
      });
      expect(prisma.gongguSubmission.create).not.toHaveBeenCalled();
      expect(result.id).toBe('cancelled-submission');
      expect(result.status).toBe(SubmissionStatus.PENDING);
    });

    it('throws ConflictException when existing is DUPLICATE', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique
        .mockResolvedValueOnce({
          id: 'duplicate-submission',
          status: SubmissionStatus.DUPLICATE,
          groupBuyId: null,
          imageUrls: [],
          groupBuy: null,
        })
        .mockResolvedValueOnce({
          id: 'original-submission',
          status: SubmissionStatus.PENDING,
        });
      const service = new SubmissionsService(prisma as never);

      await expect(service.create({
        productName: '중복 제품',
        startDate: '2026-06-20',
        purchaseUrl: 'https://example.com/product',
      })).rejects.toBeInstanceOf(ConflictException);
    });

    it('handles invalid date format gracefully', async () => {
      const prisma = createPrismaMock();
      const service = new SubmissionsService(prisma as never);

      await expect(service.create({
        productName: '잘못된 날짜',
        startDate: 'invalid-date',
        endDate: 'also-invalid',
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('handles undefined startDate and endDate', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue(null);
      prisma.gongguSubmission.create.mockImplementation(async (args) => ({
        id: 'submission-1',
        status: SubmissionStatus.PENDING,
        ...args.data,
      }));
      const service = new SubmissionsService(prisma as never);

      const result = await service.create({
        productName: '날짜 없음 제품',
      });

      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });

    describe('P2002 race condition handling', () => {
      function makeP2002Error() {
        return new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the constraint: `gongguSubmission_content_hash_key`',
          { code: 'P2002', clientVersion: '6.19.0' },
        );
      }

      it('returns existing PENDING submission on P2002 (concurrent create)', async () => {
        const prisma = createPrismaMock();
        const winningRow = {
          id: 'race-winner',
          status: SubmissionStatus.PENDING,
          groupBuyId: null,
          imageUrls: ['https://existing.com/img1.jpg'],
          groupBuy: null,
        };
        prisma.gongguSubmission.findUnique
          .mockResolvedValueOnce(null) // initial check
          .mockResolvedValueOnce(winningRow); // after P2002
        prisma.gongguSubmission.create.mockRejectedValueOnce(makeP2002Error());
        prisma.gongguSubmission.update.mockResolvedValue({ ...winningRow, imageUrls: ['https://existing.com/img1.jpg', 'https://new.com/img.jpg'] });

        const service = new SubmissionsService(prisma as never);
        const result = await service.create({
          productName: '동시 제보',
          startDate: '2026-06-20',
          purchaseUrl: 'https://example.com/product',
          imageUrls: ['https://new.com/img.jpg'],
        });

        expect(result.id).toBe('race-winner');
        expect(prisma.gongguSubmission.update).toHaveBeenCalled();
      });

      it('throws 409 Conflict on P2002 when existing is APPROVED', async () => {
        const prisma = createPrismaMock();
        prisma.gongguSubmission.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'approved-row',
            status: SubmissionStatus.APPROVED,
            groupBuyId: 'gb-1',
            imageUrls: [],
            groupBuy: { id: 'gb-1' },
          });
        prisma.gongguSubmission.create.mockRejectedValueOnce(makeP2002Error());

        const service = new SubmissionsService(prisma as never);
        await expect(
          service.create({
            productName: '동시 승인된 제보',
            startDate: '2026-06-20',
            purchaseUrl: 'https://example.com/product',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('throws 409 Conflict on P2002 when existing is DUPLICATE', async () => {
        const prisma = createPrismaMock();
        prisma.gongguSubmission.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'dup-row',
            status: SubmissionStatus.DUPLICATE,
            groupBuyId: null,
            imageUrls: [],
            groupBuy: null,
          });
        prisma.gongguSubmission.create.mockRejectedValueOnce(makeP2002Error());

        const service = new SubmissionsService(prisma as never);
        await expect(
          service.create({
            productName: '동시 중복 제보',
            startDate: '2026-06-20',
            purchaseUrl: 'https://example.com/product',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('re-throws non-P2002 errors from create()', async () => {
        const prisma = createPrismaMock();
        prisma.gongguSubmission.findUnique.mockResolvedValue(null);
        prisma.gongguSubmission.create.mockRejectedValue(new Error('some other db error'));

        const service = new SubmissionsService(prisma as never);
        await expect(
          service.create({
            productName: 'DB 에러 테스트',
            startDate: '2026-06-20',
            purchaseUrl: 'https://example.com/product',
          }),
        ).rejects.toThrow('some other db error');
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated submissions with filters', async () => {
      const prisma = createPrismaMock();
      const mockSubmissions = [
        { id: '1', productName: '제품 1', status: SubmissionStatus.PENDING, groupBuy: null },
        { id: '2', productName: '제품 2', status: SubmissionStatus.APPROVED, groupBuy: { id: 'gb-1' } },
      ];
      prisma.gongguSubmission.findMany.mockResolvedValue(mockSubmissions);
      prisma.gongguSubmission.count.mockResolvedValue(2);
      const service = new SubmissionsService(prisma as never);

      const result = await service.findAll({ status: SubmissionStatus.PENDING, limit: 10, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prisma.gongguSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: SubmissionStatus.PENDING }),
          take: 10,
          skip: 0,
        })
      );
    });

    it('applies search query filter', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findMany.mockResolvedValue([]);
      prisma.gongguSubmission.count.mockResolvedValue(0);
      const service = new SubmissionsService(prisma as never);

      await service.findAll({ q: '크로와상' });

      expect(prisma.gongguSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ productName: expect.any(Object) }),
              expect.objectContaining({ brandName: expect.any(Object) }),
              expect.objectContaining({ summary: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('applies date range filter', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findMany.mockResolvedValue([]);
      prisma.gongguSubmission.count.mockResolvedValue(0);
      const service = new SubmissionsService(prisma as never);

      await service.findAll({ fromDate: '2026-06-01', toDate: '2026-06-30' });

      expect(prisma.gongguSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date('2026-06-01'),
              lte: new Date('2026-06-30'),
            }),
          }),
        })
      );
    });

    it('applies sorting', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findMany.mockResolvedValue([]);
      prisma.gongguSubmission.count.mockResolvedValue(0);
      const service = new SubmissionsService(prisma as never);

      await service.findAll({ sortBy: 'productName', sortOrder: 'asc' });

      expect(prisma.gongguSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { productName: 'asc' },
        })
      );
    });
  });

  describe('findById', () => {
    it('returns submission with groupBuy included', async () => {
      const prisma = createPrismaMock();
      const mockSubmission = {
        id: 'sub-1',
        productName: '테스트',
        status: SubmissionStatus.PENDING,
        groupBuy: { id: 'gb-1', productName: '승인된 제품' },
      };
      prisma.gongguSubmission.findUnique.mockResolvedValue(mockSubmission);
      const service = new SubmissionsService(prisma as never);

      const result = await service.findById('sub-1');

      expect(result).toEqual(mockSubmission);
      expect(prisma.gongguSubmission.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        include: { groupBuy: true },
      });
    });

    it('throws NotFoundException when submission not found', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue(null);
      const service = new SubmissionsService(prisma as never);

      await expect(service.findById('non-existent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('approve', () => {
    it('approves pending submission and creates GroupBuy', async () => {
      const prisma = createPrismaMock();
      const mockSubmission = {
        id: 'sub-1',
        productName: '테스트 제품',
        brandName: '브랜드',
        startDate: new Date('2026-06-20'),
        endDate: new Date('2026-06-27'),
        purchaseUrl: 'https://example.com',
        discountInfo: '20%',
        summary: '요약',
        status: SubmissionStatus.PENDING,
      };
      const mockGroupBuy = {
        id: 'gb-1',
        productName: '테스트 제품',
        brandName: '브랜드',
        startDate: new Date('2026-06-20'),
        endDate: new Date('2026-06-27'),
        purchaseUrl: 'https://example.com',
        discountInfo: '20%',
        summary: '요약',
        sourceType: 'SUBMISSION',
        submissionId: 'sub-1',
        confidence: 0.9,
        status: GroupBuyStatus.APPROVED,
        isAllDay: true,
      };
      const mockUpdatedSubmission = { ...mockSubmission, status: SubmissionStatus.APPROVED, groupBuyId: 'gb-1', groupBuy: mockGroupBuy };
      const tx = {
        gongguSubmission: {
          findUnique: jest.fn().mockResolvedValue(mockSubmission),
          update: jest.fn().mockResolvedValue(mockUpdatedSubmission),
        },
        groupBuy: { create: jest.fn().mockResolvedValue(mockGroupBuy) },
      };
      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      const service = new SubmissionsService(prisma as never);
      const result = await service.approve('sub-1', { isAllDay: true, adminMemo: '승인 메모' }, 'admin-1');

      expect(tx.groupBuy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceType: 'SUBMISSION',
          submissionId: 'sub-1',
          productName: '테스트 제품',
          brandName: '브랜드',
          startDate: new Date('2026-06-20'),
          endDate: new Date('2026-06-27'),
          purchaseUrl: 'https://example.com',
          discountInfo: '20%',
          summary: '요약',
          confidence: 0.9,
          status: GroupBuyStatus.APPROVED,
          isAllDay: true,
        }),
      });
      expect(tx.gongguSubmission.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: SubmissionStatus.APPROVED,
          groupBuyId: 'gb-1',
          reviewedBy: 'admin-1',
          adminMemo: '승인 메모',
          reviewedAt: expect.any(Date),
        }),
        include: { groupBuy: true },
      });
      expect(result.groupBuy).toBeDefined();
      expect(result.groupBuy.sourceType).toBe('SUBMISSION');
      expect(result.groupBuy.isAllDay).toBe(true);
      expect(result.submission.status).toBe(SubmissionStatus.APPROVED);
      expect(result.submission.groupBuyId).toBe('gb-1');
    });

    it('throws NotFoundException when submission not found', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (callback) => callback({
        gongguSubmission: { findUnique: jest.fn().mockResolvedValue(null) },
      }));
      const service = new SubmissionsService(prisma as never);

      await expect(service.approve('non-existent', {}, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when submission not PENDING', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.APPROVED,
      });
      prisma.$transaction.mockImplementation(async (callback) => callback({
        gongguSubmission: { findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', status: SubmissionStatus.APPROVED }) },
      }));
      const service = new SubmissionsService(prisma as never);

      await expect(service.approve('sub-1', {}, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('reject', () => {
    it('rejects pending submission with reason', async () => {
      const prisma = createPrismaMock();
      const mockSubmission = {
        id: 'sub-1',
        productName: '테스트 제품',
        status: SubmissionStatus.PENDING,
      };
      const mockRejected = { ...mockSubmission, status: SubmissionStatus.REJECTED, adminMemo: '정보 부족', reviewedAt: new Date(), reviewedBy: 'admin-1' };

      prisma.gongguSubmission.findUnique.mockResolvedValue(mockSubmission);
      prisma.gongguSubmission.update.mockResolvedValue(mockRejected);
      const service = new SubmissionsService(prisma as never);

      const result = await service.reject('sub-1', { reason: '정보 부족', guideMessage: '링크 추가해주세요' }, 'admin-1');

      expect(result.status).toBe(SubmissionStatus.REJECTED);
      expect(result.adminMemo).toBe('정보 부족');
      expect(result.reviewedBy).toBe('admin-1');
    });

    it('throws NotFoundException when submission not found', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue(null);
      const service = new SubmissionsService(prisma as never);

      await expect(service.reject('non-existent', { reason: '테스트' }, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when submission not PENDING', async () => {
      const prisma = createPrismaMock();
      prisma.gongguSubmission.findUnique.mockResolvedValue({ id: 'sub-1', status: SubmissionStatus.REJECTED });
      const service = new SubmissionsService(prisma as never);

      await expect(service.reject('sub-1', { reason: '테스트' }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});