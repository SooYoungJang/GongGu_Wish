import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';

@Module({
  imports: [SupabaseModule],
  controllers: [RankingController],
  providers: [RankingService],
  exports: [RankingService],
})
export class RankingModule {}
