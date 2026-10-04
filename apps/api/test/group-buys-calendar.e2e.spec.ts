import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { GroupBuysController } from '../src/group-buys/group-buys.controller';
import { GroupBuysService } from '../src/group-buys/group-buys.service';
import { PrismaService } from '../src/prisma/prisma.service';

type PrismaMock = {
  groupBuy: {
    findMany: jest.Mock;
  };
};

describe('GroupBuysController calendar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  beforeAll(async () => {
    prisma = {
      groupBuy: {
        findMany: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GroupBuysController],
      providers: [GroupBuysService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.groupBuy.findMany.mockReset();
  });

  it('returns approved group buys overlapping the requested month', async () => {
    prisma.groupBuy.findMany.mockResolvedValue([
      {
        id: 'gb-1',
        productName: '전월 시작 6월 종료 공구',
        brandName: '브랜드 A',
        startDate: new Date('2026-05-30T00:00:00.000Z'),
        endDate: new Date('2026-06-02T00:00:00.000Z'),
        purchaseUrl: 'https://example.com/a',
        confidence: 0.9,
        status: 'APPROVED',
      },
      {
        id: 'gb-2',
        productName: '6월 중순 공구',
        brandName: '브랜드 B',
        startDate: new Date('2026-06-10T00:00:00.000Z'),
        endDate: new Date('2026-06-15T00:00:00.000Z'),
        purchaseUrl: 'https://example.com/b',
        confidence: 0.9,
        status: 'APPROVED',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/group-buys/calendar')
      .query({ year: 2026, month: 6 })
      .expect(200);

    expect(response.body.meta).toEqual({ total: 2, month: '2026-06' });
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((item: { date: string }) => item.date)).toEqual([
      '2026-05-30',
      '2026-06-10',
    ]);
    expect(
      response.body.items.flatMap((item: { groupBuys: Array<{ productName: string }> }) =>
        item.groupBuys.map((groupBuy) => groupBuy.productName),
      ),
    ).toEqual(['전월 시작 6월 종료 공구', '6월 중순 공구']);
    expect(prisma.groupBuy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { endDate: { gte: new Date('2026-06-01T00:00:00.000Z') } },
            { startDate: { lte: new Date('2026-06-30T23:59:59.999Z') } },
          ]),
        }),
      }),
    );
  });

  it('rejects invalid calendar query values', async () => {
    await request(app.getHttpServer())
      .get('/group-buys/calendar')
      .query({ year: 2026, month: 13 })
      .expect(400);

    expect(prisma.groupBuy.findMany).not.toHaveBeenCalled();
  });
});
