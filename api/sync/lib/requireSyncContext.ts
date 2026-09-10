import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import { requireMethod } from '../../lib/method.js';
import { rateLimited, serviceUnavailable } from '../../lib/shared.js';
import { checkRateLimit, getRedis } from '../../lib/rateLimit.js';
import { requireSession, type SessionRecord } from '../../lib/session.js';

export interface SyncContext {
  readonly session: SessionRecord;
  readonly redis: Redis;
}

/**
 * Method, session (which carries the CSRF defence), rate limit and Redis, in
 * the order every sync handler checks them. Null means the response has
 * already been sent.
 */
export async function requireSyncContext(
  req: VercelRequest,
  res: VercelResponse,
  methods: readonly string[],
  bucket: Parameters<typeof checkRateLimit>[1]
): Promise<SyncContext | null> {
  if (!requireMethod(req, res, methods)) return null;

  const session = await requireSession(req, res);
  if (!session) return null;

  const rate = await checkRateLimit(session.userId, bucket);
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds);
    return null;
  }

  const redis = getRedis();
  if (!redis) {
    serviceUnavailable(res);
    return null;
  }

  return { session, redis };
}
