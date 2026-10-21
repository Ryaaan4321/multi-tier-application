import { ICacheManager } from './cache.interface.js';

export class NullCacheManager implements ICacheManager {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set(_key: string, _value: unknown, _ttlSeconds?: number): Promise<void> {}

  async del(_key: string): Promise<void> {}
}
