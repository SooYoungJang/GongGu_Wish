import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import {
  SubmissionsController,
  AdminSubmissionsController,
} from '../src/submissions/submissions.controller';
import { SubmissionsService } from '../src/submissions/submissions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma, SubmissionStatus } from '@prisma/client';

type PrismaMock = {
  gongguSubmission: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    deleteMany: jest.Mock;
  };
  groupBuy: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

function createPrismaMock(): PrismaMock {
  return {
    gongguSubmission: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    groupBuy: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => cb({
      gongguSubmission: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      groupBuy: {
        create: jest.fn().mockResolvedValue({}),
      },
    })),
  };
}

describe('SubmissionsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionsController, AdminSubmissionsController],
      providers: [SubmissionsService, { provide: PrismaService, useValue: prisma }],
    })
      .overrideGuard('JwtAuthGuard')
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── helpers ───
  const validSubmission = {
    productName: '테스트 크로와상',
    brandName: '테스트 베이커리',
    startDate: '2026-07-01',
    endDate: '2026-07-07',
    purchaseUrl: 'https://smartstore.naver.com/test-product',
    discountInfo: '20% 할인',
    summary: '버터 풍미 가득한 크로와상',
    instagramUrl: 'https://www.instagram.com/p/TEST123/',
    imageUrls: ['https://example.com/img1.jpg'],
    reporterName: '제보자',
    reporterContact: 'test@example.com',
    isAnonymous: false,
  };

  /** Stub create → returns the data with an id + status */
  function stubCreateSuccess() {
    prisma.gongguSubmission.findUnique.mockResolvedValue(null);
    prisma.gongguSubmission.create.mockImplementation(async (args) => ({
      id: 'created-id',
      createdAt: new Date().toISOString(),
      ...args.data,
      status: SubmissionStatus.PENDING,
    }));
  }

  // ─────────────────────────────────────────────────────────
  //  POST /submissions
  // ─────────────────────────────────────────────────────────
  describe('POST /submissions', () => {
    it('should create a submission with all fields', async () => {
      stubCreateSuccess();

      const res = await request(app.getHttpServer())
        .post('/submissions')
        .send(validSubmission)
        .expect(201);

      expect(res.body).toMatchObject({
        productName: validSubmission.productName,
        brandName: validSubmission.brandName,
        discountInfo: validSubmission.discountInfo,
        summary: validSubmission.summary,
        instagramUrl: validSubmission.instagramUrl,
        reporterName: validSubmission.reporterName,
        reporterContact: validSubmission.reporterContact,
        isAnonymous: validSubmission.isAnonymous,
        status: 'PENDING',
        contentHash: expect.any(String),
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
      expect(Array.isArray(res.body.imageUrls)).toBe(true);
    });

    it('should create a submission with minimal fields (anonymous)', async () => {
      stubCreateSuccess();

      const res = await request(app.getHttpServer())
        .post('/submissions')
        .send({
          productName: '최소 제보 제품',
          startDate: '2026-07-10',
          purchaseUrl: 'https://example.com/product',
        })
        .expect(201);

      expect(res.body.productName).toBe('최소 제보 제품');
      expect(res.body.isAnonymous).toBe(true);
      expect(res.body.imageUrls).toEqual([]);
      expect(res.body.status).toBe('PENDING');
    });

    it('should reject submission with invalid date range', async () => {
      await request(app.getHttpServer())
        .post('/submissions')
        .send({
          productName: '날짜 역전 제품',
          startDate: '2026-07-20',
          endDate: '2026-07-10',
        })
        .expect(400);
    });

    it('should reject submission with invalid URL format', async () => {
      await request(app.getHttpServer())
        .post('/submissions')
        .send({
          productName: 'URL 오류 제품',
          startDate: '2026-07-01',
          purchaseUrl: 'not-a-valid-url',
        })
        .expect(400);
    });

    it('should reject submission with productName too short', async () => {
      await request(app.getHttpServer())
        .post('/submissions')
        .send({
          productName: 'a',
          startDate: '2026-07-01',
        })
        .expect(400);
    });

    it('should reject duplicate submission with 409 Conflict when existing is APPROVED', async () => {
      // Mock: content hash lookup returns an APPROVED submission
      prisma.gongguSubmission.findUnique.mockResolvedValue({
        id: 'existing-approved',
        status: SubmissionStatus.APPROVED,
        groupBuyId: 'gb-1',
        imageUrls: [],
        groupBuy: { id: 'gb-1' },
      });

      await request(app.getHttpServer())
        .post('/submissions')
        .send(validSubmission)
        .expect(409);
    });

    it('should reopen an existing REJECTED submission without creating a second contentHash row', async () => {
      const rejectedRow = {
        id: 'existing-rejected',
        createdAt: new Date().toISOString(),
        status: SubmissionStatus.REJECTED,
        productName: validSubmission.productName,
        brandName: validSubmission.brandName,
        startDate: new Date(validSubmission.startDate),
        endDate: new Date(validSubmission.endDate),
        purchaseUrl: validSubmission.purchaseUrl,
        discountInfo: validSubmission.discountInfo,
        summary: validSubmission.summary,
        instagramUrl: validSubmission.instagramUrl,
        imageUrls: [],
        reporterName: 'old reporter',
        reporterContact: 'old@example.com',
        isAnonymous: true,
        contentHash: 'same-content-hash',
        groupBuyId: null,
        groupBuy: null,
      };
      prisma.gongguSubmission.findUnique.mockResolvedValue(rejectedRow);
      prisma.gongguSubmission.update.mockImplementation(async (args) => ({
        ...rejectedRow,
        ...args.data,
      }));

      const res = await request(app.getHttpServer())
        .post('/submissions')
        .send(validSubmission)
        .expect(201);

      expect(res.body.status).toBe('PENDING');
      expect(res.body.id).toBe('existing-rejected');
      expect(prisma.gongguSubmission.create).not.toHaveBeenCalled();
      expect(prisma.gongguSubmission.update).toHaveBeenCalledWith({
        where: { id: 'existing-rejected' },
        data: expect.objectContaining({
          status: SubmissionStatus.PENDING,
          reviewedAt: null,
          reviewedBy: null,
          adminMemo: null,
          groupBuyId: null,
        }),
      });
    });

    it('should reopen an existing CANCELLED submission without creating a second contentHash row', async () => {
      const cancelledRow = {
        id: 'existing-cancelled',
        createdAt: new Date().toISOString(),
        status: SubmissionStatus.CANCELLED,
        productName: validSubmission.productName,
        brandName: validSubmission.brandName,
        startDate: new Date(validSubmission.startDate),
        endDate: new Date(validSubmission.endDate),
        purchaseUrl: validSubmission.purchaseUrl,
        discountInfo: validSubmission.discountInfo,
        summary: validSubmission.summary,
        instagramUrl: validSubmission.instagramUrl,
        imageUrls: [],
        reporterName: 'old reporter',
        reporterContact: 'old@example.com',
        isAnonymous: true,
        contentHash: 'same-content-hash',
        groupBuyId: null,
        groupBuy: null,
      };
      prisma.gongguSubmission.findUnique.mockResolvedValue(cancelledRow);
      prisma.gongguSubmission.update.mockImplementation(async (args) => ({
        ...cancelledRow,
        ...args.data,
      }));

      const res = await request(app.getHttpServer())
        .post('/submissions')
        .send(validSubmission)
        .expect(201);

      expect(res.body.status).toBe('PENDING');
      expect(res.body.id).toBe('existing-cancelled');
      expect(prisma.gongguSubmission.create).not.toHaveBeenCalled();
      expect(prisma.gongguSubmission.update).toHaveBeenCalledWith({
        where: { id: 'existing-cancelled' },
        data: expect.objectContaining({
          status: SubmissionStatus.PENDING,
          reviewedAt: null,
          reviewedBy: null,
          adminMemo: null,
          groupBuyId: null,
        }),
      });
    });

    it('should not return 500 for simultaneous identical POSTs when DB raises P2002', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the constraint: `gongguSubmission_content_hash_key`',
        { code: 'P2002', clientVersion: '6.19.0' },
      );
      const winningRow = {
        id: 'race-winner',
        createdAt: new Date().toISOString(),
        status: SubmissionStatus.PENDING,
        productName: validSubmission.productName,
        brandName: validSubmission.brandName,
        startDate: new Date(validSubmission.startDate),
        endDate: new Date(validSubmission.endDate),
        purchaseUrl: validSubmission.purchaseUrl,
        discountInfo: validSubmission.discountInfo,
        summary: validSubmission.summary,
        instagramUrl: validSubmission.instagramUrl,
        imageUrls: validSubmission.imageUrls,
        reporterName: validSubmission.reporterName,
        reporterContact: validSubmission.reporterContact,
        isAnonymous: validSubmission.isAnonymous,
        contentHash: 'same-content-hash',
        groupBuyId: null,
        groupBuy: null,
      };

      // request A: findUnique → null, create → winningRow (wins race)
      // request B: findUnique → null, create → P2002, findUnique(reload) → winningRow, update
      prisma.gongguSubmission.findUnique
        .mockResolvedValueOnce(null) // request A initial check
        .mockResolvedValueOnce(null) // request B initial check
        .mockResolvedValueOnce(winningRow); // request B reload after P2002
      prisma.gongguSubmission.create
        .mockResolvedValueOnce(winningRow) // request A wins
        .mockRejectedValueOnce(p2002); // request B gets P2002
      prisma.gongguSubmission.update.mockResolvedValue({
        ...winningRow,
        imageUrls: validSubmission.imageUrls,
      });

      const responses = await Promise.all([
        request(app.getHttpServer()).post('/submissions').send(validSubmission),
        request(app.getHttpServer()).post('/submissions').send(validSubmission),
      ]);

      // Neither response should be 500
      expect(responses.every((res) => res.status !== 500)).toBe(true);
      // Both should succeed (201 for normal create, 201 for update existing)
      expect(responses.map((res) => res.status).sort()).toEqual([201, 201]);
      // DB row count = 1 (one create, one update, no duplicate)
      expect(prisma.gongguSubmission.create).toHaveBeenCalledTimes(2);
      expect(prisma.gongguSubmission.update).toHaveBeenCalledTimes(1);
      // Both return the same winning row
      expect(responses.map((res) => res.body.id)).toEqual(['race-winner', 'race-winner']);
    });

    it('should accept submission with different startDate (different hash)', async () => {
      stubCreateSuccess();

      await request(app.getHttpServer())
        .post('/submissions')
        .send({
          ...validSubmission,
          startDate: '2026-08-01',
          endDate: '2026-08-07',
        })
        .expect(201);
    });

    it('should limit imageUrls to max 5', async () => {
      await request(app.getHttpServer())
        .post('/submissions')
        .send({
          ...validSubmission,
          imageUrls: [
            'https://example.com/img1.jpg',
            'https://example.com/img2.jpg',
            'https://example.com/img3.jpg',
            'https://example.com/img4.jpg',
            'https://example.com/img5.jpg',
            'https://example.com/img6.jpg',
          ],
        })
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────
  //  GET /submissions
  // ─────────────────────────────────────────────────────────
  describe('GET /submissions', () => {
    const allSeedItems = [
      {
        id: 'sub-a',
        productName: '크로와상 A',
        brandName: '베이커리 1',
        status: SubmissionStatus.PENDING,
        imageUrls: [],
        isAnonymous: false,
        reporterName: '제보자1',
        reporterContact: 'a@test.com',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        groupBuy: null,
      },
      {
        id: 'sub-b',
        productName: '마들렌 B',
        brandName: '베이커리 2',
        status: SubmissionStatus.APPROVED,
        imageUrls: ['https://example.com/b.jpg'],
        isAnonymous: true,
        createdAt: new Date('2026-07-10T00:00:00.000Z'),
        groupBuy: { id: 'gb-1' },
      },
      {
        id: 'sub-c',
        productName: '케이크 C',
        brandName: '베이커리 3',
        status: SubmissionStatus.REJECTED,
        imageUrls: [],
        isAnonymous: true,
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
        groupBuy: null,
      },
    ];

    beforeEach(() => {
      // Smart mock: filter, sort, and paginate like a real DB
      prisma.gongguSubmission.findMany.mockImplementation(async (args) => {
        let items = [...allSeedItems];
        const w = args?.where ?? {};
        if (w.status) items = items.filter((i) => i.status === w.status);
        if (w.OR) {
          // search — extract the contains value from the first OR clause
          const term = (w.OR[0]?.productName as { contains?: string })?.contains ?? '';
          if (term) items = items.filter((i) => i.productName.includes(term));
        }
        if (args?.orderBy) {
          const key = Object.keys(args.orderBy)[0] as keyof typeof items[0];
          const dir = (args.orderBy as Record<string, string>)[key];
          items.sort((a, b) =>
            dir === 'asc'
              ? String(a[key]).localeCompare(String(b[key]))
              : String(b[key]).localeCompare(String(a[key])),
          );
        }
        const skip = args?.skip ?? 0;
        const take = args?.take ?? items.length;
        items = items.slice(skip, skip + take);
        return items;
      });
      prisma.gongguSubmission.count.mockImplementation(async (args) => {
        let items = [...allSeedItems];
        const w = args?.where ?? {};
        if (w.status) items = items.filter((i) => i.status === w.status);
        if (w.OR) {
          const term = (w.OR[0]?.productName as { contains?: string })?.contains ?? '';
          if (term) items = items.filter((i) => i.productName.includes(term));
        }
        return items.length;
      });
    });

    it('should return paginated submissions', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions')
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(res.body.items).toHaveLength(3);
      expect(res.body.total).toBe(3);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions')
        .query({ status: 'PENDING', limit: 10 })
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].status).toBe('PENDING');
    });

    it('should search by query string', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions')
        .query({ q: '크로와상', limit: 10 })
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].productName).toContain('크로와상');
    });

    it('should filter by date range', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions')
        .query({ fromDate: '2020-01-01', toDate: '2030-12-31', limit: 10 })
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    });

    it('should sort by productName asc', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions')
        .query({ sortBy: 'productName', sortOrder: 'asc', limit: 10 })
        .expect(200);

      const names = res.body.items.map(
        (item: { productName: string }) => item.productName,
      );
      expect(names).toEqual([...names].sort());
    });
  });

  // ─────────────────────────────────────────────────────────
  //  GET /submissions/:id
  // ─────────────────────────────────────────────────────────
  describe('GET /submissions/:id', () => {
    it('should return submission by id', async () => {
      const created = {
        id: 'single-sub',
        productName: '단일 조회 제품',
        brandName: '브랜드',
        status: SubmissionStatus.PENDING,
        groupBuy: null,
      };
      prisma.gongguSubmission.findUnique.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .get('/submissions/single-sub')
        .expect(200);

      expect(res.body.id).toBe('single-sub');
      expect(res.body.productName).toBe('단일 조회 제품');
    });

    it('should return 404 for non-existent id', async () => {
      prisma.gongguSubmission.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/submissions/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
