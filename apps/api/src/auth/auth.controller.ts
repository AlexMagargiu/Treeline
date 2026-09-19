import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { CookieOptions, HttpRequest, HttpResponse } from '../common/http';
import { config } from '../common/config';
import { VALIDATE } from '../common/validation';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { clientAddress, LoginRateLimiter } from './login-rate-limiter';
import { Public } from './public.decorator';
import { sessionIdOf } from './session-cookie';

/**
 * The cookie carries the session id and nothing else. Secure is set unconditionally:
 * Caddy terminates TLS in front of this in every environment, including locally, so
 * there is no deployment where the cookie should travel in the clear.
 */
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly limiter: LoginRateLimiter,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(VALIDATE) body: LoginDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<{ token: string; expiresAt: string }> {
    // Counted before the password is checked, so a refusal costs an attempt too and the
    // limit cannot be walked around by guessing until one works.
    const verdict = await this.limiter.record(clientAddress(request));
    if (!verdict.allowed) {
      throw new ApiError(429, 'too_many_attempts', 'Too many login attempts. Try again later.', {
        'Retry-After': String(verdict.retryAfterSeconds),
      });
    }

    // One message for every failure. Saying which part was wrong tells a guesser whether
    // a password is set at all.
    if (!(await this.auth.verify(body.password))) {
      throw new ApiError(401, 'invalid_password', 'Login failed.');
    }

    const session = await this.auth.open();
    response.cookie(config.sessionCookieName, session.id, cookieOptions());
    // The same id as the cookie, for a native client that has no cookie jar.
    return { token: session.id, expiresAt: session.expiresAt.toISOString() };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<void> {
    const id = sessionIdOf(request, config.sessionCookieName);
    if (id) await this.auth.close(id);
    response.clearCookie(config.sessionCookieName, cookieOptions());
  }

  @Get('session')
  async session(@Req() request: HttpRequest): Promise<{ validUntil: string }> {
    // The guard has already established the session is live, so this cannot be null.
    const id = sessionIdOf(request, config.sessionCookieName);
    const validUntil = id ? await this.auth.validUntil(id) : null;
    if (!validUntil) throw new ApiError(401, 'no_session', 'Log in first.');
    return { validUntil: validUntil.toISOString() };
  }
}
