import { ConflictException, Injectable } from "@nestjs/common";
import { RawPostCollectionSource } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { CreateInfluencerDto } from "./dto/create-influencer.dto";
import { UpdatePlaywrightCollectionDto } from "./dto/update-playwright-collection.dto";

@Injectable()
export class InfluencersService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.influencer.findMany({
      where: { isActive: true },
      orderBy: { instagramUsername: "asc" },
    });
  }

  async listAll() {
    const influencers = await this.prisma.influencer.findMany({
      orderBy: [{ isActive: "desc" }, { instagramUsername: "asc" }],
    });

    if (!this.prisma.rawPost?.groupBy) {
      return influencers;
    }

    const source = RawPostCollectionSource.PLAYWRIGHT_PUBLIC;
    const [totalCounts, candidateCounts, koreaCandidateCounts] =
      await Promise.all([
        this.prisma.rawPost.groupBy({
          by: ["influencerId"],
          where: { collectionSource: source },
          _count: { _all: true },
        }),
        this.prisma.rawPost.groupBy({
          by: ["influencerId"],
          where: { collectionSource: source, isCandidate: true },
          _count: { _all: true },
        }),
        this.prisma.rawPost.groupBy({
          by: ["influencerId"],
          where: { collectionSource: source, isKoreaCandidate: true },
          _count: { _all: true },
        }),
      ]);
    const toCountMap = (
      rows: Array<{ influencerId: string; _count: { _all: number } }>,
    ) => new Map(rows.map((row) => [row.influencerId, row._count._all]));
    const totalMap = toCountMap(totalCounts);
    const candidateMap = toCountMap(candidateCounts);
    const koreaCandidateMap = toCountMap(koreaCandidateCounts);

    return influencers.map((influencer) => ({
      ...influencer,
      playwrightRawPostCount: totalMap.get(influencer.id) ?? 0,
      playwrightCandidateCount: candidateMap.get(influencer.id) ?? 0,
      playwrightKoreaCandidateCount: koreaCandidateMap.get(influencer.id) ?? 0,
    }));
  }

  listPlaywrightWatchlist(now = new Date()) {
    return this.prisma.influencer.findMany({
      where: {
        isActive: true,
        playwrightCollectionEnabled: true,
        OR: [
          { playwrightNextRunAt: null },
          { playwrightNextRunAt: { lte: now } },
        ],
      },
      select: {
        id: true,
        instagramUsername: true,
        displayName: true,
        playwrightFailureCount: true,
        playwrightNextRunAt: true,
      },
      orderBy: [{ playwrightNextRunAt: "asc" }, { instagramUsername: "asc" }],
    });
  }

  updatePlaywrightCollection(id: string, dto: UpdatePlaywrightCollectionDto) {
    return this.prisma.influencer.update({
      where: { id },
      data: {
        playwrightCollectionEnabled: dto.playwrightCollectionEnabled,
        ...(dto.playwrightCollectionEnabled
          ? {}
          : { playwrightNextRunAt: null }),
      },
    });
  }

  updatePlaywrightStatus(
    id: string,
    input: {
      status: "SUCCESS" | "ERROR" | "BLOCKED";
      attemptAt: Date;
      nextRunAt: Date;
      errorCode?: string;
      errorMessage?: string;
    },
  ) {
    const isSuccess = input.status === "SUCCESS";
    const errorText =
      input.errorCode || input.errorMessage
        ? `${input.errorCode ?? input.status}: ${input.errorMessage ?? "수집 실패"}`.slice(
            0,
            500,
          )
        : null;

    return this.prisma.influencer.update({
      where: { id },
      data: {
        playwrightLastAttemptAt: input.attemptAt,
        playwrightLastSuccessAt: isSuccess ? input.attemptAt : undefined,
        playwrightLastError: isSuccess ? null : errorText,
        playwrightFailureCount: isSuccess ? 0 : { increment: 1 },
        playwrightNextRunAt: input.nextRunAt,
      },
    });
  }

  async create(dto: CreateInfluencerDto) {
    const instagramUsername = dto.instagramUsername.trim().replace(/^@/, "");
    const existing = await this.prisma.influencer.findUnique({
      where: { instagramUsername },
    });

    if (existing?.isActive) {
      throw new ConflictException("이미 등록된 인스타 계정입니다.");
    }

    if (existing) {
      return this.prisma.influencer.update({
        where: { id: existing.id },
        data: {
          displayName: dto.displayName,
          profileImageUrl: dto.profileImageUrl,
          isActive: true,
        },
      });
    }

    return this.prisma.influencer.create({
      data: {
        instagramUsername,
        displayName: dto.displayName,
        profileImageUrl: dto.profileImageUrl,
      },
    });
  }

  async deactivate(id: string) {
    return this.prisma.influencer.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
