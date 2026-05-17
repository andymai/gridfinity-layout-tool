import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import { ErrorCode } from '../../lib/shared.js';
import { logger } from '../../lib/logger.js';
import { checkRateLimit, getRedis } from '../../lib/rateLimit.js';
import { requireSession } from '../../lib/session.js';
import { isValidationError, validateShareLayout } from '../../lib/validation.js';
import { deleteBlob, getJson, putJson } from '../../lib/blobStore.js';
import { getEntry, tombstone, upsertEntry, type IndexEntry } from '../../lib/userIndex.js';
import { checkQuota } from '../../lib/quota.js';
import { compareForTiebreaker } from '../../lib/lwwTiebreaker.js';

export const SCHEMA_VERSION = 1 as const;

interface LayoutEnvelope {
  layout: unknown;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * GET    /api/sync/layouts/{id}   — fetch envelope (200 / 404 / 410)
 * PUT    /api/sync/layouts/{id}   — body { layout, modifiedAt }; LWW
 *                                    409 if remote is newer; 410 if a
 *                                    stale resurrect would clobber a
 *                                    tombstone newer than the edit.
 * DELETE /api/sync/layouts/{id}   — tombstone + blob delete (204)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PUT', 'DELETE'])) return;

  const session = await requireSession(req, res);
  if (!session) return;

  const id = singleParam(req.query.id);
  if (!id || !isValidLayoutId(id)) {
    res.status(400).json({ error: 'Invalid layout id', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const action = req.method === 'GET' ? 'sync.read' : 'sync.write';
  const rate = await checkRateLimit(session.userId, action);
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
    if (req.method === 'GET') {
      await handleGet(res, redis, session.userId, id);
    } else if (req.method === 'PUT') {
      await handlePut(req, res, redis, session.userId, id);
    } else {
      await handleDelete(res, redis, session.userId, id);
    }
  } catch (error) {
    logger.error('sync/layouts handler failed', {
      userId: session.userId,
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Server error', code: ErrorCode.SERVER_ERROR });
  }
}

async function handleGet(
  res: VercelResponse,
  redis: ReturnType<typeof getRedis> & object,
  userId: string,
  id: string
): Promise<void> {
  const entry = await getEntry(redis, userId, 'layouts', id);
  if (!entry) {
    res.status(404).json({ error: 'Not found', code: ErrorCode.NOT_FOUND });
    return;
  }
  if (entry.deletedAt !== undefined) {
    res.status(410).json({ error: 'Deleted', code: ErrorCode.NOT_FOUND, indexEntry: entry });
    return;
  }
  const envelope = await getJson<LayoutEnvelope>(blobPath(userId, id));
  if (!envelope) {
    // Blob missing but index says it should exist — treat as 404 so the
    // client refreshes its view. Don't 500 since the user can't act on it.
    res.status(404).json({ error: 'Not found', code: ErrorCode.NOT_FOUND });
    return;
  }
  res.status(200).json({ envelope, indexEntry: entry });
}

interface PutBody {
  layout: unknown;
  modifiedAt: unknown;
}

async function handlePut(
  req: VercelRequest,
  res: VercelResponse,
  redis: ReturnType<typeof getRedis> & object,
  userId: string,
  id: string
): Promise<void> {
  const body = req.body as PutBody | undefined;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Missing body', code: ErrorCode.VALIDATION_ERROR });
    return;
  }
  const { layout, modifiedAt } = body;
  if (typeof modifiedAt !== 'number' || !Number.isFinite(modifiedAt)) {
    res
      .status(400)
      .json({ error: 'modifiedAt must be a number (ms epoch)', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  // Two byte counts intentionally: `preValidationBytes` is what the
  // validator's 500 KB size cap sees — purely a CPU guard against huge
  // inputs. `sizeBytes` is what we actually store after sanitization, and
  // it's what the quota check and index entry track. Without the split,
  // users get charged for bytes the validator stripped and the index
  // drifts from what the blob holds.
  const preValidationBytes = Buffer.byteLength(JSON.stringify({ layout }), 'utf8');
  const validation = validateShareLayout(layout, preValidationBytes);
  if (isValidationError(validation)) {
    res.status(400).json({ error: validation.error.message, code: validation.error.code });
    return;
  }
  const sizeBytes = Buffer.byteLength(JSON.stringify({ layout: validation.layout }), 'utf8');

  const existing = await getEntry(redis, userId, 'layouts', id);

  // LWW comparison. `deletedAt === undefined` is the explicit live-entry
  // check — `!existing.deletedAt` would also accept 0/NaN, which would
  // misclassify any future tombstone written with such a value.
  if (existing && existing.deletedAt === undefined) {
    if (existing.modifiedAt > modifiedAt) {
      const stored = await getJson<LayoutEnvelope>(blobPath(userId, id));
      res.status(409).json({
        error: 'A newer version already exists.',
        code: ErrorCode.VALIDATION_ERROR,
        stored,
        indexEntry: existing,
      });
      return;
    }
    if (existing.modifiedAt === modifiedAt) {
      // Equal-ms tie: deterministic tiebreaker so concurrent devices converge.
      const stored = await getJson<LayoutEnvelope>(blobPath(userId, id));
      // Blob missing while index entry exists = divergence (deleted blob,
      // failed prior write, etc.). Let the candidate repair it instead of
      // running a tiebreaker against `undefined`, which would arbitrarily
      // 409 a write that could have fixed the gap.
      if (stored !== null) {
        const order = compareForTiebreaker(validation.layout, stored.layout);
        if (order <= 0) {
          res.status(409).json({
            error: 'A newer version already exists.',
            code: ErrorCode.VALIDATION_ERROR,
            stored,
            indexEntry: existing,
          });
          return;
        }
      }
    }
  }

  // Tombstone protection: a stale edit can't resurrect a deletion that
  // happened *after* the local change.
  if (existing?.deletedAt !== undefined && existing.deletedAt >= modifiedAt) {
    res.status(410).json({
      error: 'Layout was deleted on another device. Save again to restore.',
      code: ErrorCode.NOT_FOUND,
      indexEntry: existing,
    });
    return;
  }

  // Quota: replacing if the existing entry is live (tombstones don't count).
  const replacingId = existing && existing.deletedAt === undefined ? id : undefined;
  const quota = await checkQuota(redis, userId, 'layouts', {
    op: 'put',
    sizeBytes,
    replacingId,
  });
  if (!quota.ok) {
    res.status(413).json({
      error: `Quota exceeded (${quota.error.reason}): ${quota.error.current} of ${quota.error.limit}.`,
      code: ErrorCode.SIZE_LIMIT,
    });
    return;
  }

  const envelope: LayoutEnvelope = {
    layout: validation.layout,
    modifiedAt,
    schemaVersion: SCHEMA_VERSION,
  };
  await putJson(blobPath(userId, id), envelope, { allowOverwrite: true });

  const newEntry: IndexEntry = { modifiedAt, sizeBytes };
  await upsertEntry(redis, userId, 'layouts', id, newEntry);

  res.status(200).json({ envelope, indexEntry: newEntry });
}

async function handleDelete(
  res: VercelResponse,
  redis: ReturnType<typeof getRedis> & object,
  userId: string,
  id: string
): Promise<void> {
  const existing = await getEntry(redis, userId, 'layouts', id);
  // Already tombstoned: don't try to delete the blob (it's already gone)
  // and don't bump the tombstone timestamp — the original deletion is
  // the source of truth for LWW.
  if (existing?.deletedAt !== undefined) {
    res.status(204).end();
    return;
  }
  if (!existing) {
    // Never existed — write a tombstone so peer devices learn about
    // the deletion on next pull. Idempotent.
    await tombstone(redis, userId, 'layouts', id, Date.now());
    res.status(204).end();
    return;
  }
  await deleteBlob(blobPath(userId, id));
  await tombstone(redis, userId, 'layouts', id, Date.now());
  res.status(204).end();
}

function blobPath(userId: string, id: string): string {
  return `users/${userId}/layouts/${id}.json`;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Layouts the client may sync share three id formats with the existing
 * share feature (UUID, base36 timestamp, 12-char alphanumeric); we accept
 * the same shapes here so layouts can be round-tripped between local
 * storage and the cloud without renaming.
 */
function isValidLayoutId(id: string): boolean {
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return true;
  if (/^[a-z0-9]+-[a-z0-9]{7}$/.test(id)) return true;
  if (/^[a-zA-Z0-9]{12}$/.test(id)) return true;
  return false;
}
