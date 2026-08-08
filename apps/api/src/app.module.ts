import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { CrawlingModule } from "./crawling/crawling.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { FeedPostsModule } from "./feed-posts/feed-posts.module";
import { GroupBuysModule } from "./group-buys/group-buys.module";
import { InfluencersModule } from "./influencers/influencers.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RankingModule } from "./ranking/ranking.module";
import { RawPostsModule } from "./raw-posts/raw-posts.module";
import { SearchModule } from "./search/search.module";
import { SubmissionsModule } from "./submissions/submissions.module";
import { UsersModule } from "./users/users.module";
import { HikerApiModule } from "./hiker-api/hiker-api.module";
import { InstagramCollectorModule } from "./instagram-collector/instagram-collector.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url:
            configService.get<string>("REDIS_URL") ?? "redis://localhost:6379",
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    CrawlingModule,
    InfluencersModule,
    RawPostsModule,
    FeedPostsModule,
    GroupBuysModule,
    FavoritesModule,
    SearchModule,
    AdminModule,
    UsersModule,
    NotificationsModule,
    RankingModule,
    SubmissionsModule,
    HikerApiModule,
    InstagramCollectorModule,
  ],
})
export class AppModule {}
