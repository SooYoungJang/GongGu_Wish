import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RawPostCollectionSource } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";

export class CollectRawPostDto {
  @ApiProperty()
  @IsString()
  instagramPostId!: string;

  @ApiProperty()
  @IsString()
  influencerUsername!: string;

  @ApiProperty()
  @IsString()
  caption!: string;

  @ApiProperty()
  @IsUrl()
  postUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty()
  @IsDateString()
  takenAt!: string;

  @ApiProperty()
  @IsDateString()
  collectedAt!: string;

  @ApiPropertyOptional({ enum: RawPostCollectionSource })
  @IsOptional()
  @IsEnum(RawPostCollectionSource)
  collectionSource?: RawPostCollectionSource;
}
