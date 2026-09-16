import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from './index';
import { logger } from '../observability/logger';

let redisClient: any;

const redisOptions = {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  connectTimeout: 5000,
  retryStrategy: () => null, // don't hang if offline
};

const realRedis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, redisOptions)
  : new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      ...redisOptions,
    });

realRedis.on('error', () => undefined);

// Lua scripts
export const ATOMIC_RESERVE_SCRIPT = `
  local reservedKey = KEYS[1]
  local physicalStock = tonumber(ARGV[1])
  local requestedQty = tonumber(ARGV[2])
  local ttlSeconds = tonumber(ARGV[3])

  local currentReserved = tonumber(redis.call('get', reservedKey) or '0')
  local available = physicalStock - currentReserved

  if available >= requestedQty then
    local newReserved = redis.call('incrby', reservedKey, requestedQty)
    redis.call('expire', reservedKey, ttlSeconds)
    return {1, newReserved, available - requestedQty}
  else
    return {0, currentReserved, available}
  end
`;

export const ATOMIC_RELEASE_SCRIPT = `
  local reservedKey = KEYS[1]
  local releaseQty = tonumber(ARGV[1])

  local currentReserved = tonumber(redis.call('get', reservedKey) or '0')
  if currentReserved <= releaseQty then
    redis.call('del', reservedKey)
    return 0
  else
    local remaining = redis.call('decrby', reservedKey, releaseQty)
    return remaining
  end
`;

// Start with real Redis, switch to RedisMock if offline
redisClient = realRedis;

export async function connectRedis(): Promise<void> {
  try {
    await realRedis.connect();
    logger.info('⚡ Connected to external Redis');
  } catch (error) {
    logger.warn('⚠️ External Redis not reachable. Switching to in-memory Redis mock...');
    const mock = new RedisMock();
    
    // Add Lua mock support for eval
    const memoryStore: Record<string, any> = {};
    (mock as any).eval = async (script: string, numkeys: number, key: string, ...args: any[]) => {
      if (script.includes('stock_reserved') || script.includes('incrby')) {
        const physicalStock = Number(args[0]) || 0;
        const requestedQty = Number(args[1]) || 0;
        const currentReserved = Number(memoryStore[key] || 0);
        const available = physicalStock - currentReserved;

        if (available >= requestedQty) {
          memoryStore[key] = currentReserved + requestedQty;
          return [1, memoryStore[key], available - requestedQty];
        } else {
          return [0, currentReserved, available];
        }
      } else if (script.includes('decrby')) {
        const releaseQty = Number(args[0]) || 0;
        const currentReserved = Number(memoryStore[key] || 0);
        memoryStore[key] = Math.max(0, currentReserved - releaseQty);
        return memoryStore[key];
      }
      return 1;
    };

    redisClient = mock;
    logger.info('⚡ In-Memory Redis initialized with atomic reservation scripts');
  }
}

export const redis = new Proxy({} as any, {
  get: (target, prop) => {
    return (redisClient as any)[prop];
  },
});
