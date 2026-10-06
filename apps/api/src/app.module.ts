import { randomUUID } from 'crypto';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { AiModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { PermissionsGuard } from './common/permissions.guard';
import { requestContext } from './common/request-context';
import { CustomersModule } from './customers/customers.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LeadsModule } from './leads/leads.module';
import { MeetingsModule } from './meetings/meetings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')],
    }),
    PrismaModule,
    IntegrationsModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    LeadsModule,
    CustomersModule,
    WhatsAppModule,
    CampaignsModule,
    MeetingsModule,
    CallsModule,
    KnowledgeModule,
    AiModule,
    ReportsModule,
    SearchModule,
    SettingsModule,
    HealthModule,
    SchedulerModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((request: Request, response: Response, next: NextFunction) => {
        const requestId = request.header('x-request-id') || randomUUID();
        response.setHeader('x-request-id', requestId);
        requestContext.run({ requestId, ip: request.ip }, () => next());
      })
      .forRoutes('*');
  }
}
