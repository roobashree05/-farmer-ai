export type CampaignKind = 'META' | 'PERSONALIZED' | 'WHATSAPP' | 'SOCIAL';

const PERSONALIZED: Record<string, string[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['SCHEDULED'],
  SCHEDULED: ['SENT'],
  SENT: ['REPORT'],
  REPORT: [],
};

const BROADCAST: Record<string, string[]> = {
  DRAFT: ['APPROVAL'],
  APPROVAL: ['SCHEDULED', 'DRAFT'],
  SCHEDULED: ['RUNNING'],
  RUNNING: ['PAUSED', 'COMPLETED', 'FAILED'],
  PAUSED: ['RUNNING', 'COMPLETED'],
  COMPLETED: [],
  FAILED: [],
};

export function transitionsFor(kind: CampaignKind): Record<string, string[]> {
  return kind === 'PERSONALIZED' ? PERSONALIZED : BROADCAST;
}

export function canTransition(kind: CampaignKind, from: string, to: string): boolean {
  return (transitionsFor(kind)[from] ?? []).includes(to);
}

export function assertCampaignTransition(kind: CampaignKind, from: string, to: string): void {
  if (!canTransition(kind, from, to)) {
    throw new Error(`Cannot move a ${kind} campaign from ${from} to ${to}`);
  }
}
