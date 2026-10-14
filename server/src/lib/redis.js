import Redis from 'ioredis';
import { env } from '../config/env.js';

const MAX_CACHE_ITEMS = 500;
const SWEEP_INTERVAL_MS = 60000;

class InMemoryCache {
  constructor(maxItems = MAX_CACHE_ITEMS) {
    this.store = new Map();
    this.maxItems = maxItems;
    // Periodic background sweep to actively purge expired keys without waiting for read access
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    if (this.sweepTimer.unref) {
      this.sweepTimer.unref(); // Prevents timer from keeping Node process alive unnecessarily
    }
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    // Refresh LRU order on read access
    this.store.delete(key);
    this.store.set(key, item);
    return item.value;
  }

  async set(key, value, ttlSeconds = 60) {
    // If key already exists, delete it first to maintain insertion/recency order
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxItems) {
      // Evict oldest unaccessed item (first entry in Map iterator)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return 'OK';
  }

  async del(key) {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async clear() {
    const count = this.store.size;
    this.store.clear();
    return count;
  }

  sweep() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  async ping() {
    return 'PONG';
  }

  size() {
    return this.store.size;
  }

  destroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.store.clear();
  }
}

class RedisCacheManager {
  constructor() {
    this.client = null;
    this.inMemory = new InMemoryCache();
    this.isConnected = false;
    this.initClient();
  }

  initClient() {
    if (!env.REDIS_ENABLED) {
      console.log('[REDIS] Redis disabled via config. Using resilient in-memory cache.');
      return;
    }

    try {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('[REDIS] Retries exhausted. Falling back to in-memory store.');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
        connectTimeout: 2000,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('✦ [REDIS] Connected to Redis cluster at', env.REDIS_URL);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        // Suppress connection spam; handled by memory fallback
      });

      this.client.connect().catch(() => {
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
    }
  }

  async get(key) {
    if (this.isConnected && this.client) {
      try {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } catch {}
    }
    const val = await this.inMemory.get(key);
    return val ? JSON.parse(val) : null;
  }

  async set(key, value, ttlSeconds = 60) {
    const serialized = JSON.stringify(value);
    if (this.isConnected && this.client) {
      try {
        return await this.client.set(key, serialized, 'EX', ttlSeconds);
      } catch {}
    }
    return await this.inMemory.set(key, serialized, ttlSeconds);
  }

  async del(key) {
    if (this.isConnected && this.client) {
      try {
        return await this.client.del(key);
      } catch {}
    }
    return await this.inMemory.del(key);
  }

  async ping() {
    const start = Date.now();
    if (this.isConnected && this.client) {
      try {
        await this.client.ping();
        return { status: 'ONLINE', driver: 'ioredis', latency_ms: Date.now() - start };
      } catch {}
    }
    await this.inMemory.ping();
    return { status: 'FALLBACK_READY', driver: 'in-memory-lru', latency_ms: Date.now() - start };
  }

  async clear() {
    let redisCleared = false;
    if (this.isConnected && this.client) {
      try {
        await this.client.flushdb();
        redisCleared = true;
      } catch {}
    }
    const memCleared = await this.inMemory.clear();
    return {
      success: true,
      driver: this.isConnected ? 'ioredis' : 'in-memory-lru',
      redis_cleared: redisCleared,
      memory_keys_purged: memCleared,
    };
  }

  getStatus() {
    const mem = process.memoryUsage();
    return {
      connected: this.isConnected,
      driver: this.isConnected ? 'ioredis' : 'in-memory-lru',
      cached_keys: this.inMemory.size(),
      max_capacity: MAX_CACHE_ITEMS,
      memory_heap_used_mb: parseFloat((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      memory_rss_mb: parseFloat((mem.rss / (1024 * 1024)).toFixed(2)),
    };
  }
}

export const redis = new RedisCacheManager();
export { InMemoryCache };

