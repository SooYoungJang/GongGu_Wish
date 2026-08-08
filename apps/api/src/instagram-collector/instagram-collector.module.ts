import { Module } from "@nestjs/common";

import { StrictCollectorAuthGuard } from "../collector/collector-auth.guard";
import { InfluencersModule } from "../influencers/influencers.module";
import { InstagramCollectorController } from "./instagram-collector.controller";

@Module({
  imports: [InfluencersModule],
  controllers: [InstagramCollectorController],
  providers: [StrictCollectorAuthGuard],
})
export class InstagramCollectorModule {}
