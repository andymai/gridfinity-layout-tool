import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import { ErrorCode } from '../../lib/shared.js';
import { logger } from '../../lib/logger.js';
import { checkRateLimit, getRedis } from '../../lib/rateLimit.js';
import { requireSession } from '../../lib/session.js';
import { validateDesignerShare } from '../../lib/designerValidation.js';
import { sanitizeString } from '../../lib/validation.js';
import { deleteBlob, getJson, putJson } from '../../lib/blobStore.js';
import { getEntry, tombstone, upsertEntry, type IndexEntry } from '../../lib/userIndex.js';
import { checkQuota } from '../../lib/quota.js';
import { compareForTiebreaker } from '../../lib/lwwTiebreaker.js';

export const SCHEMA_VERSION = 1 as const;

/** Max length for a user-visible design name (mirrors `inserts[].label`). */
const MAX_NAME_LENGTH = 100;

interface DesignEnvelope {
  /** `{ name, params }` wrapper; readers parse with `unwrapDesignPayload`. */
  design: unknown;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * GET    /api/sync/designs/{id}
 * PUT    /api/sync/designs/{id}   — body { design, modifiedAt }. `design`
 *                                    is `{ name, params }` (new shape) or
 *                                    bare BinParams (legacy, still accepted).
 * DELETE /api/sync/designs/{id}
 *
 * Mirrors the layouts endpoint's LWW + tombstone semantics.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PUT', 'DELETE'])) return;

  const session = await requireSession(req, res);
  if (!session) return;

  const id = singleParam(req.query.id);
  if (!id || !isValidDesignId(id)) {
    res.status(400).json({ error: 'Invalid design id', code: ErrorCode.VALIDATION_ERROR });
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
    logger.error('sync/designs handler failed', {
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
  const entry = await getEntry(redis, userId, 'designs', id);
  if (!entry) {
    res.status(404).json({ error: 'Not found', code: ErrorCode.NOT_FOUND });
    return;
  }
  if (entry.deletedAt !== undefined) {
    res.status(410).json({ error: 'Deleted', code: ErrorCode.NOT_FOUND, indexEntry: entry });
    return;
  }
  const envelope = await getJson<DesignEnvelope>(blobPath(userId, id));
  if (!envelope) {
    res.status(404).json({ error: 'Not found', code: ErrorCode.NOT_FOUND });
    return;
  }
  res.status(200).json({ envelope, indexEntry: entry });
}

interface PutBody {
  design: unknown;
  modifiedAt: unknown;
}

/**
 * Split `design` into `{ name, params }`. New shape carries a `params`
 * field; legacy shape is bare `BinParams` (no nested `params`), so the
 * two are unambiguous. Returns `null` if the wrapper is malformed (e.g.
 * `name` is present but isn't a string) so the caller can 400.
 */
function unwrapDesignPayload(design: unknown): { name: string | null; params: unknown } | null {
  if (design === null || typeof design !== 'object') return null;
  const { name, params } = design as { name?: unknown; params?: unknown };
  if (typeof params === 'object' && params !== null) {
    // Wrapper shape: name must be a string or absent. Reject other types
    // so malformed clients can't silently drop the user-visible field.
    if (name !== undefined && typeof name !== 'string') return null;
    return { name: name ?? null, params };
  }
  return { name: null, params: design };
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
  const { design, modifiedAt } = body;
  if (typeof modifiedAt !== 'number' || !Number.isFinite(modifiedAt)) {
    res
      .status(400)
      .json({ error: 'modifiedAt must be a number (ms epoch)', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const unwrapped = unwrapDesignPayload(design);
  if (!unwrapped) {
    res.status(400).json({
      error: 'design must be an object with a string `name`',
      code: ErrorCode.VALIDATION_ERROR,
    });
    return;
  }
  // Mirror the share validator's handling of user-visible strings: strip
  // null bytes and control chars, trim, and truncate. Legacy bare-params
  // posts have no name; they persist as '' and the adapter falls back.
  const name = sanitizeString(unwrapped.name ?? '', MAX_NAME_LENGTH);

  // Reuse the share-payload validator. `sizeBytes` measures name + params
  // together so the size cap, quota math, and stored envelope all agree.
  const validationPayload = {
    type: 'designer' as const,
    version: 1 as const,
    params: unwrapped.params,
  };
  const sizeBytes = Buffer.byteLength(JSON.stringify({ name, ...validationPayload }), 'utf8');
  const validation = validateDesignerShare(validationPayload, sizeBytes);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error.message, code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const existing = await getEntry(redis, userId, 'designs', id);
  // `deletedAt === undefined` is the explicit live-entry check.
  if (existing && existing.deletedAt === undefined) {
    if (existing.modifiedAt > modifiedAt) {
      const stored = await getJson<DesignEnvelope>(blobPath(userId, id));
      res.status(409).json({
        error: 'A newer version already exists.',
        code: ErrorCode.VALIDATION_ERROR,
        stored,
        indexEntry: existing,
      });
      return;
    }
    if (existing.modifiedAt === modifiedAt) {
      // Equal-ms tie: hash over `{ name, params }` so renames also participate.
      const stored = await getJson<DesignEnvelope>(blobPath(userId, id));
      // See layouts/[id].ts for the missing-blob rationale.
      if (stored !== null) {
        const candidate = { name, params: validation.payload.params };
        const order = compareForTiebreaker(candidate, stored.design);
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

  if (existing?.deletedAt !== undefined && existing.deletedAt >= modifiedAt) {
    res.status(410).json({
      error: 'Design was deleted on another device. Save again to restore.',
      code: ErrorCode.NOT_FOUND,
      indexEntry: existing,
    });
    return;
  }

  const replacingId = existing && existing.deletedAt === undefined ? id : undefined;
  const quota = await checkQuota(redis, userId, 'designs', {
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

  // Always emit the new wrapper shape. Legacy posts become `name = ''`;
  // readers fall back from there.
  const envelope: DesignEnvelope = {
    design: { name, params: validation.payload.params },
    modifiedAt,
    schemaVersion: SCHEMA_VERSION,
  };
  await putJson(blobPath(userId, id), envelope, { allowOverwrite: true });

  const newEntry: IndexEntry = { modifiedAt, sizeBytes };
  await upsertEntry(redis, userId, 'designs', id, newEntry);

  res.status(200).json({ envelope, indexEntry: newEntry });
}

async function handleDelete(
  res: VercelResponse,
  redis: ReturnType<typeof getRedis> & object,
  userId: string,
  id: string
): Promise<void> {
  const existing = await getEntry(redis, userId, 'designs', id);
  // Already tombstoned: don't try to delete the blob (it's already gone)
  // and don't bump the tombstone timestamp.
  if (existing?.deletedAt !== undefined) {
    res.status(204).end();
    return;
  }
  if (!existing) {
    await tombstone(redis, userId, 'designs', id, Date.now());
    res.status(204).end();
    return;
  }
  await deleteBlob(blobPath(userId, id));
  await tombstone(redis, userId, 'designs', id, Date.now());
  res.status(204).end();
}

function blobPath(userId: string, id: string): string {
  return `users/${userId}/designs/${id}.json`;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Bin Designer designs use the `design_<ms-epoch>_<6-char-base36>` shape
 * generated by `generateDesignId` in `DesignerStorage.ts`. Older shares may
 * also surface UUIDs, base36-timestamp ids, or 12-char alphanumeric ids, so
 * accept those too for round-trip with the share feature.
 */
function isValidDesignId(id: string): boolean {
  if (/^design_\d+_[a-z0-9]{6}$/.test(id)) return true;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return true;
  if (/^[a-z0-9]+-[a-z0-9]{7}$/.test(id)) return true;
  if (/^[a-zA-Z0-9]{12}$/.test(id)) return true;
  return false;
}
