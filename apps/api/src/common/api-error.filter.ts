import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpResponse } from './http';
import { ApiError } from './api-error';

// A code for the statuses Nest raises on its own, so a 404 from an unmatched path has the
// same envelope as a 404 from a missing route. Anything else is internal_error.
const CODE_FOR_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'invalid_request',
  [HttpStatus.UNAUTHORIZED]: 'no_session',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.TOO_MANY_REQUESTS]: 'too_many_attempts',
};

/** All errors use the shape { "error": { "code": "...", "message": "..." } }. */
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();

    if (exception instanceof ApiError) {
      for (const [name, value] of Object.entries(exception.headers)) {
        response.setHeader(name, value);
      }
      response
        .status(exception.getStatus())
        .json({ error: { code: exception.code, message: exception.message } });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        error: {
          code: CODE_FOR_STATUS[status] ?? 'internal_error',
          message: exception.message,
        },
      });
      return;
    }

    // The message of an unexpected error can carry a connection string or a row of data,
    // so it is logged and never sent.
    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'internal_error', message: 'Something went wrong.' },
    });
  }
}
