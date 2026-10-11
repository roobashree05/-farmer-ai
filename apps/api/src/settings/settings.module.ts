import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({ imports: [WhatsAppModule], controllers: [SettingsController] })
export class SettingsModule {}
