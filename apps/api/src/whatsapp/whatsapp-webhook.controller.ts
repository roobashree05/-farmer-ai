import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

@ApiExcludeController()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly webhooks: WhatsAppWebhookService) {}

  @Get()
  @Public()
  verify(@Req() request: Request, @Res() response: Response) {
    const challenge = this.webhooks.verifySubscription(request.query as Record<string, unknown>);
    response.status(200).type('text/plain; charset=utf-8').send(challenge);
  }

  @Post()
  @Public()
  @HttpCode(200)
  receive(@Req() request: RawBodyRequest<Request>) {
    return this.webhooks.receive(request.rawBody, request.header('x-hub-signature-256'));
  }
}
