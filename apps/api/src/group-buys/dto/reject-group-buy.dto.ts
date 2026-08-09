import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectGroupBuyDto {
  @ApiProperty({ description: '반려 사유. 예: 중복, 정보 부족, 공구 아님' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
