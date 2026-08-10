import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CollectionReviewStatus, GroupBuyStatus, Prisma } from "@prisma/client";

import { profileLinkCandidatesFromSnapshot } from "../common/profile-link-candidates";
import { PrismaService } from "../prisma/prisma.service";
import { CalendarQueryDto } from "./dto/calendar-query.dto";
import { ListGroupBuysDto } from "./dto/list-group-buys.dto";
import { UpdateGroupBuyDto } from "./dto/update-group-buy.dto";

function serializeHomeBannerDates<
  T extends {
    homeBannerStartDate?: Date | null;
    homeBannerEndDate?: Date | null;
  },
>(groupBuy: T) {
  return {
    ...groupBuy,
    ...(groupBuy.homeBannerStartDate instanceof Date
      ? {
          homeBannerStartDate: groupBuy.homeBannerStartDate
            .toISOString()
            .slice(0, 10),
        }
      : {}),
    ...(groupBuy.homeBannerEndDate instanceof Date
      ? {
          homeBannerEndDate: groupBuy.homeBannerEndDate
            .toISOString()
            .slice(0, 10),
        }
      : {}),
  };
}

const AUTOMATIC_REVIEW_INCLUDE = {
  rawPost: { include: { influencer: true } },
  influencer: true,
} satisfies Prisma.GroupBuyInclude;

type AutomaticReviewGroupBuy = Prisma.GroupBuyGetPayload<{
  include: typeof AUTOMATIC_REVIEW_INCLUDE;
}>;

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function automaticReviewMediaItems(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const url = typeof item.url === "string" ? item.url : null;
      const mediaType =
        item.mediaType === "VIDEO" || item.media_type === "VIDEO"
          ? "VIDEO"
          : item.mediaType === "IMAGE" || item.media_type === "IMAGE"
            ? "IMAGE"
            : null;
      if (!url || !mediaType) return null;
      return {
        url,
        mediaType,
        thumbnailUrl:
          typeof item.thumbnailUrl === "string"
            ? item.thumbnailUrl
            : typeof item.thumbnail_url === "string"
              ? item.thumbnail_url
              : null,
      };
    })
    .filter((item) => item !== null)
    .slice(0, 20);
}

function automaticReviewSnapshot(groupBuy: AutomaticReviewGroupBuy) {
  const influencer = groupBuy.influencer ?? groupBuy.rawPost?.influencer;
  const mediaItems = automaticReviewMediaItems(groupBuy.mediaItems);
  const mediaUrls = mediaItems.map((item) => item.url);
  if (mediaUrls.length === 0 && groupBuy.rawPost?.imageUrl) {
    mediaUrls.push(groupBuy.rawPost.imageUrl);
  }

  return {
    schemaVersion: 1,
    rawPostId: groupBuy.rawPostId,
    instagramPostId: groupBuy.rawPost?.instagramPostId ?? null,
    originalPostUrl: groupBuy.rawPost?.postUrl ?? null,
    takenAt: iso(groupBuy.rawPost?.takenAt),
    productName: groupBuy.productName,
    brandName: groupBuy.brandName,
    instagramUsername: influencer?.instagramUsername ?? null,
    profileImageUrl: influencer?.profileImageUrl ?? null,
    category: groupBuy.category,
    startDate: iso(groupBuy.startDate),
    endDate: iso(groupBuy.endDate),
    purchaseUrl: groupBuy.purchaseUrl,
    profileLinkCandidates: profileLinkCandidatesFromSnapshot(
      groupBuy.collectionProposalSnapshot,
    ),
    discountInfo: groupBuy.discountInfo,
    priceKrw: groupBuy.priceKrw,
    summary: groupBuy.summary,
    thumbnailUrl: groupBuy.rawPost?.imageUrl ?? null,
    mediaUrls,
    mediaItems,
    mediaType: mediaItems[0]?.mediaType ?? null,
    confidence: groupBuy.confidence,
    postAudioUrl: null,
    postAudioStartTimeMs: null,
    postAudioDurationMs: null,
    isHomeBanner: groupBuy.isHomeBanner,
    homeBannerStartDate: iso(groupBuy.homeBannerStartDate),
    homeBannerEndDate: iso(groupBuy.homeBannerEndDate),
  } satisfies Prisma.InputJsonObject;
}

@Injectable()
export class GroupBuysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListGroupBuysDto) {
    const where: Prisma.GroupBuyWhereInput = {
      status: query.status ?? GroupBuyStatus.APPROVED,
    };

    if (query.q) {
      where.OR = [
        { productName: { contains: query.q, mode: "insensitive" } },
        { brandName: { contains: query.q, mode: "insensitive" } },
        { summary: { contains: query.q, mode: "insensitive" } },
      ];
    }

    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }

    const groupBuys = await this.prisma.groupBuy.findMany({
      where,
      include: { rawPost: { include: { influencer: true } } },
      orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
      take: query.limit,
    });

    return groupBuys.map(serializeHomeBannerDates);
  }

  async getCalendarView(query: CalendarQueryDto) {
    const monthStart = new Date(
      Date.UTC(query.year, query.month - 1, 1, 0, 0, 0, 0),
    );
    const monthEnd = new Date(
      Date.UTC(query.year, query.month, 0, 23, 59, 59, 999),
    );
    const month = `${query.year}-${String(query.month).padStart(2, "0")}`;

    const groupBuys = await this.prisma.groupBuy.findMany({
      where: {
        status: GroupBuyStatus.APPROVED,
        AND: [
          { endDate: { gte: monthStart } },
          { startDate: { lte: monthEnd } },
        ],
      },
      include: { rawPost: { include: { influencer: true } } },
      orderBy: [
        { startDate: "asc" },
        { endDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    const serializedGroupBuys = groupBuys.map(serializeHomeBannerDates);
    const grouped = new Map<string, typeof serializedGroupBuys>();
    for (const groupBuy of serializedGroupBuys) {
      const date = (groupBuy.startDate ?? groupBuy.endDate ?? monthStart)
        .toISOString()
        .slice(0, 10);
      const group = grouped.get(date) ?? [];
      group.push(groupBuy);
      grouped.set(date, group);
    }

    return {
      items: Array.from(grouped.entries()).map(([date, groupedGroupBuys]) => ({
        date,
        groupBuys: groupedGroupBuys,
      })),
      meta: {
        total: groupBuys.length,
        month,
      },
    };
  }

  async get(id: string) {
    const groupBuy = await this.prisma.groupBuy.findUnique({
      where: { id },
      include: { rawPost: { include: { influencer: true } } },
    });

    if (!groupBuy) {
      throw new NotFoundException("Group buy not found");
    }

    return serializeHomeBannerDates(groupBuy);
  }

  async updateAdmin(id: string, dto: UpdateGroupBuyDto) {
    const updated = await this.prisma.groupBuy.update({
      where: { id },
      data: {
        productName: dto.productName,
        brandName: dto.brandName,
        category: dto.category,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        purchaseUrl: dto.purchaseUrl,
        discountInfo: dto.discountInfo,
        priceKrw: dto.priceKrw,
        summary: dto.summary,
      },
      include: { rawPost: { include: { influencer: true } } },
    });

    return serializeHomeBannerDates(updated);
  }

  async approve(id: string, reviewedBy?: string) {
    const groupBuy = await this.prisma.groupBuy.findUnique({
      where: { id },
      include: AUTOMATIC_REVIEW_INCLUDE,
    });

    if (!groupBuy) {
      throw new NotFoundException("Group buy not found");
    }

    if (!groupBuy.startDate && !groupBuy.endDate) {
      throw new BadRequestException(
        "승인하려면 시작일 또는 종료일 중 최소 1개가 필요합니다.",
      );
    }

    if (
      groupBuy.sourceType === "PLAYWRIGHT_PUBLIC" &&
      (!groupBuy.productName?.trim() ||
        !groupBuy.category?.trim() ||
        !groupBuy.purchaseUrl?.trim())
    ) {
      throw new BadRequestException(
        "자동 수집 공구는 승인 전에 제품명, 카테고리, 구매 URL을 보완해야 합니다.",
      );
    }

    if (groupBuy.sourceType === "PLAYWRIGHT_PUBLIC") {
      if (groupBuy.collectionReviewStatus === CollectionReviewStatus.APPROVED) {
        return serializeHomeBannerDates(groupBuy);
      }
      if (groupBuy.collectionReviewStatus === CollectionReviewStatus.REJECTED) {
        throw new ConflictException("이미 반려된 자동수집 항목입니다.");
      }

      const reviewedAt = new Date();
      const result = await this.prisma.groupBuy.updateMany({
        where: {
          id,
          updatedAt: groupBuy.updatedAt,
          OR: [
            { collectionReviewStatus: CollectionReviewStatus.PENDING },
            { collectionReviewStatus: null },
          ],
        },
        data: {
          status: GroupBuyStatus.APPROVED,
          rejectionReason: null,
          reviewedAt,
          ...(reviewedBy ? { reviewedBy } : {}),
          collectionReviewStatus: CollectionReviewStatus.APPROVED,
          collectionReviewedSnapshot: automaticReviewSnapshot(groupBuy),
        },
      });
      const approved = await this.prisma.groupBuy.findUnique({
        where: { id },
        include: AUTOMATIC_REVIEW_INCLUDE,
      });
      if (!approved) throw new NotFoundException("Group buy not found");
      if (
        result.count === 0 &&
        approved.collectionReviewStatus !== CollectionReviewStatus.APPROVED
      ) {
        throw new ConflictException("다른 검수 작업이 먼저 완료되었습니다.");
      }
      return serializeHomeBannerDates(approved);
    }

    const approved = await this.prisma.groupBuy.update({
      where: { id },
      data: {
        status: GroupBuyStatus.APPROVED,
        rejectionReason: null,
        reviewedAt: new Date(),
        ...(reviewedBy ? { reviewedBy } : {}),
      },
      include: { rawPost: { include: { influencer: true } } },
    });

    return serializeHomeBannerDates(approved);
  }

  async reject(id: string, reason: string, reviewedBy?: string) {
    const rejectionReason = reason.trim();
    if (!rejectionReason) {
      throw new BadRequestException("반려 사유는 필수입니다.");
    }

    if (rejectionReason.length > 500) {
      throw new BadRequestException("반려 사유는 500자 이하여야 합니다.");
    }

    const groupBuy = await this.prisma.groupBuy.findUnique({
      where: { id },
      include: AUTOMATIC_REVIEW_INCLUDE,
    });
    if (!groupBuy) throw new NotFoundException("Group buy not found");

    if (groupBuy.sourceType === "PLAYWRIGHT_PUBLIC") {
      if (groupBuy.collectionReviewStatus === CollectionReviewStatus.REJECTED) {
        return serializeHomeBannerDates(groupBuy);
      }
      if (groupBuy.collectionReviewStatus === CollectionReviewStatus.APPROVED) {
        throw new ConflictException("이미 공구 등록된 자동수집 항목입니다.");
      }

      const reviewedAt = new Date();
      const result = await this.prisma.groupBuy.updateMany({
        where: {
          id,
          updatedAt: groupBuy.updatedAt,
          OR: [
            { collectionReviewStatus: CollectionReviewStatus.PENDING },
            { collectionReviewStatus: null },
          ],
        },
        data: {
          status: GroupBuyStatus.REJECTED,
          rejectionReason,
          reviewedAt,
          ...(reviewedBy ? { reviewedBy } : {}),
          collectionReviewStatus: CollectionReviewStatus.REJECTED,
          collectionReviewedSnapshot: automaticReviewSnapshot(groupBuy),
        },
      });
      const rejected = await this.prisma.groupBuy.findUnique({
        where: { id },
        include: AUTOMATIC_REVIEW_INCLUDE,
      });
      if (!rejected) throw new NotFoundException("Group buy not found");
      if (
        result.count === 0 &&
        rejected.collectionReviewStatus !== CollectionReviewStatus.REJECTED
      ) {
        throw new ConflictException("다른 검수 작업이 먼저 완료되었습니다.");
      }
      return serializeHomeBannerDates(rejected);
    }

    const rejected = await this.prisma.groupBuy.update({
      where: { id },
      data: {
        status: GroupBuyStatus.REJECTED,
        rejectionReason,
        reviewedAt: new Date(),
        ...(reviewedBy ? { reviewedBy } : {}),
      },
      include: { rawPost: { include: { influencer: true } } },
    });

    return serializeHomeBannerDates(rejected);
  }
}
