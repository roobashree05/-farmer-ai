import { answerFromKnowledge, classifyLeadInterest, summarizeConversation } from '@aijewel/shared';
import type { AiProbeState } from './anthropic-config';
import type { AIProvider } from './ai.provider';

export class MockAIProvider implements AIProvider {
  readonly mode = 'mock' as const;

  async generateResponse(input: { message: string; documents: Parameters<typeof answerFromKnowledge>[1] }) {
    return answerFromKnowledge(input.message, input.documents);
  }

  async summarizeConversation(messages: { role: string; content: string }[]) {
    return summarizeConversation(messages);
  }

  async classifyLead(text: string) {
    return classifyLeadInterest(text);
  }

  connectionState(): AiProbeState | null {
    return null;
  }

  async probeConnection(): Promise<AiProbeState> {
    return {
      connection: 'not_applicable',
      detail: 'Mock provider is active. Answers stay in the CRM and are not sent to Anthropic.',
      checkedAt: null,
      model: null,
    };
  }
}
