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
  | 'scan.poll'
  | 'kofi.webhook'
  | 'supporters.read'
  | 'community.read'
  | 'community.publish'
  | 'community.manage'
  | 'community.like'
  | 'community.action'
  | 'community.report';

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
  // Ko-fi webhook — keyed by client IP. Only ever hit after the verification
  // token matches, so this is a backstop against a leaked token, not the front
  // door. Generous enough that a burst of real donations can't be dropped.
  'kofi.webhook': { limit: 60, windowSeconds: 60 }, // 60/minute per IP
  // Public supporters read — cached at the edge, so this only sees cache misses.
  'supporters.read': { limit: 120, windowSeconds: 60 }, // 120/minute per IP
  // Community showcase: browsing is anonymous so reads are keyed by IP with
  // sync.read-level headroom (index pages + detail fetches). Publishing is
  // keyed by userId and deliberately scarce: nobody legitimately publishes
  // more than a handful of designs a day, and the 25-live quota makes a
  // bigger budget pointless.
  'community.read': { limit: 240, windowSeconds: 60 }, // 240/minute per IP
  'community.publish': { limit: 10, windowSeconds: 24 * 60 * 60 }, // 10/day per user
  // Remediation on existing designs (update, unpublish, admin purge) has its
  // own budget: sharing the scarce publish budget would lock a user who
  // published 10 times out of deleting their own designs, and cap an admin's
  // moderation sweeps at 10/day per IP.
  'community.manage': { limit: 60, windowSeconds: 24 * 60 * 60 }, // 60/day per user (admin path: per IP)
  // Like/unlike: session-scoped, generous. Hearting while browsing a page of
  // cards is a light, repeated action, not a scarce resource like publish.
  'community.like': { limit: 60, windowSeconds: 60 }, // 60/minute per user
  // Open/export: anonymous, keyed by IP. Headroom for a legitimate burst
  // (opening several designs while browsing). Counter inflation is bounded
  // separately, in the handler's dedupe set (one count per IP per window per
  // design; the clientId alone is attacker-mintable); this limit only bounds
  // raw request volume and Redis write pressure.
  'community.action': { limit: 60, windowSeconds: 60 }, // 60/minute per IP
  // Report: session-scoped. Mirrors the anonymous 'report' action's budget
  // (10/hour), same abuse shape but keyed by account instead of IP.
  'community.report': { limit: 10, windowSeconds: 3600 }, // 10/hour per user
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp
  retryAfterSeconds?: number;
}

/**
 * Sliding-window check-and-consume as a single command.
 *
 * This previously ran as four sequential awaits (ZCOUNT, ZADD,
 * ZREMRANGEBYSCORE, EXPIRE). Beyond the four round trips, the gap between
 * reading the count and writing the entry let concurrent callers each observe
 * a below-limit count and all be admitted. A script closes that window.
 *
 * The denial branch reads the oldest entry *inside* the window rather than the
 * oldest overall: cleanup only runs on the allow path, so a key under sustained
 * denial retains entries older than `windowStart`, and using one of those would
 * produce a resetAt in the past.
 *
 * The window floor is exclusive so it agrees with the inclusive prune below.
 * Counting an entry at exactly `windowStart` while the same call deletes it
 * would let a scope be denied on the strength of a slot it just gave up.
 *
 * Returns [allowed, remaining, oldestScoreInWindow].
 */
const SLIDING_WINDOW_LUA = `
local floor = '(' .. ARGV[1]
local count = redis.call('ZCOUNT', KEYS[1], floor, '+inf')
local limit = tonumber(ARGV[2])
if count >= limit then
  local oldest = redis.call('ZRANGEBYSCORE', KEYS[1], floor, '+inf', 'WITHSCORES', 'LIMIT', 0, 1)
  return {0, 0, oldest[2] or '0'}
end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[5])
return {1, limit - count - 1, '0'}
`;

/** `defineCommand` attaches the script as a method; declare its shape for callers. */
interface RateLimitRedis extends Redis {
  slidingWindowRateLimit(
    key: string,
    windowStart: string,
    limit: string,
    now: string,
    entryId: string,
    ttlSeconds: string
  ): Promise<[number, number, string]>;
}

// Lazy-initialize Redis connection
let redis: RateLimitRedis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!redis) {
    const urlConfig = parseRedisUrl(process.env.REDIS_URL);
    const client = new Redis({
      ...urlConfig,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 5000,
    });
    // ioredis sends EVALSHA and transparently re-loads the body on NOSCRIPT,
    // so a Redis restart or SCRIPT FLUSH recovers without any handling here.
    client.defineCommand('slidingWindowRateLimit', {
      numberOfKeys: 1,
      lua: SLIDING_WINDOW_LUA,
    });
    redis = client as RateLimitRedis;
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
    const entryId = `${now}:${Math.random().toString(36).slice(2, 8)}`;
    const [allowed, remaining, oldestScore] = await (
      client as RateLimitRedis
    ).slidingWindowRateLimit(
      key,
      String(windowStart),
      String(config.limit),
      String(now),
      entryId,
      String(config.windowSeconds + 60)
    );

    if (allowed === 0) {
      const oldest = Number(oldestScore);
      const resetAt =
        oldest > 0 ? Math.ceil(oldest + config.windowSeconds) : now + config.windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds: resetAt - now,
      };
    }

    return {
      allowed: true,
      remaining,
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
