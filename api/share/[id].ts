import { put, del, BlobPreconditionFailedError } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import {
  validateShareLayout,
  withoutLibraryPlacement,
  isValidationError,
  validateSharedDesigns,
  isSharedDesignsError,
  sharedDesignMeshHashes,
} from '../lib/validation.js';
import { holdShareMeshes } from '../lib/meshIndex.js';
import { resolveShareMeshFiles } from '../lib/shareMeshes.js';
import { filterLayoutContent, filterSharedDesignsContent } from '../lib/contentFilter.js';
import { logger } from '../lib/logger.js';
import {
  isValidShareId,
  hashToken,
  timingSafeCompare,
  ErrorCode,
  methodNotAllowed,
  getBaseUrl,
  shareHashKey,
  shareReportKey,
  shareLastAccessedKey,
  sharePermissionKey,
  SHARE_LAST_ACCESSED_TTL_SECONDS,
  resolveSharePermission,
  recordSharePermission,
  type ShareData,
  rateLimited,
  sendError,
  contentBlocked,
  loadShare,
  loadShareVersion,
} from '../lib/shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (typeof id !== 'string' || !isValidShareId(id)) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid share ID');
  }

  const blobPath = `shares/${id}.json`;

  switch (req.method) {
    case 'OPTIONS':
      return res.status(200).end();
    case 'GET':
      return handleGet(req, res, id, blobPath);
    case 'PUT':
      return handlePut(req, res, id, blobPath);
    case 'DELETE':
      return handleDelete(req, res, id, blobPath);
    default:
      return methodNotAllowed(res, 'GET, PUT, DELETE');
  }
}

/**
 * GET /api/share/[id] - Fetch a shared layout
 */
async function handleGet(req: VercelRequest, res: VercelResponse, _id: string, blobPath: string) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'view');

    if (!rateLimit.allowed) {
      return rateLimited(res, rateLimit.retryAfterSeconds);
    }

    const shareData = await loadShare(blobPath);
    if (!shareData) {
      return sendError(res, 404, ErrorCode.NOT_FOUND, 'Share not found');
    }

    // Track lastAccessedAt in Redis instead of rewriting the blob on every GET.
    // Cheap, atomic, and avoids the per-view Blob-write amplification that
    // existed when this was a put() with allowOverwrite=false (which silently
    // errored every time). Fire-and-forget — never block the response.
    const redisForAccess = getRedis();
    if (redisForAccess) {
      redisForAccess
        .set(
          shareLastAccessedKey(_id),
          new Date().toISOString(),
          'EX',
          SHARE_LAST_ACCESSED_TTL_SECONDS
        )
        .catch((err: unknown) => {
          logger.warn('Failed to update lastAccessedAt for share', {
            id: _id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }

    // Return layout with public metadata (exclude sensitive fields)
    return res.status(200).json({
      layout: shareData.layout,
      linkedDesigns: shareData.linkedDesigns,
      meshFiles: shareData.meshFiles,
      metadata: {
        createdAt: shareData.metadata.createdAt,
        lastUpdatedAt: shareData.metadata.lastUpdatedAt,
        permission: await resolveSharePermission(getRedis(), _id, shareData),
        authorName: shareData.metadata.authorName,
      },
    });
  } catch (error) {
    logger.error('Share fetch error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to fetch share');
  }
}

/**
 * Tries before a PUT gives up because other writes keep landing between its
 * read and its write.
 */
const MAX_PUT_ATTEMPTS = 3;

/**
 * The stamp for a write over a blob stamped `previous`: now, or 1 ms after
 * `previous` when this server's clock does not run past it. A retry can run on
 * a server whose clock is behind the one that wrote the blob.
 */
function laterRevision(previous: string | undefined): string {
  const now = Date.now();
  const last = previous ? Date.parse(previous) : Number.NaN;
  return new Date(Number.isFinite(last) && last >= now ? last + 1 : now).toISOString();
}

/**
 * PUT /api/share/[id] - Update an existing share
 *
 * Each write is conditional on the blob it read. A collab room records the
 * `lastUpdatedAt` of each save and keeps the latest one, so the write that
 * lands last must also carry the latest stamp. An unconditional write lets a
 * slow request land after a newer one with an older stamp.
 */
async function handlePut(req: VercelRequest, res: VercelResponse, id: string, blobPath: string) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'update');

    if (!rateLimit.allowed) {
      return rateLimited(res, rateLimit.retryAfterSeconds, 'Too many updates. Try again later.');
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const { layout, permission, deleteToken, linkedDesigns } = body;

    if (!deleteToken || typeof deleteToken !== 'string') {
      return sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Delete token required for updates');
    }

    let loaded = await loadShareVersion(blobPath);
    if (!loaded) {
      return sendError(res, 404, ErrorCode.NOT_FOUND, 'Share not found');
    }

    const tokenCheck = await verifyDeleteToken(id, loaded.data, deleteToken);
    if (tokenCheck === 'missing') {
      return sendError(res, 404, ErrorCode.NOT_FOUND, 'Share not found');
    }
    if (tokenCheck === 'mismatch') {
      return sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Invalid delete token');
    }

    const permissionFor = async (
      existing: ShareData
    ): Promise<ShareData['metadata']['permission'] | null> => {
      const value: unknown = permission ?? (await resolveSharePermission(getRedis(), id, existing));
      return value === 'view' || value === 'edit' ? value : null;
    };
    const invalidPermission = () =>
      sendError(
        res,
        400,
        ErrorCode.VALIDATION_ERROR,
        'Invalid permission. Must be "view" or "edit".'
      );

    let newPermission = await permissionFor(loaded.data);
    if (!newPermission) return invalidPermission();

    // A permission-only update (no layout) keeps the stored content.
    let content: Omit<ShareData, 'metadata'> | null = null;
    if (layout) {
      const layoutJson = JSON.stringify(layout);
      const validationResult = validateShareLayout(layout, layoutJson.length);

      if (isValidationError(validationResult)) {
        return res.status(400).json({
          error: validationResult.error.message,
          code: validationResult.error.code,
        });
      }

      // Content filtering
      const contentResult = filterLayoutContent(validationResult.layout);
      if (!contentResult.passed) return contentBlocked(res, contentResult);

      const designsResult = validateSharedDesigns(linkedDesigns);
      if (isSharedDesignsError(designsResult)) {
        return res.status(400).json({
          error: designsResult.error.message,
          code: designsResult.error.code,
        });
      }

      const designContent = filterSharedDesignsContent(designsResult.designs);
      if (!designContent.passed) return contentBlocked(res, designContent);

      const meshFiles = await resolveShareMeshFiles(
        req,
        res,
        sharedDesignMeshHashes(designsResult.designs)
      );
      if (!meshFiles) return;

      content = {
        layout: withoutLibraryPlacement(validationResult.layout),
        ...(designsResult.designs.length > 0 ? { linkedDesigns: designsResult.designs } : {}),
        ...(Object.keys(meshFiles).length > 0 ? { meshFiles } : {}),
      };

      // Held before the write, so no file the share names goes unheld.
      const redis = getRedis();
      if (redis) await holdShareMeshes(redis, id, Object.keys(meshFiles));
    }

    for (let attempt = 1; ; attempt++) {
      const now = laterRevision(loaded.data.metadata.lastUpdatedAt);

      // Strip the legacy lastAccessedAt field on any rewrite — its source of
      // truth is now Redis (share:lastAccessed:{id}). Preserving the spread
      // would carry forward the stale creation-time value indefinitely.
      const { lastAccessedAt: _drop, ...metadataWithoutAccess } = loaded.data.metadata;
      void _drop;

      const updatedData: ShareData = {
        ...(content ?? loaded.data),
        metadata: {
          ...metadataWithoutAccess,
          permission: newPermission,
          lastUpdatedAt: now,
        },
      };

      try {
        await writeShare(id, blobPath, updatedData, newPermission, loaded.etag);
        return respondShare(res, id, newPermission, now);
      } catch (error) {
        if (!(error instanceof BlobPreconditionFailedError)) throw error;
        if (attempt === MAX_PUT_ATTEMPTS) {
          return sendError(
            res,
            503,
            ErrorCode.SERVICE_UNAVAILABLE,
            'The share changed during the update. Try again.'
          );
        }
      }

      const reloaded = await loadShareVersion(blobPath);
      if (!reloaded || (await verifyDeleteToken(id, reloaded.data, deleteToken)) !== 'ok') {
        return sendError(res, 404, ErrorCode.NOT_FOUND, 'Share not found');
      }
      loaded = reloaded;
      newPermission = await permissionFor(loaded.data);
      if (!newPermission) return invalidPermission();
    }
  } catch (error) {
    logger.error('Share update error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to update share');
  }
}

/**
 * DELETE /api/share/[id] - Delete a share
 */
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  _id: string,
  blobPath: string
) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'delete');

    if (!rateLimit.allowed) {
      return rateLimited(
        res,
        rateLimit.retryAfterSeconds,
        'Too many delete attempts. Try again later.'
      );
    }

    // Get delete token from header or body
    const deleteBody = (req.body ?? {}) as Record<string, unknown>;
    const deleteToken =
      (req.headers['x-delete-token'] as string | undefined) ??
      (typeof deleteBody.deleteToken === 'string' ? deleteBody.deleteToken : undefined);

    if (!deleteToken) {
      return sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Delete token required');
    }

    const existingData = await loadShare(blobPath);
    if (!existingData) {
      return sendError(res, 404, ErrorCode.NOT_FOUND, 'Share not found');
    }

    const tokenCheck = await verifyDeleteToken(_id, existingData, deleteToken);
    if (tokenCheck === 'missing') {
      return sendError(res, 404, ErrorCode.NOT_FOUND, 'Share not found');
    }
    if (tokenCheck === 'mismatch') {
      return sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Invalid delete token');
    }

    // Delete the blob and clean up Redis keys. The share's mesh holds stay, with
    // their record in `share:meshes:{id}`: an update already past its token
    // check can still write the share back, and it must find its files held.
    await del(blobPath);
    const redis = getRedis();
    if (redis) {
      await redis.del(
        shareHashKey(_id),
        shareReportKey(_id),
        shareLastAccessedKey(_id),
        sharePermissionKey(_id)
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Share deleted successfully',
    });
  } catch (error) {
    logger.error('Share delete error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to delete share');
  }
}

async function verifyDeleteToken(
  id: string,
  existing: ShareData,
  deleteToken: string
): Promise<'ok' | 'missing' | 'mismatch'> {
  // New shares keep the hash in Redis; pre-migration shares carry it in the blob.
  const redis = getRedis();
  const storedHash =
    (redis ? await redis.get(shareHashKey(id)) : null) ?? existing.metadata.deleteTokenHash;
  if (!storedHash) return 'missing';
  return timingSafeCompare(await hashToken(deleteToken), storedHash) ? 'ok' : 'mismatch';
}

async function writeShare(
  id: string,
  blobPath: string,
  data: ShareData,
  permission: ShareData['metadata']['permission'],
  ifMatch: string
): Promise<void> {
  await put(blobPath, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    ifMatch,
  });
  await recordSharePermission(getRedis(), id, permission);
}

function respondShare(
  res: VercelResponse,
  id: string,
  permission: ShareData['metadata']['permission'],
  lastUpdatedAt: string
) {
  return res.status(200).json({ id, url: `${getBaseUrl()}/l/${id}`, permission, lastUpdatedAt });
}
