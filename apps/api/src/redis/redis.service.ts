import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from '../common/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  // maxRetriesPerRequest bounds a command against a Redis that is down, so a login fails
  // with an error instead of hanging until the client gives up.
  readonly client = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
