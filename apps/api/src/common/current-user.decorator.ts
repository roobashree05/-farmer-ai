import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Actor } from './actor';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  return ctx.switchToHttp().getRequest<{ user: Actor }>().user;
});
