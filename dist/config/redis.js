"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.ATOMIC_RELEASE_SCRIPT = exports.ATOMIC_RESERVE_SCRIPT = void 0;
exports.connectRedis = connectRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const ioredis_mock_1 = __importDefault(require("ioredis-mock"));
const index_1 = require("./index");
const logger_1 = require("../observability/logger");
let redisClient;
const redisOptions = {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy: () => null, // don't hang if offline
};
const realRedis = process.env.REDIS_URL
    ? new ioredis_1.default(process.env.REDIS_URL, redisOptions)
    : new ioredis_1.default({
        host: index_1.config.redis.host,
        port: index_1.config.redis.port,
        password: index_1.config.redis.password,
        ...redisOptions,
    });
// Lua scripts
exports.ATOMIC_RESERVE_SCRIPT = `
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
exports.ATOMIC_RELEASE_SCRIPT = `
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
async function connectRedis() {
    try {
        await realRedis.connect();
        logger_1.logger.info('⚡ Connected to external Redis');
    }
    catch (error) {
        logger_1.logger.warn('⚠️ External Redis not reachable. Switching to in-memory Redis mock...');
        const mock = new ioredis_mock_1.default();
        // Add Lua mock support for eval
        const memoryStore = {};
        mock.eval = async (script, numkeys, key, ...args) => {
            if (script.includes('stock_reserved') || script.includes('incrby')) {
                const physicalStock = Number(args[0]) || 0;
                const requestedQty = Number(args[1]) || 0;
                const currentReserved = Number(memoryStore[key] || 0);
                const available = physicalStock - currentReserved;
                if (available >= requestedQty) {
                    memoryStore[key] = currentReserved + requestedQty;
                    return [1, memoryStore[key], available - requestedQty];
                }
                else {
                    return [0, currentReserved, available];
                }
            }
            else if (script.includes('decrby')) {
                const releaseQty = Number(args[0]) || 0;
                const currentReserved = Number(memoryStore[key] || 0);
                memoryStore[key] = Math.max(0, currentReserved - releaseQty);
                return memoryStore[key];
            }
            return 1;
        };
        redisClient = mock;
        logger_1.logger.info('⚡ In-Memory Redis initialized with atomic reservation scripts');
    }
}
exports.redis = new Proxy({}, {
    get: (target, prop) => {
        return redisClient[prop];
    },
});
