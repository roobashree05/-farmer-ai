import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'List users' })
  list() {
    return this.users.list();
  }

  @Get('assignees')
  @RequirePermissions('leads.assign')
  @ApiOperation({ summary: 'List active users who can receive leads' })
  assignees() {
    return this.users.assignees();
  }

  @Post()
  @RequirePermissions('users.write')
  @ApiOperation({ summary: 'Create a user' })
  create(@Body() body: CreateUserDto, @CurrentUser() actor: Actor) {
    return this.users.create(body, actor);
  }

  @Patch(':id')
  @RequirePermissions('users.write')
  @ApiOperation({ summary: 'Update a user, role, or active state' })
  update(@Param('id') id: string, @Body() body: UpdateUserDto, @CurrentUser() actor: Actor) {
    return this.users.update(id, body, actor);
  }
}
