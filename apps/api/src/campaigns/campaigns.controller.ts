import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { PageQueryDto } from '../common/page.dto';
import { CampaignsService } from './campaigns.service';

class CampaignQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  kind?: string;
}

class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['META', 'PERSONALIZED', 'WHATSAPP', 'SOCIAL'])
  kind!: 'META' | 'PERSONALIZED' | 'WHATSAPP' | 'SOCIAL';

  @IsString()
  platform!: string;

  @IsString()
  objective!: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  creative?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadIds?: string[];
}

class PreviewDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadIds?: string[];
}

class TransitionDto {
  @IsString()
  status!: string;
}

class TemplateDto {
  @IsString()
  name!: string;

  @IsString()
  channel!: string;

  @IsString()
  body!: string;
}

class SegmentDto {
  @IsString()
  name!: string;

  filterJson!: Prisma.InputJsonValue;
}

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller()
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get('campaigns')
  @RequirePermissions('campaigns.read')
  @ApiOperation({ summary: 'List campaigns' })
  list(@Query() query: CampaignQueryDto) {
    return this.campaigns.list(query);
  }

  @Post('campaigns')
  @RequirePermissions('campaigns.write')
  @ApiOperation({ summary: 'Create a draft campaign' })
  create(@Body() body: CreateCampaignDto, @CurrentUser() actor: Actor) {
    return this.campaigns.create(body, actor);
  }

  @Get('campaigns/:id')
  @RequirePermissions('campaigns.read')
  @ApiOperation({ summary: 'Get a campaign' })
  get(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Patch('campaigns/:id')
  @RequirePermissions('campaigns.write')
  @ApiOperation({ summary: 'Edit a draft campaign' })
  update(@Param('id') id: string, @Body() body: CreateCampaignDto, @CurrentUser() actor: Actor) {
    return this.campaigns.update(id, body as unknown as Record<string, unknown>, actor);
  }

  @Post('campaigns/:id/preview')
  @RequirePermissions('campaigns.read')
  @ApiOperation({ summary: 'Preview personalized messages' })
  preview(@Param('id') id: string, @Body() body: PreviewDto) {
    return this.campaigns.preview(id, body.leadIds);
  }

  @Post('campaigns/:id/transition')
  @ApiOperation({ summary: 'Move a campaign to the next workflow status' })
  transition(@Param('id') id: string, @Body() body: TransitionDto, @CurrentUser() actor: Actor) {
    if (['APPROVED', 'APPROVAL'].includes(body.status) && !actor.permissions.includes('campaigns.approve')) {
      throw new AppException('FORBIDDEN', 'You cannot approve campaigns', 403);
    }
    if (!actor.permissions.includes('campaigns.write') && !actor.permissions.includes('campaigns.approve')) {
      throw new AppException('FORBIDDEN', 'You cannot change campaigns', 403);
    }
    return this.campaigns.transition(id, body.status, actor);
  }

  @Post('campaigns/:id/execute')
  @RequirePermissions('campaigns.send')
  @ApiOperation({ summary: 'Execute a scheduled campaign with the mock provider' })
  execute(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.campaigns.execute(id, actor);
  }

  @Get('templates')
  @RequirePermissions('campaigns.read')
  @ApiOperation({ summary: 'List message templates' })
  templates() {
    return this.campaigns.templates();
  }

  @Post('templates')
  @RequirePermissions('campaigns.write')
  @ApiOperation({ summary: 'Create a message template' })
  createTemplate(@Body() body: TemplateDto) {
    return this.campaigns.createTemplate(body);
  }

  @Get('segments')
  @RequirePermissions('campaigns.read')
  @ApiOperation({ summary: 'List audience segments' })
  segments() {
    return this.campaigns.segments();
  }

  @Post('segments')
  @RequirePermissions('campaigns.write')
  @ApiOperation({ summary: 'Create an audience segment' })
  createSegment(@Body() body: SegmentDto) {
    return this.campaigns.createSegment(body);
  }
}
