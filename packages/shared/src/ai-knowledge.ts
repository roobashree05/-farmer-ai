export interface KnowledgeSnippet {
  title: string;
  content: string;
  category: string;
  isActive?: boolean;
}

export interface KnowledgeAnswer {
  text: string;
  confidence: number;
  escalateToHuman: boolean;
  sources: { title: string; category: string }[];
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'of', 'for', 'to', 'and', 'on', 'in', 'what',
  'how', 'do', 'you', 'your', 'please', 'me', 'i', 'we', 'with', 'our', 'can',
  'about', 'does', 'it', 'this', 'that', 'be', 'or',
]);

const PRICE_WORDS = new Set(['price', 'pricing', 'cost', 'costs', 'rate', 'fees', 'fee', 'priced']);

export function knowledgeTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreDocument(questionTokens: string[], doc: KnowledgeSnippet): number {
  const haystack = new Set(knowledgeTokens(`${doc.title} ${doc.content} ${doc.category}`));
  if (questionTokens.length === 0) return 0;
  const overlap = questionTokens.filter((token) => haystack.has(token)).length;
  return overlap / questionTokens.length;
}

export function answerFromKnowledge(question: string, docs: KnowledgeSnippet[]): KnowledgeAnswer {
  const questionTokens = knowledgeTokens(question);
  const active = docs.filter((doc) => doc.isActive !== false);
  const ranked = active
    .map((doc) => ({ doc, score: scoreDocument(questionTokens, doc) }))
    .sort((a, b) => b.score - a.score);

  const asksPrice = questionTokens.some((token) => PRICE_WORDS.has(token));
  const candidates = asksPrice
    ? ranked.filter((entry) => /\d/.test(entry.doc.content))
    : ranked;
  const best = candidates[0];

  if (!best || best.score < 0.34) {
    return {
      text: "I don't have that information in the AIJewel knowledge base. A specialist will follow up.",
      confidence: best?.score ?? 0,
      escalateToHuman: true,
      sources: [],
    };
  }

  return {
    text: `Based on the AIJewel knowledge base (${best.doc.title}): ${best.doc.content}`,
    confidence: Number(best.score.toFixed(2)),
    escalateToHuman: false,
    sources: [{ title: best.doc.title, category: best.doc.category }],
  };
}

export function summarizeConversation(messages: { role: string; content: string }[]): string {
  if (messages.length === 0) return 'No conversation to summarize.';
  const lines = messages.slice(-6).map((message) => `${message.role}: ${message.content}`);
  return `Summary of the latest exchange: ${lines.join(' | ')}`;
}

export function classifyLeadInterest(text: string): {
  suggestedStatus: 'NEW' | 'QUALIFIED' | 'FOLLOW_UP' | 'LOST';
  reason: string;
} {
  const normalized = text.toLowerCase();
  if (/(not interested|stop|unsubscribe|no budget)/.test(normalized)) {
    return { suggestedStatus: 'LOST', reason: 'Customer declined' };
  }
  if (/(meeting|demo|quote|buy|interested|pricing)/.test(normalized)) {
    return { suggestedStatus: 'QUALIFIED', reason: 'Customer showed buying interest' };
  }
  if (/(later|call back|follow up|next week)/.test(normalized)) {
    return { suggestedStatus: 'FOLLOW_UP', reason: 'Customer asked for a follow-up' };
  }
  return { suggestedStatus: 'NEW', reason: 'Not enough signal to change status' };
}
