import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { AppException } from './app.exception';
import { log } from './logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      let message = exception.message;
      if (typeof body === 'object' && body && 'message' in body) {
        const raw = (body as { message: string | string[] }).message;
        message = Array.isArray(raw) ? raw.join('; ') : raw;
      }
      const errorCode =
        status === HttpStatus.UNAUTHORIZED
          ? 'UNAUTHORIZED'
          : status === HttpStatus.FORBIDDEN
            ? 'FORBIDDEN'
            : status === HttpStatus.NOT_FOUND
              ? 'NOT_FOUND'
              : status === HttpStatus.BAD_REQUEST
                ? 'VALIDATION_ERROR'
                : 'REQUEST_FAILED';
      response.status(status).json({ success: false, errorCode, message });
      return;
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      response.status(409).json({
        success: false,
        errorCode: 'DUPLICATE_RECORD',
        message: 'A record with the same unique value already exists',
      });
      return;
    }
    log('error', 'Unhandled exception', {
      error: exception instanceof Error ? exception.message : 'Unknown error',
      stack: exception instanceof Error ? exception.stack : undefined,
    });
    response.status(500).json({
      success: false,
      errorCode: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}
