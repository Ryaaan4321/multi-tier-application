import { Redis } from 'ioredis';
import { ICacheManager } from './cache.interface.js';
import { Logger } from 'pino';

export class RedisCacheManager implements ICacheManager {
  private client: Redis;
  private logger: Logger;

  constructor(redisUrl: string, logger: Logger) {
    this.logger = logger.child({ module: 'RedisCacheManager' });
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true
    });

    this.client.on('error', (err: Error) => {
      this.logger.error({ err }, 'Redis connection error');
    });
  }
  getClient(): Redis {
    return this.client;
  }
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.info('Connected to Redis');
    } catch (err) {
      this.logger.warn({ err }, 'Redis initial connection failed, proceeding with cache-miss fallback');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      this.logger.warn({ err, key }, 'Failed to read from Redis cache');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = 60): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn({ err, key }, 'Failed to write to Redis cache');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn({ err, key }, 'Failed to delete from Redis cache');
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
