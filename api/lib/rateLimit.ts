import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';

export type RateLimitAction = 'create' | 'update' | 'view' | 'delete' | 'report' | 'telemetry';

/**
 * Parse Redis URL using WHATWG URL API to avoid deprecated url.parse().
 * ioredis accepts URL strings but uses the legacy url.parse() internally.
 */
function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
  };
}

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  create: { limit: 100, windowSeconds: 60 }, // 100/minute (dev friendly)
  update: { limit: 100, windowSeconds: 60 }, // 100/minute (dev friendly)
  view: { limit: 100, windowSeconds: 60 }, // 100/minute
  delete: { limit: 100, windowSeconds: 60 }, // 100/minute (dev friendly)
  report: { limit: 10, windowSeconds: 3600 }, // 10/hour
  telemetry: { limit: 100, windowSeconds: 60 }, // 100/minute (ML telemetry)
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp
  retryAfterSeconds?: number;
}

// Lazy-initialize Redis connection
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!redis) {
    const urlConfig = parseRedisUrl(process.env.REDIS_URL);
    redis = new Redis({
      ...urlConfig,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 5000,
    });
  }
  return redis;
}

/**
 * Check and consume rate limit for an IP address and action type.
 * Uses sliding window counter pattern with Redis.
 */
export async function checkRateLimit(
  ip: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;
  const key = `ratelimit:${action}:${hashIP(ip)}`;

  const client = getRedis();

  // If Redis is not configured, allow all requests
  if (!client) {
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: now + config.windowSeconds,
    };
  }

  try {
    // Get current count within window
    const count = await client.zcount(key, windowStart, '+inf');

    if (count >= config.limit) {
      // Get oldest entry to calculate reset time
      const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt =
        oldest.length > 1
          ? Math.ceil(Number(oldest[1]) + config.windowSeconds)
          : now + config.windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds: resetAt - now,
      };
    }

    // Add new entry with current timestamp as score
    const entryId = `${now}:${Math.random().toString(36).slice(2, 8)}`;
    await client.zadd(key, now, entryId);

    // Clean up old entries and set TTL
    await client.zremrangebyscore(key, 0, windowStart);
    await client.expire(key, config.windowSeconds + 60);

    return {
      allowed: true,
      remaining: config.limit - count - 1,
      resetAt: now + config.windowSeconds,
    };
  } catch (error) {
    // If Redis is unavailable, deny the request (fail-closed)
    console.error('Rate limit check failed:', error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + config.windowSeconds,
    };
  }
}

/**
 * Hash IP address for privacy (don't store raw IPs).
 * Uses SHA-256 truncated to 16 hex chars for Redis key use.
 */
function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Get client IP from request headers.
 * Vercel sets x-forwarded-for header.
 * Supports both Fetch API Request and Node.js IncomingHttpHeaders.
 */
export function getClientIP(
  request: Request | { headers: Record<string, string | string[] | undefined> }
): string {
  // Handle Fetch API Request
  if ('get' in request.headers && typeof request.headers.get === 'function') {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
  } else {
    // Handle Node.js IncomingHttpHeaders (VercelRequest)
    const headers = request.headers as Record<string, string | string[] | undefined>;
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ip.split(',')[0].trim();
    }
  }
  // Fallback (shouldn't happen on Vercel)
  return '127.0.0.1';
}
