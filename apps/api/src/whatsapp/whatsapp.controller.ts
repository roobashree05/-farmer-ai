import { Body, Controller, Get, Headers, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Observable } from 'rxjs';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { PageQueryDto } from '../common/page.dto';
import { WhatsAppEvents } from './whatsapp-events';
import { WhatsAppService } from './whatsapp.service';

class OpenConversationDto {
  @IsString()
  leadId!: string;
}

class SendMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  templateName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  templateLanguage?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly events: WhatsAppEvents,
  ) {}

  @Sse('stream')
  @RequirePermissions('whatsapp.read')
  @ApiOperation({ summary: 'Stream WhatsApp message and status updates' })
  stream(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const unsubscribe = this.events.subscribe((event) => subscriber.next({ data: event }));
      subscriber.next({ data: { type: 'ready' } });
      const timer = setInterval(() => subscriber.next({ data: { type: 'ping' } }), 25_000);
      return () => {
        clearInterval(timer);
        unsubscribe();
      };
    });
  }

  @Get('conversations')
  @RequirePermissions('whatsapp.read')
  @ApiOperation({ summary: 'Search WhatsApp conversations' })
  list(@Query() query: PageQueryDto) {
    return this.whatsapp.listConversations(query);
  }

  @Post('conversations')
  @RequirePermissions('whatsapp.read')
  @ApiOperation({ summary: 'Open or create a conversation for a lead' })
  open(@Body() body: OpenConversationDto, @CurrentUser() actor: Actor) {
    return this.whatsapp.openConversation(body.leadId, actor);
  }

  @Get('conversations/:id')
  @RequirePermissions('whatsapp.read')
  @ApiOperation({ summary: 'Get a conversation and its messages' })
  get(@Param('id') id: string) {
    return this.whatsapp.getConversation(id);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('whatsapp.send')
  @ApiOperation({ summary: 'Send a WhatsApp text message or approved template' })
  send(
    @Param('id') id: string,
    @Body() body: SendMessageDto,
    @CurrentUser() actor: Actor,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.whatsapp.sendMessage(
      id,
      { ...body, idempotencyKey: idempotencyKey?.trim() || body.idempotencyKey },
      actor,
    );
  }
}
