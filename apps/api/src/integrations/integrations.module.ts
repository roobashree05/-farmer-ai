import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/app.exception';
import { MockAIProvider } from './ai/mock-ai.provider';
import { MockCalendarProvider } from './calendar/mock-calendar.provider';
import { MockMetaProvider } from './meta/mock-meta.provider';
import { LocalFileStorageProvider } from './storage/local-file-storage.provider';
import {
  AI_PROVIDER,
  CALENDAR_PROVIDER,
  FILE_STORAGE,
  META_PROVIDER,
  VOICE_PROVIDER,
  WHATSAPP_PROVIDER,
} from './tokens';
import { MockVoiceProvider } from './voice/mock-voice.provider';
import { MockWhatsAppProvider } from './whatsapp/mock-whatsapp.provider';

function mockOnly(name: string, selected: string, factory: () => unknown) {
  if (selected === 'mock' || selected === 'local') return factory();
  throw new AppException(
    'PROVIDER_NOT_CONFIGURED',
    `${name} provider "${selected}" is not available in local mode. Set it to mock.`,
    500,
  );
}

@Global()
@Module({
  providers: [
    LocalFileStorageProvider,
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mockOnly('WhatsApp', config.get('WHATSAPP_PROVIDER', 'mock'), () => new MockWhatsAppProvider()),
    },
    {
      provide: META_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mockOnly('Meta', config.get('META_PROVIDER', 'mock'), () => new MockMetaProvider()),
    },
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mockOnly('AI', config.get('AI_PROVIDER', 'mock'), () => new MockAIProvider()),
    },
    {
      provide: VOICE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mockOnly('Voice', config.get('VOICE_PROVIDER', 'mock'), () => new MockVoiceProvider()),
    },
    {
      provide: CALENDAR_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mockOnly('Calendar', config.get('CALENDAR_PROVIDER', 'mock'), () => new MockCalendarProvider()),
    },
    {
      provide: FILE_STORAGE,
      inject: [ConfigService, LocalFileStorageProvider],
      useFactory: (config: ConfigService, local: LocalFileStorageProvider) => {
        const selected = config.get('STORAGE_PROVIDER', 'local');
        if (selected === 'local') return local;
        throw new AppException(
          'PROVIDER_NOT_CONFIGURED',
          `Storage provider "${selected}" is not configured. Use local for laptop development.`,
          500,
        );
      },
    },
  ],
  exports: [WHATSAPP_PROVIDER, META_PROVIDER, AI_PROVIDER, VOICE_PROVIDER, CALENDAR_PROVIDER, FILE_STORAGE],
})
export class IntegrationsModule {}
