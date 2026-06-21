import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum RankingTab {
  ranking = 'ranking',
  following = 'following',
}

export enum RankingCategory {
  all = 'all',
  beauty = 'beauty',
  fashion = 'fashion',
  food = 'food',
  lifestyle = 'lifestyle',
  baby = 'baby',
  digital = 'digital',
}

export enum RankingPeriod {
  today = 'today',
  weekly = 'weekly',
  monthly = 'monthly',
}

export enum RankingSort {
  popular = 'popular',
  rising = 'rising',
  deadlineSoon = 'deadlineSoon',
  newDeal = 'newDeal',
  brand = 'brand',
}

export class SellerRankingQueryDto {
  @ApiPropertyOptional({ enum: RankingTab, default: RankingTab.ranking })
  @IsOptional()
  @IsEnum(RankingTab)
  tab?: RankingTab;

  @ApiPropertyOptional({ enum: RankingCategory, default: RankingCategory.all })
  @IsOptional()
  @IsEnum(RankingCategory)
  category?: RankingCategory;

  @ApiPropertyOptional({ enum: RankingPeriod, default: RankingPeriod.weekly })
  @IsOptional()
  @IsEnum(RankingPeriod)
  period?: RankingPeriod;

  @ApiPropertyOptional({ enum: RankingSort, default: RankingSort.popular })
  @IsOptional()
  @IsEnum(RankingSort)
  sort?: RankingSort;
}
