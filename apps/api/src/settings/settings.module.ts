import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SettingsController } from './settings.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({ imports: [WhatsAppModule, AiModule], controllers: [SettingsController] })
export class SettingsModule {}
