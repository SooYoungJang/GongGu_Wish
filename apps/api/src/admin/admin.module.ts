import { Module } from '@nestjs/common';

import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AuthModule } from '../auth/auth.module';
import { GroupBuysModule } from '../group-buys/group-buys.module';
import { InfluencersModule } from '../influencers/influencers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RawPostsModule } from '../raw-posts/raw-posts.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AuthModule,
    InfluencersModule,
    RawPostsModule,
    GroupBuysModule,
    PrismaModule,
    SubmissionsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRoleGuard],
})
export class AdminModule {}
