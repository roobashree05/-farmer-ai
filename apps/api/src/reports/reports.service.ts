import { Injectable } from '@nestjs/common';
import { money } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async campaigns(query: { from?: string; to?: string; campaignId?: string }) {
    const where = {
      campaignId: query.campaignId || undefined,
      date: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
    };
    const metrics = await this.prisma.campaignMetric.findMany({
      where,
      include: { campaign: { select: { id: true, name: true, platform: true, status: true } } },
      orderBy: { date: 'asc' },
    });
    const totals = metrics.reduce(
      (sum, metric) => {
        sum.spend += money(metric.spend);
        sum.impressions += metric.impressions;
        sum.reach += metric.reach;
        sum.clicks += metric.clicks;
        sum.leads += metric.leads;
        sum.engagement += metric.engagement;
        sum.conversions += metric.conversions;
        return sum;
      },
      { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, engagement: 0, conversions: 0 },
    );
    return {
      totals: {
        ...totals,
        ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
        costPerLead: totals.leads ? totals.spend / totals.leads : 0,
      },
      rows: metrics.map((metric) => ({
        campaignId: metric.campaignId,
        campaign: metric.campaign.name,
        platform: metric.campaign.platform,
        status: metric.campaign.status,
        date: metric.date.toISOString().slice(0, 10),
        spend: money(metric.spend),
        impressions: metric.impressions,
        reach: metric.reach,
        clicks: metric.clicks,
        ctr: metric.impressions ? metric.clicks / metric.impressions : 0,
        leads: metric.leads,
        costPerLead: metric.leads ? money(metric.spend) / metric.leads : 0,
        engagement: metric.engagement,
        conversions: metric.conversions,
      })),
    };
  }

  async campaignsCsv(query: { from?: string; to?: string; campaignId?: string }) {
    const report = await this.campaigns(query);
    const header = ['campaign', 'platform', 'date', 'spend', 'impressions', 'reach', 'clicks', 'ctr', 'leads', 'costPerLead', 'engagement', 'conversions'];
    const lines = [header.join(',')];
    for (const row of report.rows) {
      lines.push(
        [row.campaign, row.platform, row.date, row.spend, row.impressions, row.reach, row.clicks, row.ctr.toFixed(4), row.leads, row.costPerLead.toFixed(2), row.engagement, row.conversions].join(','),
      );
    }
    return lines.join('\n');
  }

  async leads() {
    const grouped = await this.prisma.lead.groupBy({
      by: ['statusId', 'leadSourceId'],
      where: { deletedAt: null },
      _count: true,
    });
    const [statuses, sources] = await Promise.all([
      this.prisma.leadStatusDefinition.findMany(),
      this.prisma.leadSource.findMany(),
    ]);
    return grouped.map((row) => ({
      status: statuses.find((status) => status.id === row.statusId)?.code ?? row.statusId,
      source: sources.find((source) => source.id === row.leadSourceId)?.code ?? row.leadSourceId,
      count: row._count,
    }));
  }

  async dashboard() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [statuses, statusCounts, totalLeads, messages, outbound, readOutbound, activeChats, campaigns, scheduled, metricSums, meetings, calls, outcomes, activity] =
      await Promise.all([
        this.prisma.leadStatusDefinition.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.prisma.lead.groupBy({ by: ['statusId'], where: { deletedAt: null }, _count: true }),
        this.prisma.lead.count({ where: { deletedAt: null } }),
        this.prisma.whatsAppMessage.count(),
        this.prisma.whatsAppMessage.count({ where: { direction: 'OUTBOUND' } }),
        this.prisma.whatsAppMessage.count({ where: { direction: 'OUTBOUND', status: 'READ' } }),
        this.prisma.whatsAppConversation.count({ where: { lastMessageAt: { gte: weekAgo } } }),
        this.prisma.campaign.count(),
        this.prisma.campaign.count({ where: { status: 'SCHEDULED' } }),
        this.prisma.campaignMetric.aggregate({
          _sum: { spend: true, leads: true },
        }),
        this.prisma.meeting.groupBy({ by: ['status'], _count: true }),
        this.prisma.call.groupBy({ by: ['callType', 'status'], _count: true }),
        this.prisma.call.groupBy({ by: ['outcome'], where: { outcome: { not: null } }, _count: true }),
        this.prisma.leadActivity.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { lead: { select: { name: true } } },
        }),
      ]);
    const inbound = await this.prisma.whatsAppMessage.count({ where: { direction: 'INBOUND' } });
    const spend = money(metricSums._sum.spend);
    const generated = metricSums._sum.leads ?? 0;
    const meetingCount = (status: string) => meetings.find((row) => row.status === status)?._count ?? 0;
    const callCount = (predicate: (row: { callType: string; status: string; _count: number }) => boolean) =>
      calls.filter(predicate).reduce((sum, row) => sum + row._count, 0);
    return {
      leads: {
        total: totalLeads,
        byStatus: statuses.map((status) => ({
          code: status.code,
          name: status.name,
          count: statusCounts.find((row) => row.statusId === status.id)?._count ?? 0,
        })),
      },
      whatsapp: {
        activeChats,
        messages,
        responses: inbound,
        readRate: outbound ? readOutbound / outbound : 0,
      },
      marketing: {
        campaigns,
        scheduled,
        leadsGenerated: generated,
        costPerLead: generated ? spend / generated : 0,
      },
      meetings: {
        upcoming: meetingCount('SCHEDULED'),
        completed: meetingCount('COMPLETED'),
        cancelled: meetingCount('CANCELLED'),
      },
      calls: {
        manual: callCount((row) => row.callType === 'MANUAL'),
        automated: callCount((row) => row.callType === 'VOICE_BOT'),
        answered: callCount((row) => row.status === 'ANSWERED' || row.status === 'COMPLETED'),
        missed: callCount((row) => row.status === 'MISSED'),
        outcomes: outcomes.map((row) => ({ outcome: row.outcome ?? 'UNKNOWN', count: row._count })),
      },
      recentActivity: activity.map((item) => ({
        id: item.id,
        type: item.type,
        summary: item.summary,
        createdAt: item.createdAt.toISOString(),
        leadName: item.lead.name,
      })),
    };
  }
}
