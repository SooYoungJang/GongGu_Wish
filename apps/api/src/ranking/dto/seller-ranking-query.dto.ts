import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum RankingCategory {
  all = 'all',
  beauty = 'beauty',
  fashion = 'fashion',
  food = 'food',
  living = 'living',
  home = 'home',
  kitchen = 'kitchen',
  electronics = 'electronics',
  pet = 'pet',
  auto = 'auto',
  hobby = 'hobby',
  baby = 'baby',
  sports = 'sports',
  stationery = 'stationery',
  books = 'books',
  media = 'media',
  travel = 'travel',
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
}

export class GroupBuyRankingQueryDto {
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

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor returned in pageInfo.nextCursor' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

// Legacy import name retained while the route migrates from seller-shaped data.
export { GroupBuyRankingQueryDto as SellerRankingQueryDto };
