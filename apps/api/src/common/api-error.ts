import { HttpException } from '@nestjs/common';

/**
 * Every error the API returns carries a stable code beside its message, because a client
 * branches on the code and shows the message. The headers are for the one error that
 * needs one: a rate limited login answers with Retry-After.
 */
export class ApiError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super({ code, message }, status);
  }
}
