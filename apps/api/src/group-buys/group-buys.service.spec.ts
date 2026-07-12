import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GroupBuyStatus } from '@prisma/client';

import { GroupBuysService } from './group-buys.service';

type PrismaMock = {
  groupBuy: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('GroupBuysService', () => {
  function createPrismaMock(): PrismaMock {
    return {
      groupBuy: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
  }

  let prisma: PrismaMock;
  let service: GroupBuysService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new GroupBuysService(prisma as never);
  });

  describe('list', () => {
    it('returns filtered group buys with default status APPROVED', async () => {
      const mockGroupBuys = [
        { id: 'gb-1', productName: '제품 1', status: GroupBuyStatus.APPROVED },
        { id: 'gb-2', productName: '제품 2', status: GroupBuyStatus.APPROVED },
      ];
      prisma.groupBuy.findMany.mockResolvedValue(mockGroupBuys);

      const result = await service.list({ limit: 50 } as any);

      expect(prisma.groupBuy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: GroupBuyStatus.APPROVED },
          include: { rawPost: { include: { influencer: true } } },
          orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
          take: 50,
        })
      );
      expect(result).toEqual(mockGroupBuys);
    });

    it('applies custom status filter', async () => {
      prisma.groupBuy.findMany.mockResolvedValue([]);

      await service.list({ status: GroupBuyStatus.REVIEW_REQUIRED, limit: 50 } as any);

      expect(prisma.groupBuy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: GroupBuyStatus.REVIEW_REQUIRED },
        })
      );
    });

    it('applies search query filter', async () => {
      prisma.groupBuy.findMany.mockResolvedValue([]);

      await service.list({ q: '크로와상', limit: 50 } as any);

      expect(prisma.groupBuy.findMany).toHaveBeenCalledWith(
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

    it('applies limit', async () => {
      prisma.groupBuy.findMany.mockResolvedValue([]);

      await service.list({ limit: 5 });

      expect(prisma.groupBuy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });

    it('serializes Prisma home banner dates as date-only strings', async () => {
      prisma.groupBuy.findMany.mockResolvedValue([{
        id: 'gb-1',
        homeBannerStartDate: new Date('2026-07-12T00:00:00.000Z'),
        homeBannerEndDate: new Date('2026-07-19T00:00:00.000Z'),
      }]);

      const result = await service.list({ limit: 50 });

      expect(result).toEqual([expect.objectContaining({
        homeBannerStartDate: '2026-07-12',
        homeBannerEndDate: '2026-07-19',
      })]);
    });
  });

  describe('getCalendarView', () => {
    it('finds approved group buys overlapping the requested month', async () => {
      const mockGroupBuys = [
        {
          id: 'gb-1',
          productName: '6월 공구',
          startDate: new Date('2026-06-10T00:00:00.000Z'),
          endDate: new Date('2026-06-15T00:00:00.000Z'),
          status: GroupBuyStatus.APPROVED,
        },
      ];
      prisma.groupBuy.findMany.mockResolvedValue(mockGroupBuys);

      const result = await service.getCalendarView({ year: 2026, month: 6 });

      expect(prisma.groupBuy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: GroupBuyStatus.APPROVED,
            AND: [
              { endDate: { gte: new Date('2026-06-01T00:00:00.000Z') } },
              { startDate: { lte: new Date('2026-06-30T23:59:59.999Z') } },
            ],
          },
          include: { rawPost: { include: { influencer: true } } },
          orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }, { createdAt: 'desc' }],
        })
      );
      expect(result).toEqual({
        items: [
          {
            date: '2026-06-10',
            groupBuys: mockGroupBuys,
          },
        ],
        meta: { total: 1, month: '2026-06' },
      });
    });

    it('serializes nullable Prisma home banner dates in calendar items', async () => {
      prisma.groupBuy.findMany.mockResolvedValue([{
        id: 'gb-1',
        startDate: new Date('2026-06-10T00:00:00.000Z'),
        endDate: new Date('2026-06-15T00:00:00.000Z'),
        homeBannerStartDate: new Date('2026-06-01T00:00:00.000Z'),
        homeBannerEndDate: null,
      }]);

      const result = await service.getCalendarView({ year: 2026, month: 6 });

      expect(result.items[0]?.groupBuys[0]).toEqual(expect.objectContaining({
        homeBannerStartDate: '2026-06-01',
        homeBannerEndDate: null,
      }));
    });

    it('groups overlapping group buys by UTC start date', async () => {
      const first = {
        id: 'gb-1',
        productName: '첫 번째',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-06-03T00:00:00.000Z'),
      };
      const second = {
        id: 'gb-2',
        productName: '두 번째',
        startDate: new Date('2026-06-01T12:00:00.000Z'),
        endDate: new Date('2026-06-05T00:00:00.000Z'),
      };
      prisma.groupBuy.findMany.mockResolvedValue([first, second]);

      const result = await service.getCalendarView({ year: 2026, month: 6 });

      expect(result.items).toEqual([
        { date: '2026-06-01', groupBuys: [first, second] },
      ]);
      expect(result.meta).toEqual({ total: 2, month: '2026-06' });
    });
  });

  describe('get', () => {
    it('returns group buy with rawPost and influencer', async () => {
      const mockGroupBuy = {
        id: 'gb-1',
        productName: '테스트 제품',
        status: GroupBuyStatus.APPROVED,
        rawPost: { id: 'rp-1', influencer: { instagramUsername: 'test' } },
      };
      prisma.groupBuy.findUnique.mockResolvedValue(mockGroupBuy);

      const result = await service.get('gb-1');

      expect(prisma.groupBuy.findUnique).toHaveBeenCalledWith({
        where: { id: 'gb-1' },
        include: { rawPost: { include: { influencer: true } } },
      });
      expect(result).toEqual(mockGroupBuy);
    });

    it('throws NotFoundException when group buy not found', async () => {
      prisma.groupBuy.findUnique.mockResolvedValue(null);

      await expect(service.get('non-existent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('approve', () => {
    it('approves group buy with startDate', async () => {
      const mockGroupBuy = { id: 'gb-1', startDate: new Date('2026-06-20'), endDate: null };
      const approvedGroupBuy = { ...mockGroupBuy, status: GroupBuyStatus.APPROVED, rejectionReason: null, reviewedAt: new Date() };
      prisma.groupBuy.findUnique.mockResolvedValue(mockGroupBuy);
      prisma.groupBuy.update.mockResolvedValue(approvedGroupBuy);

      const result = await service.approve('gb-1');

      expect(prisma.groupBuy.update).toHaveBeenCalledWith({
        where: { id: 'gb-1' },
        data: {
          status: GroupBuyStatus.APPROVED,
          rejectionReason: null,
          reviewedAt: expect.any(Date),
        },
        include: { rawPost: { include: { influencer: true } } },
      });
      expect(result.status).toBe(GroupBuyStatus.APPROVED);
    });

    it('approves group buy with endDate only', async () => {
      const mockGroupBuy = { id: 'gb-1', startDate: null, endDate: new Date('2026-06-27') };
      const approvedGroupBuy = { ...mockGroupBuy, status: GroupBuyStatus.APPROVED, rejectionReason: null, reviewedAt: new Date() };
      prisma.groupBuy.findUnique.mockResolvedValue(mockGroupBuy);
      prisma.groupBuy.update.mockResolvedValue(approvedGroupBuy);

      const result = await service.approve('gb-1');

      expect(result.status).toBe(GroupBuyStatus.APPROVED);
    });

    it('blocks approval when both startDate and endDate are missing', async () => {
      prisma.groupBuy.findUnique.mockResolvedValue({ id: 'gb-no-date', startDate: null, endDate: null });

      await expect(service.approve('gb-no-date')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.groupBuy.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when group buy not found', async () => {
      prisma.groupBuy.findUnique.mockResolvedValue(null);

      await expect(service.approve('non-existent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reject', () => {
    it('rejects group buy with reason', async () => {
      const rejected = { id: 'gb-1', status: GroupBuyStatus.REJECTED, rejectionReason: '중복', reviewedAt: new Date() };
      prisma.groupBuy.update.mockResolvedValue(rejected);

      const result = await service.reject('gb-1', '중복');

      expect(prisma.groupBuy.update).toHaveBeenCalledWith({
        where: { id: 'gb-1' },
        data: {
          status: GroupBuyStatus.REJECTED,
          rejectionReason: '중복',
          reviewedAt: expect.any(Date),
        },
        include: { rawPost: { include: { influencer: true } } },
      });
      expect(result.rejectionReason).toBe('중복');
    });

    it('requires a rejection reason', async () => {
      await expect(service.reject('gb-1', '')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.groupBuy.update).not.toHaveBeenCalled();
    });

    it('requires a non-whitespace rejection reason', async () => {
      await expect(service.reject('gb-1', '   ')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.groupBuy.update).not.toHaveBeenCalled();
    });
  });
});
