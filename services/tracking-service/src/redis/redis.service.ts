import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Wraps the ElastiCache Redis client used for live vehicle positions (report section 5,
 * "Redis - live locations, sessions, cache"). Sub-millisecond reads here are what let the
 * live map avoid hitting the relational store on every poll.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
