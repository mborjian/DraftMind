import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string'
        ? body
        : Array.isArray((body as { message?: unknown }).message)
          ? ((body as { message?: string[] }).message ?? []).join(', ')
          : ((body as { message?: string }).message ?? exception.message);
      const code = status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : exception.name.toUpperCase();

      response.status(status).json({
        success: false,
        error: {
          code,
          message,
        },
      });
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : undefined);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }
}
