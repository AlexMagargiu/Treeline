import { Injectable } from '@nestjs/common';
import { config } from '../common/config';
import { HttpRequest } from '../common/http';
import { RedisService } from '../redis/redis.service';

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the window resets. Zero while the caller is still under the limit. */
  retryAfterSeconds: number;
}

/** The three commands the limiter uses, so the unit test can supply its own counter. */
export interface Counter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

/**
 * The window is fixed, not sliding: EXPIRE is set only on the attempt that creates the
 * key, so fifteen minutes after the first attempt the count starts again. A sliding
 * window would let somebody who keeps trying lock themselves out forever, and this limit
 * exists to slow a guesser down, not to punish the one person who knows the password.
 *
 * Successes count as well as failures. Counting only failures would let a stolen session
 * be minted again and again from one address.
 */
export async function countAttempt(
  counter: Counter,
  address: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  const key = `login:${address}`;
  const attempts = await counter.incr(key);
  if (attempts === 1) await counter.expire(key, windowSeconds);
  if (attempts <= maxAttempts) return { allowed: true, retryAfterSeconds: 0 };

  const remaining = await counter.ttl(key);
  return { allowed: false, retryAfterSeconds: remaining > 0 ? remaining : windowSeconds };
}

/**
 * The client address. Behind Caddy the socket address is the proxy, so the leftmost entry
 * of X-Forwarded-For is the caller. It is only as trustworthy as the proxy in front of
 * it, which is the same trust the TLS termination already needs.
 */
export function clientAddress(request: HttpRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  const header = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const leftmost = header?.split(',')[0]?.trim();
  return leftmost || request.socket.remoteAddress || 'unknown';
}

@Injectable()
export class LoginRateLimiter {
  constructor(private readonly redis: RedisService) {}

  record(address: string): Promise<RateLimitVerdict> {
    return countAttempt(
      this.redis.client,
      address,
      config.loginMaxAttempts,
      config.loginWindowMinutes * 60,
    );
  }
}
