import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../lib/method.js';
import { ErrorCode } from '../lib/shared.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { clearSessionCookie, readSessionCookie } from '../lib/cookies.js';
import { checkCsrfDefense, deleteSession } from '../lib/session.js';

/**
 * POST /api/auth/logout
 *
 * Idempotent: works whether or not a session cookie is present, and whether
 * or not the underlying session exists in KV. Always clears the cookie and
 * returns 204.
 *
 * CSRF defenses come from `checkCsrfDefense` (Origin + X-Requested-With).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['POST'])) return;
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
  if (token) {
    const redis = getRedis();
    if (redis) {
      try {
        await deleteSession(redis, token);
      } catch (error) {
        logger.error('Logout: failed to delete session record', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Cookie still gets cleared below — user is signed out from their POV.
      }
    }
  }

  clearSessionCookie(res);
  res.status(204).end();
}
