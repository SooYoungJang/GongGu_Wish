import { Module } from "@nestjs/common";

import { CollectorAuthGuard } from "../collector/collector-auth.guard";
import { RawPostsController } from "./raw-posts.controller";
import { RawPostsService } from "./raw-posts.service";

@Module({
  controllers: [RawPostsController],
  providers: [RawPostsService, CollectorAuthGuard],
  exports: [RawPostsService],
})
export class RawPostsModule {}
