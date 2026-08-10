import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export enum CollectorRunStatus {
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
  BLOCKED = "BLOCKED",
}

export class UpdateCollectorStatusDto {
  @ApiProperty({ enum: CollectorRunStatus })
  @IsEnum(CollectorRunStatus)
  status!: CollectorRunStatus;

  @ApiProperty()
  @IsDateString()
  attemptAt!: string;

  @ApiProperty()
  @IsDateString()
  nextRunAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  errorCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  errorMessage?: string;
}
