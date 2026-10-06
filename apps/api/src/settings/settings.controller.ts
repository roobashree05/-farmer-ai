import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class StatusDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  sortOrder!: number;
}

class StatusPatchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Show active providers and demo mode' })
  get() {
    return {
      demoMode: this.config.get('DEMO_MODE', 'false') === 'true',
      providers: {
        whatsapp: this.config.get('WHATSAPP_PROVIDER', 'mock'),
        meta: this.config.get('META_PROVIDER', 'mock'),
        ai: this.config.get('AI_PROVIDER', 'mock'),
        voice: this.config.get('VOICE_PROVIDER', 'mock'),
        calendar: this.config.get('CALENDAR_PROVIDER', 'mock'),
        storage: this.config.get('STORAGE_PROVIDER', 'local'),
      },
    };
  }

  @Get('lead-statuses')
  @RequirePermissions('leads.read')
  @ApiOperation({ summary: 'List configurable lead statuses' })
  statuses() {
    return this.prisma.leadStatusDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @Post('lead-statuses')
  @RequirePermissions('settings.write')
  @ApiOperation({ summary: 'Add a lead status' })
  async createStatus(@Body() body: StatusDto, @CurrentUser() actor: Actor) {
    const created = await this.prisma.leadStatusDefinition.create({
      data: { code: body.code.trim().toUpperCase(), name: body.name.trim(), sortOrder: body.sortOrder },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'SETTINGS_UPDATED',
      entity: 'LeadStatus',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  @Patch('lead-statuses/:id')
  @RequirePermissions('settings.write')
  @ApiOperation({ summary: 'Update a lead status' })
  async updateStatus(@Param('id') id: string, @Body() body: StatusPatchDto, @CurrentUser() actor: Actor) {
    const existing = await this.prisma.leadStatusDefinition.findUnique({ where: { id } });
    if (!existing) throw new AppException('NOT_FOUND', 'Lead status was not found', 404);
    const updated = await this.prisma.leadStatusDefinition.update({ where: { id }, data: body });
    await this.audit.record({
      userId: actor.id,
      action: 'SETTINGS_UPDATED',
      entity: 'LeadStatus',
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  @Get('lead-sources')
  @RequirePermissions('leads.read')
  @ApiOperation({ summary: 'List lead sources' })
  sources() {
    return this.prisma.leadSource.findMany({ orderBy: { name: 'asc' } });
  }
}
