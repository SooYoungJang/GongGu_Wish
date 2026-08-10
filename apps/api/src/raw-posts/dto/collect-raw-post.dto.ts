import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RawPostCollectionSource } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class CollectProfileLinkCandidateDto {
  @ApiProperty()
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: true,
    disallow_auth: true,
  })
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}

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

  @ApiPropertyOptional({ type: () => [CollectProfileLinkCandidateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CollectProfileLinkCandidateDto)
  profileLinkCandidates?: CollectProfileLinkCandidateDto[];
}
