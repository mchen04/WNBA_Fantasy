import { createClient, RedisClientType } from 'redis';
import { config } from './env';
import { logger } from '../utils/logger';

let redisClient: RedisClientType;

const initializeRedis = async (): Promise<RedisClientType> => {
  try {
    redisClient = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis Client Reconnecting');
    });

    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
};

// Initialize Redis client - use lazy initialization
let redisInstance: RedisClientType | null = null;

export const getRedis = async (): Promise<RedisClientType> => {
  if (!redisInstance) {
    redisInstance = await initializeRedis();
  }
  return redisInstance;
};

// For backward compatibility, also export a promise-based redis instance
export const redis = getRedis();

// Cache helper functions
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = await getRedis();
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const redis = await getRedis();
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setEx(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  },

  async del(key: string | string[]): Promise<void> {
    try {
      const redis = await getRedis();
      if (Array.isArray(key)) {
        await redis.del(key);
      } else {
        await redis.del(key);
      }
    } catch (error) {
      logger.error(`Cache delete error for key(s) ${key}:`, error);
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const redis = await getRedis();
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.expire(key, ttl);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
    }
  },

  async keys(pattern: string): Promise<string[]> {
    try {
      const redis = await getRedis();
      return await redis.keys(pattern);
    } catch (error) {
      logger.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  },

  async flush(): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.flushDb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  },
};

// Cache key generators
export const cacheKeys = {
  // Player cache keys
  player: (id: string) => `player:${id}`,
  playerStats: (id: string, dateRange?: string) => `player:${id}:stats:${dateRange || 'all'}`,
  playerFantasyScores: (id: string, configId: string) => `player:${id}:fantasy:${configId}`,
  playerConsistency: (id: string, days: string) => `player:${id}:consistency:${days}`,
  playerTrends: (id: string) => `player:${id}:trends`,
  
  // Rankings cache keys
  fantasyRankings: (configId: string, position?: string) => 
    `rankings:fantasy:${configId}:${position || 'all'}`,
  hotPlayers: (days: string) => `rankings:hot:${days}`,
  consistencyRankings: (days: string) => `rankings:consistency:${days}`,
  
  // Waiver cache keys
  dailyRecommendations: (date: string, excludeTopN: number) => 
    `waiver:daily:${date}:${excludeTopN}`,
  waiverTrends: (days: number) => `waiver:trends:${days}`,
  
  // User cache keys
  userSubscription: (userId: string) => `user:${userId}:subscription`,
  userUsage: (userId: string) => `user:${userId}:usage`,
  
  // General cache keys
  espnData: (type: string, id?: string) => `espn:${type}:${id || 'all'}`,
  teamRoster: (team: string) => `team:${team}:roster`,
  gameSchedule: (date: string) => `games:${date}`,
} as const;