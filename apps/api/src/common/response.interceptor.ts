import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import type { Actor } from './actor';
import { log } from './logger';
import { requestContext } from './request-context';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method: string; originalUrl: string; user?: Actor }>();
    const response = http.getResponse<Response>();
    const started = Date.now();
    const store = requestContext.getStore();
    if (store && request.user) store.userId = request.user.id;

    return next.handle().pipe(
      map((data) => {
        const path = request.originalUrl.split('?')[0];
        log('info', 'request', {
          method: request.method,
          path,
          statusCode: response.statusCode,
          durationMs: Date.now() - started,
        });
        if (
          response.headersSent ||
          data instanceof StreamableFile ||
          path.endsWith('/whatsapp/stream') ||
          (request.method === 'GET' && path.endsWith('/webhooks/whatsapp'))
        ) {
          return data;
        }
        return { success: true, data };
      }),
    );
  }
}
