import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  live() {
    return {
      status: 'ok',
      demoMode: this.config.get('DEMO_MODE', 'false') === 'true',
      service: 'aijewel-api',
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check including the database' })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
}
