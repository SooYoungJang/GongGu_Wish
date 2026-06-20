import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, SubmissionStatus, GroupBuyStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ListSubmissionsDto } from './dto/list-submissions.dto';
import { ApproveSubmissionDto } from './dto/review-submission.dto';
import { RejectSubmissionDto } from './dto/review-submission.dto';
import { createSubmissionHash } from './hash';

export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubmissionDto) {
    this.validateDateRange(dto);

    const contentHash = createSubmissionHash({
      productName: dto.productName,
      startDate: dto.startDate,
      purchaseUrl: dto.purchaseUrl,
    });

    // 중복 확인
    const existing = await this.prisma.gongguSubmission.findUnique({
      where: { contentHash },
      include: { groupBuy: true },
    });

    if (existing) {
      return this.handleExistingSubmission(existing, dto, contentHash);
    }

    // 신규 생성. Concurrent identical POSTs can race between findUnique() and
    // create(); if the database unique constraint wins first, reload the row
    // and apply the same duplicate policy instead of leaking P2002 as a 500.
    try {
      return await this.prisma.gongguSubmission.create({
        data: {
          productName: dto.productName,
          brandName: dto.brandName,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          purchaseUrl: dto.purchaseUrl,
          discountInfo: dto.discountInfo,
          summary: dto.summary,
          instagramUrl: dto.instagramUrl,
          imageUrls: dto.imageUrls ?? [],
          reporterName: dto.reporterName,
          reporterContact: dto.reporterContact,
          isAnonymous: dto.isAnonymous ?? true,
          contentHash,
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const racedExisting = await this.prisma.gongguSubmission.findUnique({
        where: { contentHash },
        include: { groupBuy: true },
      });

      if (!racedExisting) {
        throw error;
      }

      return this.handleExistingSubmission(racedExisting, dto, contentHash);
    }
  }

  private isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async handleExistingSubmission(
    existing: { id: string; status: SubmissionStatus; groupBuyId: string | null; imageUrls: string[] },
    dto: CreateSubmissionDto,
    contentHash: string,
  ) {
    switch (existing.status) {
      case SubmissionStatus.PENDING:
        // 기존 제보 업데이트 (이미지 추가, 정보 보완 등)
        return this.updateExistingSubmission(existing, dto);
      case SubmissionStatus.APPROVED:
        throw new ConflictException({
          message: '이미 승인된 공구입니다.',
          groupBuyId: existing.groupBuyId,
          submissionId: existing.id,
        });
      case SubmissionStatus.REJECTED:
      case SubmissionStatus.CANCELLED:
        // 재제보 허용: contentHash @unique를 유지하기 위해 신규 row 생성 대신 기존 row를 PENDING으로 재오픈
        return this.reopenExistingSubmission(existing, dto, contentHash);
      case SubmissionStatus.DUPLICATE:
        throw new ConflictException({
          message: '중복 제보입니다. 원본 제보를 확인해 주세요.',
          originalSubmissionId: existing.id,
        });
    }
  }

  private validateDateRange(dto: CreateSubmissionDto) {
    if (!dto.startDate || !dto.endDate) {
      return;
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('날짜 형식이 올바르지 않습니다.');
    }
    if (start > end) {
      throw new BadRequestException('시작일은 종료일보다 늦을 수 없습니다.');
    }
  }

  private async updateExistingSubmission(
    existing: { id: string; imageUrls: string[] },
    dto: CreateSubmissionDto,
  ) {
    // 이미지 URL 병합 (중복 제거)
    const mergedImageUrls = Array.from(new Set([...existing.imageUrls, ...(dto.imageUrls ?? [])])).slice(0, 5);

    return this.prisma.gongguSubmission.update({
      where: { id: existing.id },
      data: {
        // 선택적 필드만 업데이트 (undefined인 경우 무시)
        brandName: dto.brandName ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        purchaseUrl: dto.purchaseUrl ?? undefined,
        discountInfo: dto.discountInfo ?? undefined,
        summary: dto.summary ?? undefined,
        instagramUrl: dto.instagramUrl ?? undefined,
        imageUrls: mergedImageUrls,
        reporterName: dto.reporterName ?? undefined,
        reporterContact: dto.reporterContact ?? undefined,
        isAnonymous: dto.isAnonymous ?? undefined,
      },
    });
  }

  private async reopenExistingSubmission(
    existing: { id: string; imageUrls: string[] },
    dto: CreateSubmissionDto,
    contentHash: string,
  ) {
    return this.prisma.gongguSubmission.update({
      where: { id: existing.id },
      data: {
        productName: dto.productName,
        brandName: dto.brandName ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        purchaseUrl: dto.purchaseUrl ?? undefined,
        discountInfo: dto.discountInfo ?? undefined,
        summary: dto.summary ?? undefined,
        instagramUrl: dto.instagramUrl ?? undefined,
        imageUrls: dto.imageUrls ?? [],
        reporterName: dto.reporterName ?? undefined,
        reporterContact: dto.reporterContact ?? undefined,
        isAnonymous: dto.isAnonymous ?? true,
        contentHash,
        status: SubmissionStatus.PENDING,
        adminMemo: null,
        reviewedAt: null,
        reviewedBy: null,
        groupBuyId: null,
      },
    });
  }

  async findAll(query: ListSubmissionsDto) {
    const where: Prisma.GongguSubmissionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { productName: { contains: query.q, mode: 'insensitive' } },
        { brandName: { contains: query.q, mode: 'insensitive' } },
        { summary: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const orderBy: Prisma.GongguSubmissionOrderByWithRelationInput = {};
    orderBy[query.sortBy ?? 'createdAt'] = query.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      this.prisma.gongguSubmission.findMany({
        where,
        include: { groupBuy: true },
        orderBy,
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
      }),
      this.prisma.gongguSubmission.count({ where }),
    ]);

    return { items, total };
  }

  async findAllCursor(query: ListSubmissionsDto): Promise<CursorPaginatedResult<any>> {
    const where: Prisma.GongguSubmissionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { productName: { contains: query.q, mode: 'insensitive' } },
        { brandName: { contains: query.q, mode: 'insensitive' } },
        { summary: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    // 커서 기반 페이지네이션: cursor가 있으면 해당 ID 이후 데이터 조회
    if (query.cursor) {
      where.id = { lt: query.cursor };
    }

    const orderBy: Prisma.GongguSubmissionOrderByWithRelationInput = {};
    orderBy[query.sortBy ?? 'createdAt'] = query.sortOrder ?? 'desc';

    const limit = Math.min(query.limit ?? 20, 100);

    // limit + 1개를 조회하여 hasMore 판단
    const items = await this.prisma.gongguSubmission.findMany({
      where,
      include: { groupBuy: true },
      orderBy,
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : undefined;

    return {
      items: resultItems,
      nextCursor,
      hasMore,
    };
  }

  async findById(id: string) {
    const submission = await this.prisma.gongguSubmission.findUnique({
      where: { id },
      include: { groupBuy: true },
    });

    if (!submission) {
      throw new NotFoundException('제보를 찾을 수 없습니다.');
    }

    return submission;
  }

  async getStatus(id: string) {
    const submission = await this.prisma.gongguSubmission.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        groupBuyId: true,
        reviewedAt: true,
        adminMemo: true,
        createdAt: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('제보를 찾을 수 없습니다.');
    }

    return {
      id: submission.id,
      status: submission.status,
      groupBuyId: submission.groupBuyId,
      reviewedAt: submission.reviewedAt,
      rejectionReason: submission.adminMemo,
      submittedAt: submission.createdAt,
    };
  }

  async cancel(id: string) {
    const submission = await this.prisma.gongguSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('제보를 찾을 수 없습니다.');
    }

    // PENDING 상태만 취소 가능
    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException(`이미 ${submission.status} 처리된 제보는 취소할 수 없습니다.`);
    }

    return this.prisma.gongguSubmission.update({
      where: { id },
      data: {
        status: SubmissionStatus.CANCELLED,
        adminMemo: '제보자가 직접 취소함',
      },
    });
  }

  async approve(id: string, dto: ApproveSubmissionDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.gongguSubmission.findUnique({
        where: { id },
      });

      if (!submission) throw new NotFoundException('제보를 찾을 수 없습니다.');
      if (submission.status !== SubmissionStatus.PENDING) {
        throw new BadRequestException(`이미 ${submission.status} 처리된 제보입니다.`);
      }

      // GroupBuy 생성
      const groupBuy = await tx.groupBuy.create({
        data: {
          sourceType: 'SUBMISSION',
          submissionId: submission.id,
          productName: submission.productName,
          brandName: submission.brandName,
          startDate: submission.startDate ? new Date(submission.startDate) : null,
          endDate: submission.endDate ? new Date(submission.endDate) : null,
          purchaseUrl: submission.purchaseUrl,
          discountInfo: submission.discountInfo,
          summary: submission.summary,
          confidence: 0.9,
          status: GroupBuyStatus.APPROVED,
          isAllDay: dto.isAllDay ?? false,
        },
      });

      // Submission 상태 업데이트
      const updated = await tx.gongguSubmission.update({
        where: { id },
        data: {
          status: SubmissionStatus.APPROVED,
          groupBuyId: groupBuy.id,
          reviewedAt: new Date(),
          reviewedBy: adminId,
          adminMemo: dto.adminMemo,
        },
        include: { groupBuy: true },
      });

      return { groupBuy, submission: updated };
    });
  }

  async reject(id: string, dto: RejectSubmissionDto, adminId: string) {
    const submission = await this.prisma.gongguSubmission.findUnique({
      where: { id },
    });

    if (!submission) throw new NotFoundException('제보를 찾을 수 없습니다.');
    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException(`이미 ${submission.status} 처리된 제보입니다.`);
    }

    return this.prisma.gongguSubmission.update({
      where: { id },
      data: {
        status: SubmissionStatus.REJECTED,
        adminMemo: dto.reason,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });
  }
}