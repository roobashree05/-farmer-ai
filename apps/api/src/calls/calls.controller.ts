import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { CallsService } from './calls.service';

class ManualCallDto {
  @IsString()
  leadId!: string;

  @IsOptional()
  @IsString()
  startedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  durationSeconds?: number;

  @IsOptional()
  @IsIn(['COMPLETED', 'MISSED', 'ANSWERED', 'FAILED'])
  status?: 'COMPLETED' | 'MISSED' | 'ANSWERED' | 'FAILED';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsString()
  followUpAt?: string;
}

class VoiceCallDto {
  @IsString()
  leadId!: string;

  @IsOptional()
  @IsString()
  utterance?: string;
}

@ApiTags('calls')
@ApiBearerAuth()
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get()
  @RequirePermissions('calls.read')
  @ApiOperation({ summary: 'List calls' })
  list(@Query('status') status?: string, @Query('callType') callType?: string, @Query('leadId') leadId?: string) {
    return this.calls.list({ status, callType, leadId });
  }

  @Post('voice')
  @RequirePermissions('calls.write')
  @ApiOperation({ summary: 'Start a mock voice-bot call' })
  voice(@Body() body: VoiceCallDto, @CurrentUser() actor: Actor) {
    return this.calls.startVoice(body.leadId, body.utterance, actor);
  }

  @Post()
  @RequirePermissions('calls.write')
  @ApiOperation({ summary: 'Log a manual call' })
  create(@Body() body: ManualCallDto, @CurrentUser() actor: Actor) {
    return this.calls.createManual(body, actor);
  }

  @Post(':id/recording')
  @RequirePermissions('calls.write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload a call recording' })
  upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() actor: Actor) {
    if (!file) throw new AppException('VALIDATION_ERROR', 'Recording file is required', 400);
    return this.calls.addRecording(id, file, actor);
  }

  @Get(':id/recording')
  @RequirePermissions('recordings.read')
  @ApiOperation({ summary: 'Stream a call recording' })
  recording(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.calls.streamRecording(id, actor);
  }
}
