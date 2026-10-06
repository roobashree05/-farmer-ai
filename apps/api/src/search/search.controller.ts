import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { RequirePermissions } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

function displayIdFromQuery(q: string): number | undefined {
  if (!/^\d+$/.test(q)) return undefined;
  const value = Number(q);
  if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) return undefined;
  return value;
}

class SearchQuery {
  @IsString()
  @MinLength(1)
  q!: string;
}

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('leads.read')
  @ApiOperation({ summary: 'Search leads, campaigns, and conversations' })
  async search(@Query() query: SearchQuery) {
    const q = query.q.trim();
    const displayId = displayIdFromQuery(q);
    const [leads, campaigns, conversations] = await Promise.all([
      this.prisma.lead.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q.replace(/\s+/g, '') } },
            { email: { contains: q, mode: 'insensitive' } },
            { shopName: { contains: q, mode: 'insensitive' } },
            ...(displayId ? [{ displayId }] : []),
          ],
        },
        take: 8,
        select: { id: true, displayId: true, name: true, phone: true, shopName: true },
      }),
      this.prisma.campaign.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: 5,
        select: { id: true, name: true, status: true, platform: true },
      }),
      this.prisma.whatsAppConversation.findMany({
        where: {
          OR: [
            { contactPhone: { contains: q } },
            { lead: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: 5,
        select: { id: true, contactPhone: true, lead: { select: { name: true } } },
      }),
    ]);
    return { leads, campaigns, conversations };
  }
}
