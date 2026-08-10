import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdatePlaywrightCollectionDto {
  @ApiProperty({
    description: "약관 검토 및 권한 확인 후 계정별로 활성화합니다.",
  })
  @IsBoolean()
  playwrightCollectionEnabled!: boolean;
}
