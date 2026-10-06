import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { RequirePermissions } from '../common/decorators';
import { ReportsService } from './reports.service';

class ReportQuery {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions('dashboard.read')
  @ApiOperation({ summary: 'Management dashboard counts' })
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('reports/campaigns')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Campaign performance report' })
  campaigns(@Query() query: ReportQuery) {
    return this.reports.campaigns(query);
  }

  @Get('reports/campaigns/export')
  @RequirePermissions('reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export campaign report as CSV' })
  async export(@Query() query: ReportQuery, @Res() response: Response) {
    const csv = await this.reports.campaignsCsv(query);
    response.setHeader('Content-Disposition', 'attachment; filename="campaign-report.csv"');
    response.send(csv);
  }

  @Get('reports/leads')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Lead counts by status and source' })
  leads() {
    return this.reports.leads();
  }
}
