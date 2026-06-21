import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SellerRankingQueryDto } from './dto/seller-ranking-query.dto';
import { RankingService } from './ranking.service';

@ApiTags('ranking')
@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('sellers')
  @ApiOperation({ summary: '셀러 랭킹 목록' })
  @ApiOkResponse({ description: 'SellerRanking[] 데이터를 data 필드로 반환' })
  list(@Query() query: SellerRankingQueryDto) {
    return this.rankingService.list(query);
  }
}
