import { Injectable } from "@nestjs/common";
import {
  GroupBuyStatus,
  ParsingStatus,
  Prisma,
  RawPostCollectionSource,
} from "@prisma/client";
import { parseSubmissionCaption } from "@gonggu/shared";

import { PrismaService } from "../prisma/prisma.service";
import { isGroupBuyCandidate } from "./candidate-rules";
import { CollectRawPostDto } from "./dto/collect-raw-post.dto";
import { ListRawPostsDto } from "./dto/list-raw-posts.dto";
import { createContentHash } from "./hash";
import { classifyKoreaCaption } from "./korea-rules";

@Injectable()
export class RawPostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListRawPostsDto) {
    const where: Prisma.RawPostWhereInput = {};

    if (query.parsingStatus) {
      where.parsingStatus = query.parsingStatus;
    }

    if (query.isCandidate !== undefined) {
      where.isCandidate = query.isCandidate === "true";
    }

    if (query.collectionSource) {
      where.collectionSource = query.collectionSource;
    }

    if (query.isKoreaCandidate !== undefined) {
      where.isKoreaCandidate = query.isKoreaCandidate === "true";
    }

    return this.prisma.rawPost.findMany({
      where,
      include: { influencer: true, groupBuy: true },
      orderBy: { collectedAt: "desc" },
      take: query.limit,
    });
  }

  async collect(dto: CollectRawPostDto) {
    const contentHash = createContentHash({
      instagramPostId: dto.instagramPostId,
      caption: dto.caption,
      postUrl: dto.postUrl,
    });
    const isCandidate = isGroupBuyCandidate(dto.caption);
    const collectionSource =
      dto.collectionSource ?? RawPostCollectionSource.LEGACY_INSTAGRAPI;
    const isPlaywrightCollection =
      collectionSource === RawPostCollectionSource.PLAYWRIGHT_PUBLIC;
    const koreaSignals = classifyKoreaCaption(dto.caption);
    const isKoreaCandidate = isPlaywrightCollection
      ? koreaSignals.isKoreaCandidate
      : true;

    let parsedCaption: ReturnType<typeof parseSubmissionCaption> = {};
    let parseError: string | undefined;
    if (isPlaywrightCollection && isCandidate && isKoreaCandidate) {
      try {
        parsedCaption = parseSubmissionCaption(dto.caption, {
          referenceDate: new Date(dto.takenAt),
        });
      } catch (error) {
        parseError =
          error instanceof Error
            ? error.message.slice(0, 500)
            : "캡션 파싱 실패";
      }
    }

    const parsingStatus = !isCandidate
      ? isPlaywrightCollection
        ? ParsingStatus.NOT_GROUP_BUY
        : ParsingStatus.NEW
      : isPlaywrightCollection && !isKoreaCandidate
        ? ParsingStatus.NOT_KOREA
        : isPlaywrightCollection
          ? parseError
            ? ParsingStatus.FAILED
            : ParsingStatus.PARSED
          : ParsingStatus.PENDING;
    const shouldCreateReview =
      isPlaywrightCollection && isCandidate && isKoreaCandidate;

    return this.prisma.$transaction(async (tx) => {
      const influencer = await tx.influencer.upsert({
        where: { instagramUsername: dto.influencerUsername },
        update: {},
        create: { instagramUsername: dto.influencerUsername },
      });

      const existing = await tx.rawPost.findFirst({
        where: {
          OR: [{ instagramPostId: dto.instagramPostId }, { contentHash }],
        },
      });

      if (existing) {
        return { rawPost: existing, created: false, duplicate: true };
      }

      const rawPost = await tx.rawPost.create({
        data: {
          instagramPostId: dto.instagramPostId,
          influencerId: influencer.id,
          caption: dto.caption,
          postUrl: dto.postUrl,
          imageUrl: dto.imageUrl,
          takenAt: new Date(dto.takenAt),
          collectedAt: new Date(dto.collectedAt),
          contentHash,
          isCandidate,
          isKoreaCandidate,
          collectionSource,
          parsingStatus,
          parsedAt:
            isPlaywrightCollection && isCandidate && isKoreaCandidate
              ? new Date()
              : null,
          parseError: parseError ?? null,
          groupBuy: shouldCreateReview
            ? {
                create: {
                  influencer: { connect: { id: influencer.id } },
                  productName: parsedCaption.productName,
                  brandName: parsedCaption.brandName,
                  startDate: parseDate(parsedCaption.startDate),
                  endDate: parseDate(parsedCaption.endDate),
                  purchaseUrl: parsedCaption.purchaseUrl,
                  discountInfo: parsedCaption.discountInfo,
                  priceKrw: parsedCaption.priceKrw,
                  summary: dto.caption.slice(0, 500),
                  confidence: 0.5,
                  status: GroupBuyStatus.REVIEW_REQUIRED,
                  sourceType: "PLAYWRIGHT_PUBLIC",
                },
              }
            : undefined,
        },
      });

      return { rawPost, created: true, duplicate: false };
    });
  }
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
