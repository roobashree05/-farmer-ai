export const VOICE_STATES = [
  'GREETING',
  'IDENTIFY_CUSTOMER',
  'UNDERSTAND_REQUIREMENT',
  'ANSWER_QUESTION',
  'QUALIFY_LEAD',
  'BOOK_MEETING',
  'TRANSFER_TO_HUMAN',
  'END_CALL',
] as const;

export type VoiceState = (typeof VOICE_STATES)[number];

export interface VoiceContext {
  customerName: string;
  shopName?: string | null;
  utterance: string;
  faq?: { text: string; confident: boolean };
}

export interface VoiceTurn {
  state: VoiceState;
  speaker: 'bot' | 'customer';
  text: string;
}

export interface VoiceResult {
  turns: VoiceTurn[];
  finalState: 'END_CALL';
  outcome: 'MEETING_REQUESTED' | 'TRANSFERRED' | 'COMPLETED';
  escalateToHuman: boolean;
  requirement: string;
  interest: 'HIGH' | 'UNKNOWN';
}

type Step = { say: string; next: VoiceState; customerLine?: string };

const handlers: Record<Exclude<VoiceState, 'END_CALL'>, (ctx: VoiceContext) => Step> = {
  GREETING: (ctx) => ({
    say: `Hello ${ctx.customerName}, this is the AIJewel assistant. How can I help your jewellery business today?`,
    next: 'IDENTIFY_CUSTOMER',
  }),
  IDENTIFY_CUSTOMER: (ctx) => ({
    say: `Am I speaking with ${ctx.customerName}${ctx.shopName ? ` from ${ctx.shopName}` : ''}?`,
    customerLine: `Yes, this is ${ctx.customerName}.`,
    next: 'UNDERSTAND_REQUIREMENT',
  }),
  UNDERSTAND_REQUIREMENT: (ctx) => ({
    say: 'What would you like help with today?',
    customerLine: ctx.utterance,
    next: 'ANSWER_QUESTION',
  }),
  ANSWER_QUESTION: (ctx) => {
    if (!ctx.faq?.confident) {
      return {
        say: 'I am not confident I have the right answer. I will transfer you to an AIJewel specialist.',
        next: 'TRANSFER_TO_HUMAN',
      };
    }
    return { say: ctx.faq.text, next: 'QUALIFY_LEAD' };
  },
  QUALIFY_LEAD: () => ({
    say: 'Would you like our team to follow up with a personalised walkthrough?',
    customerLine: 'Yes, I am interested.',
    next: 'BOOK_MEETING',
  }),
  BOOK_MEETING: () => ({
    say: 'I can arrange a meeting with an AIJewel specialist. A coordinator will confirm a time with you.',
    customerLine: 'Please arrange a meeting.',
    next: 'END_CALL',
  }),
  TRANSFER_TO_HUMAN: () => ({
    say: 'Transferring you to a human specialist now. Thank you for calling AIJewel.',
    next: 'END_CALL',
  }),
};

export function runVoiceBot(ctx: VoiceContext): VoiceResult {
  let state: VoiceState = 'GREETING';
  const turns: VoiceTurn[] = [];
  let guard = 0;

  while (state !== 'END_CALL' && guard < 12) {
    guard += 1;
    const step = handlers[state](ctx);
    turns.push({ state, speaker: 'bot', text: step.say });
    if (step.customerLine) {
      turns.push({ state, speaker: 'customer', text: step.customerLine });
    }
    state = step.next;
  }

  const escalated = turns.some((turn) => turn.state === 'TRANSFER_TO_HUMAN');
  const meeting = turns.some((turn) => turn.state === 'BOOK_MEETING');

  return {
    turns,
    finalState: 'END_CALL',
    outcome: escalated ? 'TRANSFERRED' : meeting ? 'MEETING_REQUESTED' : 'COMPLETED',
    escalateToHuman: escalated,
    requirement: ctx.utterance,
    interest: meeting ? 'HIGH' : 'UNKNOWN',
  };
}
