import Redis from 'ioredis';

let redisInstance: Redis | null = null;
let subscriberInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });
  }
  return redisInstance;
}

export function getRedisSubscriber(): Redis {
  if (!subscriberInstance) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    subscriberInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });
  }
  return subscriberInstance;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis();
  if (redis.status === 'wait') {
    await redis.connect();
  }
}

export async function connectRedisSubscriber(): Promise<void> {
  const sub = getRedisSubscriber();
  if (sub.status === 'wait') {
    await sub.connect();
  }
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}

export async function closeRedisSubscriber(): Promise<void> {
  if (subscriberInstance) {
    await subscriberInstance.quit();
    subscriberInstance = null;
  }
}
