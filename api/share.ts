import { put, head, del } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { logger } from './lib/logger.js';
import { validateShareLayout, isValidationError } from './lib/validation.js';
import { validateDesignerShare } from './lib/designerValidation.js';
import { filterLayoutContent } from './lib/contentFilter.js';
import {
  isValidShareId,
  hashToken,
  generateDeleteToken,
  ErrorCode,
  methodNotAllowed,
  getBaseUrl,
  shareHashKey,
  type ShareData,
} from './lib/shared.js';

/**
 * HTTP POST handler that creates a share (designer or layout) and stores its data in Vercel Blob.
 *
 * Validates request method and rate limits the client; validates the provided `layoutId`, permission, and
 * payload (designer params or layout structure); for layout shares runs content filtering; generates a
 * delete token (stored as a hash), persists the share metadata and payload, and returns the share ID,
 * public URL, delete token, and permission on success. Responds with appropriate 4xx errors for validation,
 * rate limiting, or content blocking, and 500 on unexpected failures.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'create');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many shares created. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Parse and validate request body
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { layout, layoutId, permission = 'view', authorName, type, params } = body;

    // Validate layoutId - must be provided by client
    if (!isValidShareId(layoutId)) {
      return res.status(400).json({
        error: 'Invalid or missing layoutId.',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Validate permission
    if (permission !== 'view' && permission !== 'edit') {
      return res.status(400).json({
        error: 'Invalid permission. Must be "view" or "edit".',
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    let sharePayload: unknown;

    if (type === 'designer') {
      // Designer share: validate BinParams
      const designerPayload = { type, version: body.version, params };
      const payloadJson = JSON.stringify(designerPayload);
      const result = validateDesignerShare(designerPayload, payloadJson.length);

      if (!result.valid) {
        const { error } = result;
        return res.status(400).json({
          error: error.message,
          code: error.code,
        });
      }

      sharePayload = result.payload;
    } else {
      // Layout share: validate layout structure
      if (!layout) {
        return res.status(400).json({
          error: 'Missing layout data',
          code: ErrorCode.VALIDATION_ERROR,
        });
      }

      const layoutJson = JSON.stringify(layout);
      const validationResult = validateShareLayout(layout, layoutJson.length);

      if (isValidationError(validationResult)) {
        return res.status(400).json({
          error: validationResult.error.message,
          code: validationResult.error.code,
        });
      }

      // Content filtering (layout shares only)
      const contentResult = filterLayoutContent(validationResult.layout);
      if (!contentResult.passed) {
        return res.status(400).json({
          error: `Content blocked: ${contentResult.reason}`,
          code: 'CONTENT_BLOCKED',
        });
      }

      sharePayload = validationResult.layout;
    }

    // Use client-provided layoutId as the share ID
    const shareId = layoutId;
    const blobPath = `shares/${shareId}.json`;

    // Fail-closed in production: if Redis is unavailable, the delete-token hash
    // can't be persisted (the share would be permanently unmodifiable).
    const redis = getRedis();
    if (!redis && process.env.VERCEL_ENV === 'production') {
      logger.error('Share creation failed: Redis unavailable, cannot persist delete token hash');
      return res.status(503).json({
        error: 'Service temporarily unavailable. Please try again.',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }

    const deleteToken = generateDeleteToken();
    const deleteTokenHash = await hashToken(deleteToken);

    const nowIso = new Date().toISOString();

    // deleteTokenHash and reportCount are in Redis, not in the public blob,
    // to prevent exposure via the CDN URL. lastAccessedAt is also in Redis
    // (share:lastAccessed:{id}); we omit it from the blob to avoid persisting
    // a permanently-stale creation-time value that could mislead future
    // tooling reading directly from the blob.
    const shareData: ShareData = {
      layout: sharePayload,
      metadata: {
        createdAt: nowIso,
        lastUpdatedAt: nowIso,
        permission,
        authorName: typeof authorName === 'string' ? authorName.slice(0, 64) : undefined,
      },
    };

    // Acquire the slot atomically: put() with allowOverwrite=false is the CAS
    // primitive. Two concurrent POSTs racing on the same shareId produce
    // exactly one winner here; the loser throws and we return 409. This must
    // happen BEFORE the Redis hash write — otherwise the loser's hash could
    // clobber the winner's hash in Redis (the original bug).
    //
    // SECURITY: allowOverwrite MUST stay false. The MED-1 race fix depends on
    // it. Don't rely on the library default (which is currently false but
    // could change in a future major version).
    try {
      await put(blobPath, JSON.stringify(shareData), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: false,
      });
    } catch (putErr) {
      // The blob already exists (or some other put failure). Probe with head()
      // to distinguish "lost the race" from genuine errors.
      const collided = await head(blobPath).catch(() => null);
      if (collided) {
        return res.status(409).json({
          error: 'A share with this ID already exists.',
          code: ErrorCode.VALIDATION_ERROR,
        });
      }
      throw putErr;
    }

    // Persist delete-token hash now that we own the slot. If Redis fails here
    // we must roll back the blob, otherwise we'd leave an orphan share with
    // no delete token (permanently unmodifiable).
    if (redis) {
      try {
        await redis.set(shareHashKey(shareId), deleteTokenHash);
      } catch (redisErr) {
        await del(blobPath).catch((delErr: unknown) => {
          logger.error('Rollback failed: orphan blob left after Redis write failure', {
            id: shareId,
            error: delErr instanceof Error ? delErr.message : String(delErr),
          });
        });
        throw redisErr;
      }
    }

    // Return success response
    const shareUrl = `${getBaseUrl()}/${type === 'designer' ? 'd' : 'l'}/${shareId}`;

    return res.status(201).json({
      id: shareId,
      url: shareUrl,
      deleteToken,
      permission,
    });
  } catch (error) {
    logger.error('Share creation error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      error: 'Failed to create share',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
