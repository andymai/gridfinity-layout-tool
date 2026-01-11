import Redis from 'ioredis';

export type RateLimitAction = 'create' | 'update' | 'view' | 'delete' | 'report';

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  create: { limit: 10, windowSeconds: 3600 },      // 10/hour
  update: { limit: 10, windowSeconds: 3600 },      // 10/hour
  view: { limit: 100, windowSeconds: 60 },         // 100/minute
  delete: { limit: 5, windowSeconds: 3600 },       // 5/hour
  report: { limit: 10, windowSeconds: 3600 },      // 10/hour
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
    redis = new Redis(process.env.REDIS_URL, {
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
      const resetAt = oldest.length > 1
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
    // If Redis is unavailable, allow the request but log
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: now + config.windowSeconds,
    };
  }
}

/**
 * Hash IP address for privacy (don't store raw IPs).
 * Using simple hash for Redis keys only.
 */
function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get client IP from request headers.
 * Vercel sets x-forwarded-for header.
 * Supports both Fetch API Request and Node.js IncomingHttpHeaders.
 */
export function getClientIP(request: Request | { headers: Record<string, string | string[] | undefined> }): string {
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
