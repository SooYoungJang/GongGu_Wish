import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GroupBuyStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { ListGroupBuysDto } from './dto/list-group-buys.dto';

function serializeHomeBannerDates<T extends {
  homeBannerStartDate?: Date | null;
  homeBannerEndDate?: Date | null;
}>(groupBuy: T) {
  return {
    ...groupBuy,
    ...(groupBuy.homeBannerStartDate instanceof Date
      ? { homeBannerStartDate: groupBuy.homeBannerStartDate.toISOString().slice(0, 10) }
      : {}),
    ...(groupBuy.homeBannerEndDate instanceof Date
      ? { homeBannerEndDate: groupBuy.homeBannerEndDate.toISOString().slice(0, 10) }
      : {}),
  };
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
        { productName: { contains: query.q, mode: 'insensitive' } },
        { brandName: { contains: query.q, mode: 'insensitive' } },
        { summary: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const groupBuys = await this.prisma.groupBuy.findMany({
      where,
      include: { rawPost: { include: { influencer: true } } },
      orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
      take: query.limit,
    });

    return groupBuys.map(serializeHomeBannerDates);
  }

  async getCalendarView(query: CalendarQueryDto) {
    const monthStart = new Date(Date.UTC(query.year, query.month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999));
    const month = `${query.year}-${String(query.month).padStart(2, '0')}`;

    const groupBuys = await this.prisma.groupBuy.findMany({
      where: {
        status: GroupBuyStatus.APPROVED,
        AND: [
          { endDate: { gte: monthStart } },
          { startDate: { lte: monthEnd } },
        ],
      },
      include: { rawPost: { include: { influencer: true } } },
      orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }, { createdAt: 'desc' }],
    });

    const serializedGroupBuys = groupBuys.map(serializeHomeBannerDates);
    const grouped = new Map<string, typeof serializedGroupBuys>();
    for (const groupBuy of serializedGroupBuys) {
      const date = (groupBuy.startDate ?? groupBuy.endDate ?? monthStart).toISOString().slice(0, 10);
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
      throw new NotFoundException('Group buy not found');
    }

    return serializeHomeBannerDates(groupBuy);
  }

  async approve(id: string) {
    const groupBuy = await this.prisma.groupBuy.findUnique({
      where: { id },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!groupBuy) {
      throw new NotFoundException('Group buy not found');
    }

    if (!groupBuy.startDate && !groupBuy.endDate) {
      throw new BadRequestException('승인하려면 시작일 또는 종료일 중 최소 1개가 필요합니다.');
    }

    const approved = await this.prisma.groupBuy.update({
      where: { id },
      data: {
        status: GroupBuyStatus.APPROVED,
        rejectionReason: null,
        reviewedAt: new Date(),
      },
      include: { rawPost: { include: { influencer: true } } },
    });

    return serializeHomeBannerDates(approved);
  }

  async reject(id: string, reason: string) {
    const rejectionReason = reason.trim();
    if (!rejectionReason) {
      throw new BadRequestException('반려 사유는 필수입니다.');
    }

    const rejected = await this.prisma.groupBuy.update({
      where: { id },
      data: {
        status: GroupBuyStatus.REJECTED,
        rejectionReason,
        reviewedAt: new Date(),
      },
      include: { rawPost: { include: { influencer: true } } },
    });

    return serializeHomeBannerDates(rejected);
  }
}
