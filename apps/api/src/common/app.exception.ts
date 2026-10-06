import { HttpException } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(errorCode: string, message: string, status = 400) {
    super({ success: false, errorCode, message }, status);
  }
}
