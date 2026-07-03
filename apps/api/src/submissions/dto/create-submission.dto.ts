import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUrl,
  IsArray,
  IsBoolean,
  IsDateString,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ValidateIf,
  IsIn,
} from 'class-validator';

const GONGGU_CATEGORIES = ['beauty', 'fashion', 'food', 'lifestyle', 'baby', 'digital'] as const;

export class CreateSubmissionDto {
  @ApiProperty({ example: '마롱드파리 크로와상 6입', description: '제품명 (필수)' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  productName!: string;

  @ApiPropertyOptional({ example: '마롱드파리', description: '브랜드명' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brandName?: string;

  @ApiPropertyOptional({ enum: GONGGU_CATEGORIES, example: 'beauty', description: '공구 카테고리' })
  @IsOptional()
  @IsString()
  @IsIn(GONGGU_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ example: '2026-06-20', description: '공구 시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-27', description: '공구 마감일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'https://smartstore.naver.com/...', description: '구매 링크' })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o) => o.purchaseUrl && o.purchaseUrl.length > 0)
  purchaseUrl?: string;

  @ApiPropertyOptional({ example: '정가 25,000원 → 18,900원 (24% 할인)', description: '할인 정보' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountInfo?: string;

  @ApiPropertyOptional({ example: '버터 향 가득한 정통 크로와상, 냉동 보관 가능', description: '한 줄 요약' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ example: 'https://www.instagram.com/p/ABC123/', description: '원본 인스타그램 포스트 URL' })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o) => o.instagramUrl && o.instagramUrl.length > 0)
  instagramUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['https://img1.jpg', 'https://img2.jpg'], description: '이미지 URL 배열 (최대 5개)' })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(5)
  imageUrls?: string[];

  @ApiPropertyOptional({ example: '김공구', description: '제보자 닉네임 (익명 시 생략)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  reporterName?: string;

  @ApiPropertyOptional({ example: 'gonggu@email.com', description: '연락처 (이메일/카카오톡 ID)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reporterContact?: string;

  @ApiPropertyOptional({ example: true, description: '익명 제보 여부 (기본 true)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isAnonymous?: boolean = true;
}
