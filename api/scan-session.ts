import { randomUUID } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { logger } from './lib/logger.js';
import { ErrorCode, getBaseUrl, methodNotAllowed } from './lib/shared.js';
import { scanSessionKey } from './lib/redisKeys.js';
import { SCAN_SESSION_TTL_SECONDS, type ScanSessionRecord } from './lib/scanSession.js';

/**
 * POST handler that opens a phone-scan handoff session.
 *
 * Mints an unguessable token, stores a `pending` record in Redis with a short
 * TTL, and returns the token plus the `/scan/<token>` URL for the desktop to
 * render as a QR code. The phone later uploads against this token; the desktop
 * polls for the result.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  try {
    const rateLimit = await checkRateLimit(getClientIP(req), 'scan.create');
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many scan sessions. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const redis = getRedis();
    if (!redis) {
      // The handoff needs Redis to relay the outline. Signal the client so it
      // can fall back to manual upload instead of showing a dead QR code.
      return res.status(503).json({
        error: 'Scan handoff is unavailable.',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }

    const token = randomUUID();
    const record: ScanSessionRecord = { status: 'pending', createdAt: new Date().toISOString() };
    await redis.set(scanSessionKey(token), JSON.stringify(record), 'EX', SCAN_SESSION_TTL_SECONDS);

    return res.status(201).json({
      token,
      url: `${getBaseUrl()}/scan/${token}`,
      expiresInSeconds: SCAN_SESSION_TTL_SECONDS,
    });
  } catch (error) {
    logger.error('Scan session create error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to create scan session',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
