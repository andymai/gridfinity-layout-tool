import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../lib/method.js';
import { logger } from '../lib/logger.js';
import { ErrorCode } from '../lib/shared.js';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { requireSession } from '../lib/session.js';
import { userProfileKey } from '../lib/redisKeys.js';
import type { AuthProvider } from '../lib/userId.js';

interface UserProfileRecord {
  userId: string;
  provider: AuthProvider;
  email: string;
  displayName?: string;
}

/**
 * GET /api/auth/me
 *
 * Returns the signed-in user's public profile. 401 if not signed in or the
 * session has expired/been revoked. The client uses this on mount and on
 * `visibilitychange` to keep the local session store in sync with KV.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return;

  const rate = await checkRateLimit(getClientIP(req), 'auth.read');
  if (!rate.allowed) {
    res.status(429).json({
      error: 'Too many requests. Try again later.',
      code: ErrorCode.RATE_LIMITED,
      retryAfter: rate.retryAfterSeconds,
    });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const redis = getRedis();
  if (!redis) {
    res.status(503).json({
      error: 'Service temporarily unavailable',
      code: ErrorCode.SERVICE_UNAVAILABLE,
    });
    return;
  }

  try {
    const raw = await redis.get(userProfileKey(session.userId));
    if (!raw) {
      // Profile gone (account deleted) but session somehow lingers. Treat as
      // unauthenticated — the next sync request will hit a similar 401 and
      // the client will flip to anonymous.
      res.status(401).json({ error: 'Profile missing', code: ErrorCode.UNAUTHORIZED });
      return;
    }
    const profile = JSON.parse(raw) as UserProfileRecord;
    res.status(200).json({
      userId: session.userId,
      provider: session.provider,
      email: profile.email,
      displayName: profile.displayName,
    });
  } catch (error) {
    logger.error('Failed to read user profile', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Profile read failed', code: ErrorCode.SERVER_ERROR });
  }
}
