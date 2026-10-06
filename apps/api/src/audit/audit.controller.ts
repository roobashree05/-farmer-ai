import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { RequirePermissions } from '../common/decorators';
import { PageQueryDto } from '../common/page.dto';
import { AuditService } from './audit.service';

class AuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entity?: string;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'List audit logs' })
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
