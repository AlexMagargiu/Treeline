import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../common/api-error';
import { HttpRequest } from '../common/http';
import { config } from '../common/config';
import { AuthService } from './auth.service';
import { IS_PUBLIC } from './public.decorator';
import { sessionIdOf } from './session-cookie';

/**
 * Applied globally, so a new controller is behind the password by default and a public
 * one says so. Forgetting a guard is how a catalogue leaks; forgetting @Public() only
 * breaks a login.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const id = sessionIdOf(request, config.sessionCookieName);
    if (id && (await this.auth.validUntil(id))) return true;

    throw new ApiError(401, 'no_session', 'Log in first.');
  }
}
