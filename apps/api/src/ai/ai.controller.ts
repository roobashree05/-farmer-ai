import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { AiService } from './ai.service';

class ReplyDto {
  @IsString()
  leadId!: string;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  channel?: string;
}

class SummarizeDto {
  @IsString()
  leadId!: string;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('reply')
  @RequirePermissions('knowledge.read')
  @ApiOperation({ summary: 'Answer a customer message from the knowledge base' })
  reply(@Body() body: ReplyDto, @CurrentUser() actor: Actor) {
    return this.ai.reply(body, actor);
  }

  @Post('summarize')
  @RequirePermissions('knowledge.read')
  @ApiOperation({ summary: 'Summarize an AI conversation' })
  summarize(@Body() body: SummarizeDto) {
    return this.ai.summarize(body.leadId);
  }
}
