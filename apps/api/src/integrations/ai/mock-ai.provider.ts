import { answerFromKnowledge, classifyLeadInterest, summarizeConversation } from '@aijewel/shared';
import type { AIProvider } from './ai.provider';

export class MockAIProvider implements AIProvider {
  async generateResponse(input: { message: string; documents: Parameters<typeof answerFromKnowledge>[1] }) {
    return answerFromKnowledge(input.message, input.documents);
  }

  async summarizeConversation(messages: { role: string; content: string }[]) {
    return summarizeConversation(messages);
  }

  async classifyLead(text: string) {
    return classifyLeadInterest(text);
  }
}
