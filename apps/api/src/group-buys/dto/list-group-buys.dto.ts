import { ApiPropertyOptional } from "@nestjs/swagger";
import { GroupBuyStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListGroupBuysDto {
  @ApiPropertyOptional({ enum: GroupBuyStatus })
  @IsOptional()
  @IsEnum(GroupBuyStatus)
  status?: GroupBuyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: "예: PLAYWRIGHT_PUBLIC" })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
