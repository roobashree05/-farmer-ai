import { randomUUID } from 'crypto';
import type { CampaignPerformance, MetaProvider } from './meta.provider';

export function mockCampaignMetrics(seed: string, leadCount: number): CampaignPerformance {
  let hash = 2166136261;
  for (const char of seed) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  hash >>>= 0;
  const impressions = 5000 + (hash % 40000);
  const reach = Math.floor(impressions * 0.72);
  const clicks = Math.floor(impressions * 0.035);
  const leads = Math.max(leadCount, 1 + (hash % 20));
  const spend = 1500 + (hash % 8000);
  return {
    spend,
    impressions,
    reach,
    clicks,
    leads,
    engagement: Math.floor(clicks * 1.4),
    conversions: Math.max(1, Math.floor(leads * 0.25)),
  };
}

export class MockMetaProvider implements MetaProvider {
  async createCampaign(_input: { name: string; objective: string; budget: number }) {
    return { externalId: `mock-meta-${randomUUID()}` };
  }

  async scheduleCampaign() {
    return { status: 'SCHEDULED' as const };
  }

  async getPerformance(externalId: string, leadCount: number) {
    return mockCampaignMetrics(externalId, leadCount);
  }
}
