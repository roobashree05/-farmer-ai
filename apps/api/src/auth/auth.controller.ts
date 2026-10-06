import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/decorators';
import { LoginDto, RefreshDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() body: LoginDto, @Req() request: Request) {
    return this.auth.login(body.email, body.password, request.ip);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token' })
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() body: RefreshDto, @CurrentUser() actor: Actor) {
    return this.auth.logout(body.refreshToken, actor);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the signed-in user and permissions' })
  me(@CurrentUser() actor: Actor) {
    return this.auth.me(actor);
  }
}
