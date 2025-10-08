import { Redis } from '@upstash/redis';
import type { Grain } from '@/types';

// In-memory cache fallback
class InMemoryCache {
  private cache: Map<string, { value: unknown; expiry: number }> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  // Cleanup expired entries periodically
  startCleanup(intervalMs: number = 60000) {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiry) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }
}

// Cache client
class CacheClient {
  private redis: Redis | null = null;
  private memoryCache: InMemoryCache;
  private ttlSeconds: number;

  constructor() {
    // Try to initialize Upstash Redis
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      try {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken,
        });
        console.log('✅ Upstash Redis connected');
      } catch (error) {
        console.warn('⚠️  Failed to connect to Redis, using in-memory cache:', error);
        this.redis = null;
      }
    } else {
      console.log('ℹ️  Redis not configured, using in-memory cache');
    }

    this.memoryCache = new InMemoryCache();
    this.memoryCache.startCleanup();
    this.ttlSeconds = parseInt(process.env.METRIC_CACHE_TTL_SECONDS || '900', 10);
  }

  private generateKey(
    type: string,
    orgId: string,
    params: Record<string, unknown>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    return `${type}:${orgId}:${sortedParams}`;
  }

  async getMetric(
    orgId: string,
    metricName: string,
    grain: Grain,
    startDate: string,
    endDate: string,
    dimensions?: Record<string, string>
  ): Promise<number | null> {
    const key = this.generateKey('metric', orgId, {
      metric: metricName,
      grain,
      start: startDate,
      end: endDate,
      dims: dimensions || {},
    });

    if (this.redis) {
      try {
        const value = await this.redis.get<number>(key);
        return value;
      } catch (error) {
        console.error('Redis get error:', error);
        return this.memoryCache.get<number>(key);
      }
    }

    return this.memoryCache.get<number>(key);
  }

  async setMetric(
    orgId: string,
    metricName: string,
    grain: Grain,
    startDate: string,
    endDate: string,
    value: number,
    dimensions?: Record<string, string>
  ): Promise<void> {
    const key = this.generateKey('metric', orgId, {
      metric: metricName,
      grain,
      start: startDate,
      end: endDate,
      dims: dimensions || {},
    });

    if (this.redis) {
      try {
        await this.redis.set(key, value, { ex: this.ttlSeconds });
      } catch (error) {
        console.error('Redis set error:', error);
        await this.memoryCache.set(key, value, this.ttlSeconds);
      }
    } else {
      await this.memoryCache.set(key, value, this.ttlSeconds);
    }
  }

  async invalidateMetric(
    orgId: string,
    metricName: string,
    grain?: Grain
  ): Promise<void> {
    // For Redis, we'd need to use SCAN to find all matching keys
    // For simplicity in v1, we'll handle this on a case-by-case basis
    console.log(`Invalidating cache for metric: ${metricName}, grain: ${grain || 'all'}`);
  }

  async clear(): Promise<void> {
    if (this.redis) {
      // Note: This would clear ALL keys in Redis, use with caution
      console.warn('Clearing Redis cache not implemented for safety');
    }
    await this.memoryCache.clear();
  }
}

// Singleton instance
let cacheClient: CacheClient | null = null;

export function getCacheClient(): CacheClient {
  if (!cacheClient) {
    cacheClient = new CacheClient();
  }
  return cacheClient;
}
