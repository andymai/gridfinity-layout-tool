import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../lib/method.js';
import { ErrorCode } from '../lib/shared.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit, getRedis } from '../lib/rateLimit.js';
import { requireSession } from '../lib/session.js';
import { clearSessionCookie } from '../lib/cookies.js';
import { deleteBlob } from '../lib/blobStore.js';
import {
  sessionKey,
  userIndexKey,
  userIndexUpdatedAtKey,
  userProfileKey,
  userSessionsKey,
} from '../lib/redisKeys.js';

/**
 * DELETE /api/sync/account
 *
 * Hard-delete the signed-in user's account. The cascade order matters:
 *
 *   1. Sessions   — DEL session:{token} for every token in the user's set
 *                   (so other tabs/devices flip to anonymous on next sync)
 *   2. Blobs      — del() each layouts/{id}.json and designs/{id}.json
 *   3. KV keys    — drop indexes, profile, sessions set, indexUpdatedAt
 *   4. Cookie     — clear the session cookie on the responding device
 *
 * Idempotent on partial-failure replay: each step uses unconditional DEL,
 * so repeating after a timeout/cold-start just no-ops on already-cleared
 * keys. The blob loop catches per-blob errors and continues — a stuck
 * blob won't block the rest of the cascade.
 *
 * Vercel function timeout is 60s. With max 100 layouts + 100 designs
 * × ~50ms per Blob delete = ~10s worst case, well within budget.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['DELETE'])) return;

  // CSRF defense is enforced inside `requireSession` (see api/lib/session.ts).
  const session = await requireSession(req, res);
  if (!session) return;

  const rate = await checkRateLimit(session.userId, 'sync.write');
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

  const { userId } = session;
  try {
    // 1. Cascade-delete every active session for this user.
    const tokens = await redis.smembers(userSessionsKey(userId));
    if (tokens.length > 0) {
      await redis.del(...tokens.map((t) => sessionKey(t)));
    }

    // 2. Delete every blob this user owns. Errors per-blob are logged but
    //    don't block the cascade — leftover blobs are storage cost only,
    //    not a correctness issue, and re-issuing the request will retry.
    const layoutIds = await redis.hkeys(userIndexKey(userId, 'layouts'));
    const designIds = await redis.hkeys(userIndexKey(userId, 'designs'));

    await Promise.all([
      ...layoutIds.map((id) => deleteBlobSafe(`users/${userId}/layouts/${id}.json`, userId)),
      ...designIds.map((id) => deleteBlobSafe(`users/${userId}/designs/${id}.json`, userId)),
    ]);

    // 3. Drop all per-user KV state in one DEL.
    await redis.del(
      userIndexKey(userId, 'layouts'),
      userIndexKey(userId, 'designs'),
      userIndexUpdatedAtKey(userId),
      userProfileKey(userId),
      userSessionsKey(userId)
    );

    // 4. Clear the session cookie on the device making this request.
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    logger.error('sync/account delete failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Server error', code: ErrorCode.SERVER_ERROR });
  }
}

async function deleteBlobSafe(path: string, userId: string): Promise<void> {
  try {
    await deleteBlob(path);
  } catch (error) {
    logger.error('account-delete: blob delete failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue — leftover blobs are storage cost, not a correctness issue.
  }
}
