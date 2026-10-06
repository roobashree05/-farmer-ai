import { randomUUID } from 'crypto';
import { runVoiceBot, toneWav, type VoiceResult } from '@aijewel/shared';
import type { VoiceProvider } from './voice.provider';

export class MockVoiceProvider implements VoiceProvider {
  private readonly calls = new Map<string, VoiceResult>();

  async startCall(input: {
    customerName: string;
    shopName?: string | null;
    utterance: string;
    faq?: { text: string; confident: boolean };
  }) {
    const result = runVoiceBot(input);
    const providerCallId = `mock-call-${randomUUID()}`;
    this.calls.set(providerCallId, result);
    return { ...result, providerCallId };
  }

  async getCallStatus(providerCallId: string) {
    return this.calls.has(providerCallId) ? 'COMPLETED' : 'FAILED';
  }

  async endCall(providerCallId: string) {
    this.calls.get(providerCallId);
  }

  async getRecording() {
    return { contentType: 'audio/wav', body: toneWav(2, 523), durationSeconds: 2 };
  }

  async getTranscript(providerCallId: string) {
    const result = this.calls.get(providerCallId);
    if (!result) return '';
    return result.turns.map((turn) => `${turn.speaker.toUpperCase()} [${turn.state}]: ${turn.text}`).join('\n');
  }
}
