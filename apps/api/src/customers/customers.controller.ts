import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { AppException } from '../common/app.exception';
import { pageArgs } from '../common/page.dto';
import { LeadQueryDto } from '../leads/leads.dto';
import { LeadWorkspaceService } from '../leads/lead-workspace.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: LeadWorkspaceService,
  ) {}

  @Get()
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Page customers' })
  async list(@Query() query: LeadQueryDto) {
    const { page, pageSize, skip, take } = pageArgs(query);
    const q = query.q?.trim();
    const where = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { shopName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      location: query.location ? { contains: query.location, mode: 'insensitive' as const } : undefined,
      category: query.category || undefined,
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    ]);
    return { items, page, pageSize, total };
  }

  @Get(':id/workspace')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Customer 360 view' })
  workspaceByCustomer(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.workspace.byCustomerId(id, actor);
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Get a customer' })
  async get(@Param('id') id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, include: { company: true } });
    if (!customer) throw new AppException('CUSTOMER_NOT_FOUND', 'Customer was not found', 404);
    return customer;
  }
}
