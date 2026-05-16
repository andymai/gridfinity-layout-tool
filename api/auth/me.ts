import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../lib/method.js';
import { logger } from '../lib/logger.js';
import { ErrorCode } from '../lib/shared.js';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { checkCsrfDefense, readSession } from '../lib/session.js';
import { readSessionCookie } from '../lib/cookies.js';
import { userProfileKey } from '../lib/redisKeys.js';
import type { AuthProvider } from '../lib/userId.js';

interface UserProfileRecord {
  userId: string;
  provider: AuthProvider;
  email: string;
  displayName?: string;
}

interface MeResponse {
  authenticated: boolean;
  user: {
    userId: string;
    provider: AuthProvider;
    email: string;
    displayName?: string;
  } | null;
}

const ANONYMOUS_RESPONSE: MeResponse = { authenticated: false, user: null };

/**
 * GET /api/auth/me
 *
 * Returns the current user's profile in a uniform 200 shape. Anonymous
 * callers get `{ authenticated: false, user: null }` — 401 used to be the
 * answer here but the browser logs every 4xx as a console error, which
 * trips the post-promote smoke check on every anonymous page load.
 *
 * Non-200 statuses are reserved for actual failures: 405 wrong method,
 * 403 CSRF/origin reject, 429 rate-limited, 503 Redis unavailable, 500
 * unexpected.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return;
  if (!checkCsrfDefense(req, res)) return;

  const rate = await checkRateLimit(getClientIP(req), 'auth.read');
  if (!rate.allowed) {
    res.status(429).json({
      error: 'Too many requests. Try again later.',
      code: ErrorCode.RATE_LIMITED,
      retryAfter: rate.retryAfterSeconds,
    });
    return;
  }

  const token = readSessionCookie(req);
  if (!token) {
    res.status(200).json(ANONYMOUS_RESPONSE);
    return;
  }

  const redis = getRedis();
  if (!redis) {
    if (process.env.VERCEL_ENV === 'production') {
      logger.error('Session check failed: Redis unavailable');
      res.status(503).json({
        error: 'Service temporarily unavailable',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
      return;
    }
    res.status(200).json(ANONYMOUS_RESPONSE);
    return;
  }

  const session = await readSession(redis, token);
  if (!session) {
    res.status(200).json(ANONYMOUS_RESPONSE);
    return;
  }

  try {
    const raw = await redis.get(userProfileKey(session.userId));
    if (!raw) {
      res.status(200).json(ANONYMOUS_RESPONSE);
      return;
    }
    const profile = JSON.parse(raw) as UserProfileRecord;
    const body: MeResponse = {
      authenticated: true,
      user: {
        userId: session.userId,
        provider: session.provider,
        email: profile.email,
        displayName: profile.displayName,
      },
    };
    res.status(200).json(body);
  } catch (error) {
    logger.error('Failed to read user profile', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Profile read failed', code: ErrorCode.SERVER_ERROR });
  }
}
