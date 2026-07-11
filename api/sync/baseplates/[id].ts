import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import { ErrorCode } from '../../lib/shared.js';
import { logger } from '../../lib/logger.js';
import { checkRateLimit, getRedis } from '../../lib/rateLimit.js';
import { requireSession } from '../../lib/session.js';
import { validateBaseplateShare } from '../../lib/baseplateValidation.js';
import { sanitizeString } from '../../lib/validation.js';
import { deleteBlob, getJson, putJson } from '../../lib/blobStore.js';
import { getEntry, tombstone, upsertEntry, type IndexEntry } from '../../lib/userIndex.js';
import { checkQuota } from '../../lib/quota.js';
import { compareForTiebreaker } from '../../lib/lwwTiebreaker.js';

export const SCHEMA_VERSION = 1 as const;

/** Max length for a user-visible baseplate name (mirrors the designs cap). */
const MAX_NAME_LENGTH = 100;

interface BaseplateEnvelope {
  /** `{ name, params }` wrapper; readers parse with `unwrapBaseplatePayload`. */
  baseplate: unknown;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * GET    /api/sync/baseplates/{id}
 * PUT    /api/sync/baseplates/{id}  — body { baseplate, modifiedAt }. `baseplate`
 *                                     is `{ name, params }` (new shape) or bare
 *                                     params (legacy/tolerant, still accepted).
 * DELETE /api/sync/baseplates/{id}
 *
 * Mirrors the designs endpoint's LWW + tombstone semantics.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PUT', 'DELETE'])) return;

  const session = await requireSession(req, res);
  if (!session) return;

  const id = singleParam(req.query.id);
  if (!id || !isValidBaseplateId(id)) {
    res.status(400).json({ error: 'Invalid baseplate id', code: ErrorCode.VALIDATION_ERROR });
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
    logger.error('sync/baseplates handler failed', {
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
  const entry = await getEntry(redis, userId, 'baseplates', id);
  if (!entry) {
    res.status(404).json({ error: 'Not found', code: ErrorCode.NOT_FOUND });
    return;
  }
  if (entry.deletedAt !== undefined) {
    res.status(410).json({ error: 'Deleted', code: ErrorCode.NOT_FOUND, indexEntry: entry });
    return;
  }
  const envelope = await getJson<BaseplateEnvelope>(blobPath(userId, id));
  if (!envelope) {
    res.status(404).json({ error: 'Not found', code: ErrorCode.NOT_FOUND });
    return;
  }
  res.status(200).json({ envelope, indexEntry: entry });
}

interface PutBody {
  baseplate: unknown;
  modifiedAt: unknown;
}

/**
 * Split `baseplate` into `{ name, params }`. New shape carries a `params`
 * field; a bare params object (no nested `params`) is tolerated too, so the
 * two are unambiguous. Returns `null` if the wrapper is malformed (e.g. `name`
 * is present but isn't a string) so the caller can 400.
 */
function unwrapBaseplatePayload(
  baseplate: unknown
): { name: string | null; params: unknown } | null {
  if (baseplate === null || typeof baseplate !== 'object') return null;
  const { name, params } = baseplate as { name?: unknown; params?: unknown };
  if (typeof params === 'object' && params !== null) {
    if (name !== undefined && typeof name !== 'string') return null;
    return { name: name ?? null, params };
  }
  return { name: null, params: baseplate };
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
  const { baseplate, modifiedAt } = body;
  if (typeof modifiedAt !== 'number' || !Number.isFinite(modifiedAt)) {
    res
      .status(400)
      .json({ error: 'modifiedAt must be a number (ms epoch)', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const unwrapped = unwrapBaseplatePayload(baseplate);
  if (!unwrapped) {
    res.status(400).json({
      error: 'baseplate must be an object with a string `name`',
      code: ErrorCode.VALIDATION_ERROR,
    });
    return;
  }
  const name = sanitizeString(unwrapped.name ?? '', MAX_NAME_LENGTH);

  // Two byte counts: `preValidationBytes` is what the validator's size cap
  // sees (a CPU guard); `sizeBytes` is what we store after sanitization and
  // what the quota check + index entry track.
  const validationPayload = {
    type: 'baseplate' as const,
    version: 1 as const,
    params: unwrapped.params,
  };
  const preValidationBytes = Buffer.byteLength(
    JSON.stringify({ name, ...validationPayload }),
    'utf8'
  );
  const validation = validateBaseplateShare(validationPayload, preValidationBytes);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error.message, code: ErrorCode.VALIDATION_ERROR });
    return;
  }
  const sizeBytes = Buffer.byteLength(
    JSON.stringify({
      name,
      type: 'baseplate',
      version: 1,
      params: validation.payload.params,
    }),
    'utf8'
  );

  const existing = await getEntry(redis, userId, 'baseplates', id);
  if (existing && existing.deletedAt === undefined) {
    if (existing.modifiedAt > modifiedAt) {
      const stored = await getJson<BaseplateEnvelope>(blobPath(userId, id));
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
      const stored = await getJson<BaseplateEnvelope>(blobPath(userId, id));
      if (stored !== null) {
        const candidate = { name, params: validation.payload.params };
        const order = compareForTiebreaker(candidate, stored.baseplate);
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
      error: 'Baseplate was deleted on another device. Save again to restore.',
      code: ErrorCode.NOT_FOUND,
      indexEntry: existing,
    });
    return;
  }

  const replacingId = existing && existing.deletedAt === undefined ? id : undefined;
  const quota = await checkQuota(redis, userId, 'baseplates', {
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

  // Always emit the new wrapper shape. Bare-params posts become `name = ''`;
  // readers fall back from there.
  const envelope: BaseplateEnvelope = {
    baseplate: { name, params: validation.payload.params },
    modifiedAt,
    schemaVersion: SCHEMA_VERSION,
  };
  await putJson(blobPath(userId, id), envelope, { allowOverwrite: true });

  const newEntry: IndexEntry = { modifiedAt, sizeBytes };
  await upsertEntry(redis, userId, 'baseplates', id, newEntry);

  res.status(200).json({ envelope, indexEntry: newEntry });
}

async function handleDelete(
  res: VercelResponse,
  redis: ReturnType<typeof getRedis> & object,
  userId: string,
  id: string
): Promise<void> {
  const existing = await getEntry(redis, userId, 'baseplates', id);
  // Already tombstoned: don't try to delete the blob (it's already gone)
  // and don't bump the tombstone timestamp.
  if (existing?.deletedAt !== undefined) {
    res.status(204).end();
    return;
  }
  if (!existing) {
    await tombstone(redis, userId, 'baseplates', id, Date.now());
    res.status(204).end();
    return;
  }
  await deleteBlob(blobPath(userId, id));
  await tombstone(redis, userId, 'baseplates', id, Date.now());
  res.status(204).end();
}

function blobPath(userId: string, id: string): string {
  return `users/${userId}/baseplates/${id}.json`;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Baseplate library ids use the `baseplate_<ms-epoch>_<base36>` shape generated
 * by `generateBaseplateDesignId` in `BaseplateStorage.ts`
 * (`baseplate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`). The
 * base36 suffix is up to 6 chars but can be shorter, so accept 1–8. The three
 * legacy share shapes (UUID, base36 timestamp, 12-char alphanumeric) are also
 * accepted to match `designs`/`layouts`, so ids round-trip without renaming.
 */
function isValidBaseplateId(id: string): boolean {
  if (/^baseplate_\d+_[a-z0-9]{1,8}$/.test(id)) return true;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return true;
  if (/^[a-z0-9]+-[a-z0-9]{7}$/.test(id)) return true;
  if (/^[a-zA-Z0-9]{12}$/.test(id)) return true;
  return false;
}
