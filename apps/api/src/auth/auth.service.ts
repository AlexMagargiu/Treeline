import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { config } from '../common/config';
import { RedisService } from '../redis/redis.service';
import { passwordMatches } from './password';

export interface NewSession {
  id: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(private readonly redis: RedisService) {}

  // Read at the moment of a login rather than at boot, because worker.ts builds the same
  // AppModule and the worker has no business holding the site password.
  verify(password: string): Promise<boolean> {
    return passwordMatches(process.env.TREELINE_PASSWORD_HASH, password);
  }

  /**
   * 32 random bytes, which is the whole session: the value is unguessable and Redis is
   * the only thing that says it is live, so there is nothing in it to sign or to read.
   */
  async open(): Promise<NewSession> {
    const id = randomBytes(32).toString('base64url');
    const seconds = config.sessionTtlDays * 24 * 60 * 60;
    await this.redis.client.set(`session:${id}`, new Date().toISOString(), 'EX', seconds);
    return { id, expiresAt: new Date(Date.now() + seconds * 1000) };
  }

  /** When the session expires, or null when it is not live. Read from the key's own TTL. */
  async validUntil(id: string): Promise<Date | null> {
    const remaining = await this.redis.client.pttl(`session:${id}`);
    return remaining > 0 ? new Date(Date.now() + remaining) : null;
  }

  async close(id: string): Promise<void> {
    await this.redis.client.del(`session:${id}`);
  }
}
