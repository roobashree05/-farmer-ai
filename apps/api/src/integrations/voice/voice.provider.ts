import type { VoiceResult } from '@aijewel/shared';

export interface VoiceProvider {
  startCall(input: {
    customerName: string;
    shopName?: string | null;
    utterance: string;
    faq?: { text: string; confident: boolean };
  }): Promise<VoiceResult & { providerCallId: string }>;
  getCallStatus(providerCallId: string): Promise<'COMPLETED' | 'FAILED'>;
  endCall(providerCallId: string): Promise<void>;
  getRecording(providerCallId: string): Promise<{ contentType: string; body: Buffer; durationSeconds: number }>;
  getTranscript(providerCallId: string): Promise<string>;
}
