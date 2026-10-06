export const DEFAULT_LEAD_STATUSES = [
  { code: 'NEW', name: 'New', sortOrder: 1 },
  { code: 'CONTACTED', name: 'Contacted', sortOrder: 2 },
  { code: 'QUALIFIED', name: 'Qualified', sortOrder: 3 },
  { code: 'MEETING_SCHEDULED', name: 'Meeting scheduled', sortOrder: 4 },
  { code: 'FOLLOW_UP', name: 'Follow up', sortOrder: 5 },
  { code: 'CONVERTED', name: 'Converted', sortOrder: 6 },
  { code: 'LOST', name: 'Lost', sortOrder: 7 },
] as const;

export const DEFAULT_LEAD_SOURCES = [
  { code: 'MANUAL', name: 'Manual' },
  { code: 'CSV_IMPORT', name: 'CSV import' },
  { code: 'WHATSAPP_GROUP', name: 'WhatsApp group' },
  { code: 'META_CAMPAIGN', name: 'Meta campaign' },
  { code: 'WEBSITE', name: 'Website' },
  { code: 'REFERRAL', name: 'Referral' },
  { code: 'VOICE_BOT', name: 'Voice bot' },
] as const;

export const KNOWLEDGE_CATEGORIES = [
  'COMPANY',
  'PRODUCT',
  'PRICING',
  'FAQ',
  'SUPPORT',
  'WARRANTY',
  'DEMO',
  'SALES',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
