import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { MeetingsService } from './meetings.service';

class AvailabilityQuery {
  @IsString()
  date!: string;

  @IsOptional()
  @IsString()
  hostUserId?: string;
}

class BookMeetingDto {
  @IsString()
  leadId!: string;

  @IsOptional()
  @IsString()
  hostUserId?: string;

  @IsString()
  date!: string;

  @IsString()
  time!: string;

  @Type(() => Number)
  @IsInt()
  durationMinutes!: number;

  @IsString()
  meetingType!: string;

  @IsString()
  @MinLength(1)
  attendeeName!: string;

  @IsString()
  attendeePhone!: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsEmail()
  attendeeEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class RescheduleDto {
  @IsString()
  date!: string;

  @IsString()
  time!: string;

  @Type(() => Number)
  @IsInt()
  durationMinutes!: number;
}

class CalendarQuery {
  @IsString()
  from!: string;

  @IsString()
  to!: string;
}

@ApiTags('meetings')
@ApiBearerAuth()
@Controller()
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get('calendar')
  @RequirePermissions('meetings.read')
  @ApiOperation({ summary: 'Marketing calendar items for a date range' })
  calendar(@Query() query: CalendarQuery) {
    return this.meetings.events(query.from, query.to);
  }

  @Get('meetings/availability')
  @RequirePermissions('meetings.read')
  @ApiOperation({ summary: 'Available and busy calendar slots' })
  availability(@Query() query: AvailabilityQuery) {
    return this.meetings.availability(query.date, query.hostUserId);
  }

  @Get('meetings')
  @RequirePermissions('meetings.read')
  @ApiOperation({ summary: 'List meetings' })
  list(@Query('status') status?: string, @Query('leadId') leadId?: string) {
    return this.meetings.list({ status, leadId });
  }

  @Post('meetings')
  @RequirePermissions('meetings.write')
  @ApiOperation({ summary: 'Book a meeting and link it to a lead' })
  book(@Body() body: BookMeetingDto, @CurrentUser() actor: Actor) {
    return this.meetings.book(body, actor);
  }

  @Post('meetings/:id/cancel')
  @RequirePermissions('meetings.write')
  @ApiOperation({ summary: 'Cancel a meeting' })
  cancel(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.meetings.cancel(id, actor);
  }

  @Post('meetings/:id/reschedule')
  @RequirePermissions('meetings.write')
  @ApiOperation({ summary: 'Reschedule a meeting' })
  reschedule(@Param('id') id: string, @Body() body: RescheduleDto, @CurrentUser() actor: Actor) {
    return this.meetings.reschedule(id, body, actor);
  }
}
