import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { PageQueryDto } from '../common/page.dto';
import { WhatsAppService } from './whatsapp.service';

class OpenConversationDto {
  @IsString()
  leadId!: string;
}

class SendMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

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
  @ApiOperation({ summary: 'Send a mock WhatsApp message and receive a simulated reply' })
  send(@Param('id') id: string, @Body() body: SendMessageDto, @CurrentUser() actor: Actor) {
    return this.whatsapp.sendMessage(id, body.body, actor);
  }
}
