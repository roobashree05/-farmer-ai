import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignsService } from '../campaigns/campaigns.service';
import { log } from '../common/logger';
import { LeadsService } from '../leads/leads.service';
import { MeetingsService } from '../meetings/meetings.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly campaigns: CampaignsService,
    private readonly meetings: MeetingsService,
    private readonly leads: LeadsService,
  ) {}

  onModuleInit() {
    if (this.config.get('SCHEDULER_ENABLED', 'true') !== 'true') return;
    this.timer = setInterval(() => void this.tick(), 15_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.campaigns.executeDue();
      await this.meetings.sendReminders();
      await this.leads.notifyDueFollowUps();
    } catch (error) {
      log('error', 'Scheduler tick failed', { error: error instanceof Error ? error.message : 'unknown' });
    } finally {
      this.running = false;
    }
  }
}
