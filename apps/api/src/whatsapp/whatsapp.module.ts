import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppEvents } from './whatsapp-events';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

@Module({
  controllers: [WhatsAppController, WhatsAppWebhookController],
  providers: [WhatsAppService, WhatsAppWebhookService, WhatsAppEvents],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
