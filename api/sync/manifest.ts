import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../lib/method.js';
import { ErrorCode } from '../lib/shared.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit, getRedis } from '../lib/rateLimit.js';
import { requireSession } from '../lib/session.js';
import { getIndex, getIndexUpdatedAt } from '../lib/userIndex.js';

/**
 * GET /api/sync/manifest
 *
 * Returns the user's full per-kind index plus an `indexUpdatedAt`
 * timestamp the client uses for `If-Modified-Since` polling.
 *
 *   200  → { layouts, designs, baseplates: { [id]: IndexEntry }, indexUpdatedAt }
 *   304  → empty body when the client's `If-Modified-Since` >= the
 *          server's `users:{uid}:indexUpdatedAt` (no scan needed).
 *
 * The 304 path is the hot poll path — every authenticated tab pings
 * this every 45s when visible, so it must be cheap. We compare against
 * a single Redis GET of the `indexUpdatedAt` key, never reading the
 * hashes themselves.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return;

  const session = await requireSession(req, res);
  if (!session) return;

  const rate = await checkRateLimit(session.userId, 'sync.read');
  if (!rate.allowed) {
    res.status(429).json({
      error: 'Too many requests. Try again later.',
      code: ErrorCode.RATE_LIMITED,
      retryAfter: rate.retryAfterSeconds,
    });
    return;
  }

  const redis = getRedis();
  if (!redis) {
    res
      .status(503)
      .json({ error: 'Service temporarily unavailable', code: ErrorCode.SERVICE_UNAVAILABLE });
    return;
  }

  try {
    const indexUpdatedAt = await getIndexUpdatedAt(redis, session.userId);

    const ifModifiedSince = parseIfModifiedSinceHeader(req);
    if (ifModifiedSince !== null && indexUpdatedAt > 0 && ifModifiedSince >= indexUpdatedAt) {
      res.status(304).end();
      return;
    }

    const [layouts, designs, baseplates] = await Promise.all([
      getIndex(redis, session.userId, 'layouts'),
      getIndex(redis, session.userId, 'designs'),
      getIndex(redis, session.userId, 'baseplates'),
    ]);

    res.status(200).json({ layouts, designs, baseplates, indexUpdatedAt });
  } catch (error) {
    logger.error('sync/manifest failed', {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Server error', code: ErrorCode.SERVER_ERROR });
  }
}

/**
 * Read a numeric millisecond timestamp from `If-Modified-Since` (custom
 * convention — we send a number, not RFC 1123, because our cache key is
 * `users:{uid}:indexUpdatedAt` already in ms). Returns null if absent or
 * malformed; the handler then serves a fresh 200.
 */
function parseIfModifiedSinceHeader(req: VercelRequest): number | null {
  const raw: unknown = req.headers['if-modified-since'];
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0]) : null;
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
