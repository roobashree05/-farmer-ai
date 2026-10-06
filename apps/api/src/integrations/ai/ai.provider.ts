import type { KnowledgeAnswer, KnowledgeSnippet } from '@aijewel/shared';

export interface AIProvider {
  generateResponse(input: { message: string; documents: KnowledgeSnippet[] }): Promise<KnowledgeAnswer>;
  summarizeConversation(messages: { role: string; content: string }[]): Promise<string>;
  classifyLead(text: string): Promise<{ suggestedStatus: string; reason: string }>;
}
