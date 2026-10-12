import type { KnowledgeAnswer, KnowledgeSnippet } from '@aijewel/shared';
import type { AiProbeState } from './anthropic-config';

export interface AIProvider {
  readonly mode: 'mock' | 'anthropic';
  generateResponse(input: { message: string; documents: KnowledgeSnippet[] }): Promise<KnowledgeAnswer>;
  summarizeConversation(messages: { role: string; content: string }[]): Promise<string>;
  classifyLead(text: string): Promise<{ suggestedStatus: string; reason: string }>;
  connectionState(): AiProbeState | null;
  probeConnection(): Promise<AiProbeState>;
}
