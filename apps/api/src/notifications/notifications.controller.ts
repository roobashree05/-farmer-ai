import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { PageQueryDto } from '../common/page.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'List notifications for the signed-in user' })
  list(@CurrentUser() actor: Actor, @Query() query: PageQueryDto) {
    return this.notifications.list(actor.id, query);
  }

  @Post('read-all')
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'Mark every notification as read' })
  readAll(@CurrentUser() actor: Actor) {
    return this.notifications.markAllRead(actor.id);
  }

  @Post(':id/read')
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  readOne(@CurrentUser() actor: Actor, @Param('id') id: string) {
    return this.notifications.markRead(actor.id, id);
  }
}
