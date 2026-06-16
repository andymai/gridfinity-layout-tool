import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { logger } from './logger.js';
import { rateLimitKey } from './redisKeys.js';

export type RateLimitAction =
  | 'create'
  | 'update'
  | 'view'
  | 'delete'
  | 'report'
  | 'telemetry'
  | 'auth.start'
  | 'auth.callback'
  | 'auth.read'
  | 'sync.write'
  | 'sync.read'
  | 'scan.create'
  | 'scan.upload'
  | 'scan.poll';

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
  // Auth surfaces — keyed by client IP. Login/callback are slower (per-IP
  // OAuth ceremonies); /api/auth/me is poll-friendly so it gets the same
  // headroom as 'view'.
  'auth.start': { limit: 30, windowSeconds: 60 }, // 30/minute per IP
  'auth.callback': { limit: 30, windowSeconds: 60 }, // 30/minute per IP
  'auth.read': { limit: 100, windowSeconds: 60 }, // 100/minute per IP
  // Sync surfaces — keyed by userId (each authenticated user gets their own
  // budget). Reads accommodate poll bursts across multiple tabs; writes
  // protect against runaway clients.
  'sync.write': { limit: 60, windowSeconds: 60 }, // 60/minute per user
  'sync.read': { limit: 240, windowSeconds: 60 }, // 240/minute per user
  // Phone-scan handoff — keyed by client IP. Create/upload are one-shot per
  // scan; poll is generous because the desktop polls every ~1.5s while waiting.
  'scan.create': { limit: 30, windowSeconds: 60 }, // 30/minute per IP
  'scan.upload': { limit: 30, windowSeconds: 60 }, // 30/minute per IP
  'scan.poll': { limit: 240, windowSeconds: 60 }, // 240/minute per IP
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp
  retryAfterSeconds?: number;
}

// Lazy-initialize Redis connection
let redis: Redis | null = null;

export function getRedis(): Redis | null {
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
 * Check and consume rate limit for a scope (client IP for anonymous
 * surfaces, userId for authenticated ones) and action type.
 *
 * Uses sliding window counter pattern with Redis. The scope value is
 * hashed before use as a Redis key — for IPs this provides privacy; for
 * userIds (already pseudonymous SHA-256 hashes) it's redundant but
 * harmless and keeps the key shape uniform.
 */
export async function checkRateLimit(
  scope: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;
  const key = rateLimitKey(action, hashScope(scope));

  const client = getRedis();

  // If Redis is not configured, fail closed in production to prevent abuse.
  // In development/preview, allow requests so local dev works without Redis.
  if (!client) {
    const isProduction = process.env.VERCEL_ENV === 'production';
    return {
      allowed: !isProduction,
      remaining: isProduction ? 0 : config.limit,
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
    logger.error('Rate limit check failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + config.windowSeconds,
    };
  }
}

/**
 * Hash a scope identifier (IP or userId) for use as a Redis key.
 * SHA-256 truncated to 16 hex chars; primarily about privacy for IPs.
 */
function hashScope(scope: string): string {
  return createHash('sha256').update(scope).digest('hex').slice(0, 16);
}

/**
 * Get client IP from request headers.
 *
 * SECURITY: assumes a Vercel deployment. Vercel's edge network always sets
 * `x-forwarded-for` itself and **overrides** any value the client supplied,
 * so the leftmost value is the trusted client IP. If this code is ever run
 * behind a different proxy (or directly), this header is client-controllable
 * and per-IP rate limits become spoofable. On non-Vercel deployments, take
 * the rightmost trusted IP from a known-length proxy chain instead.
 *
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
