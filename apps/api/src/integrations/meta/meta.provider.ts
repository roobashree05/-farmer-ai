export interface CampaignPerformance {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  engagement: number;
  conversions: number;
}

export interface MetaProvider {
  createCampaign(input: { name: string; objective: string; budget: number }): Promise<{ externalId: string }>;
  scheduleCampaign(externalId: string): Promise<{ status: 'SCHEDULED' }>;
  getPerformance(externalId: string, leadCount: number): Promise<CampaignPerformance>;
}
