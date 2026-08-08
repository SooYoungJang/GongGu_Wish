import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { StrictCollectorAuthGuard } from "../collector/collector-auth.guard";
import { InfluencersService } from "../influencers/influencers.service";
import { UpdateCollectorStatusDto } from "./dto/update-collector-status.dto";

@ApiTags("instagram-collector")
@Controller("internal/instagram")
@UseGuards(StrictCollectorAuthGuard)
export class InstagramCollectorController {
  constructor(private readonly influencersService: InfluencersService) {}

  @Get("watchlist")
  async watchlist() {
    return {
      items: await this.influencersService.listPlaywrightWatchlist(),
      generatedAt: new Date().toISOString(),
    };
  }

  @Patch("influencers/:id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateCollectorStatusDto) {
    return this.influencersService.updatePlaywrightStatus(id, {
      status: dto.status,
      attemptAt: new Date(dto.attemptAt),
      nextRunAt: new Date(dto.nextRunAt),
      errorCode: dto.errorCode,
      errorMessage: dto.errorMessage,
    });
  }
}
