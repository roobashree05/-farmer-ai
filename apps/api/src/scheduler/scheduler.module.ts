import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { LeadsModule } from '../leads/leads.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [CampaignsModule, LeadsModule, MeetingsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
