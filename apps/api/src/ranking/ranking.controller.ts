import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GroupBuyRankingQueryDto } from './dto/seller-ranking-query.dto';
import { RankingService } from './ranking.service';

@ApiTags('ranking')
@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get(['sellers', 'group-buys'])
  @ApiOperation({ summary: '공구 랭킹 목록' })
  @ApiOkResponse({ description: 'GroupBuyRankingResponse 계약을 반환' })
  list(@Query() query: GroupBuyRankingQueryDto) {
    return this.rankingService.list(query);
  }
}
