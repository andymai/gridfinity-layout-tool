/**
 * Shared GET/PUT/DELETE skeleton for the per-item sync resources
 * (layouts/designs/baseplates). The three handlers were ~80% identical; the
 * genuinely per-resource part — parsing and validating the PUT payload and
 * shaping the stored envelope — stays in each resource's `buildPut`.
 *
 * The skeleton owns the LWW semantics: 409 when the remote is newer, the
 * deterministic equal-ms tiebreaker (skipped when the blob is missing so a
 * candidate write can repair index/blob divergence), tombstone protection
 * (410 when a stale edit would resurrect a newer deletion), quota, and the
 * blob+index write pair.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import {
  rateLimited,
  serviceUnavailable,
  serverError,
  singleParam,
  sendError,
  sendJson,
  ErrorCode,
} from '../../lib/shared.js';
import { logger } from '../../lib/logger.js';
import { checkRateLimit, getRedis } from '../../lib/rateLimit.js';
import { requireSession } from '../../lib/session.js';
import { deleteBlob, getJson, putJson } from '../../lib/blobStore.js';
import { getEntry, tombstone, upsertEntry, type IndexEntry } from '../../lib/userIndex.js';
import { checkQuota } from '../../lib/quota.js';
import { compareForTiebreaker } from '../../lib/lwwTiebreaker.js';

type RedisClient = NonNullable<ReturnType<typeof getRedis>>;

export type SyncResourceKind = 'layouts' | 'designs' | 'baseplates';

export interface SyncEnvelope {
  modifiedAt: number;
  schemaVersion: number;
}

export type BuildPutResult<TEnvelope> =
  | {
      ok: true;
      envelope: TEnvelope;
      /** Stored byte size after sanitization — what quota and the index track. */
      sizeBytes: number;
      /** Candidate for the equal-ms tiebreaker; must mirror `storedComparable`. */
      tiebreakerCandidate: unknown;
    }
  | { ok: false; status: number; error: string; code: string };

export interface SyncResourceConfig<TEnvelope extends SyncEnvelope> {
  kind: SyncResourceKind;
  /** Key carrying the payload in the PUT body (`layout`/`design`/`baseplate`). */
  payloadKey: string;
  isValidId: (id: string) => boolean;
  invalidIdError: string;
  /** 410 message when a stale edit hits a newer tombstone. */
  deletedError: string;
  /** Validate the payload and shape the envelope; everything per-resource. */
  buildPut: (payload: unknown, modifiedAt: number) => BuildPutResult<TEnvelope>;
  /** Stored-side value handed to the equal-ms tiebreaker. */
  storedComparable: (stored: TEnvelope) => unknown;
}

export function createSyncResourceHandler<TEnvelope extends SyncEnvelope>(
  config: SyncResourceConfig<TEnvelope>
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  const blobPath = (userId: string, id: string): string =>
    `users/${userId}/${config.kind}/${id}.json`;

  async function handleGet(
    res: VercelResponse,
    redis: RedisClient,
    userId: string,
    id: string
  ): Promise<void> {
    const entry = await getEntry(redis, userId, config.kind, id);
    if (!entry) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Not found');
      return;
    }
    if (entry.deletedAt !== undefined) {
      sendJson(res, 410, { error: 'Deleted', code: ErrorCode.NOT_FOUND, indexEntry: entry });
      return;
    }
    const envelope = await getJson<TEnvelope>(blobPath(userId, id));
    if (!envelope) {
      // Blob missing but index says it should exist — treat as 404 so the
      // client refreshes its view. Don't 500 since the user can't act on it.
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Not found');
      return;
    }
    res.status(200).json({ envelope, indexEntry: entry });
  }

  async function handlePut(
    req: VercelRequest,
    res: VercelResponse,
    redis: RedisClient,
    userId: string,
    id: string
  ): Promise<void> {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Missing body');
      return;
    }
    const modifiedAt = body.modifiedAt;
    if (typeof modifiedAt !== 'number' || !Number.isFinite(modifiedAt)) {
      sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'modifiedAt must be a number (ms epoch)');
      return;
    }

    const built = config.buildPut(body[config.payloadKey], modifiedAt);
    if (!built.ok) {
      res.status(built.status).json({ error: built.error, code: built.code });
      return;
    }
    const { envelope, sizeBytes, tiebreakerCandidate } = built;

    const existing = await getEntry(redis, userId, config.kind, id);

    // LWW comparison. `deletedAt === undefined` is the explicit live-entry
    // check — `!existing.deletedAt` would also accept 0/NaN, which would
    // misclassify any future tombstone written with such a value.
    if (existing && existing.deletedAt === undefined) {
      if (existing.modifiedAt > modifiedAt) {
        const stored = await getJson<TEnvelope>(blobPath(userId, id));
        sendJson(res, 409, {
          error: 'A newer version already exists.',
          code: ErrorCode.VALIDATION_ERROR,
          stored,
          indexEntry: existing,
        });
        return;
      }
      if (existing.modifiedAt === modifiedAt) {
        // Equal-ms tie: deterministic tiebreaker so concurrent devices converge.
        const stored = await getJson<TEnvelope>(blobPath(userId, id));
        // Blob missing while index entry exists = divergence (deleted blob,
        // failed prior write, etc.). Let the candidate repair it instead of
        // running a tiebreaker against `undefined`, which would arbitrarily
        // 409 a write that could have fixed the gap.
        if (stored !== null) {
          const order = compareForTiebreaker(tiebreakerCandidate, config.storedComparable(stored));
          if (order <= 0) {
            sendJson(res, 409, {
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
      sendJson(res, 410, {
        error: config.deletedError,
        code: ErrorCode.NOT_FOUND,
        indexEntry: existing,
      });
      return;
    }

    // Quota: replacing if the existing entry is live (tombstones don't count).
    const replacingId = existing && existing.deletedAt === undefined ? id : undefined;
    const quota = await checkQuota(redis, userId, config.kind, {
      op: 'put',
      sizeBytes,
      replacingId,
    });
    if (!quota.ok) {
      sendError(
        res,
        413,
        ErrorCode.SIZE_LIMIT,
        `Quota exceeded (${quota.error.reason}): ${quota.error.current} of ${quota.error.limit}.`
      );
      return;
    }

    await putJson(blobPath(userId, id), envelope, { allowOverwrite: true });

    const newEntry: IndexEntry = { modifiedAt, sizeBytes };
    await upsertEntry(redis, userId, config.kind, id, newEntry);

    res.status(200).json({ envelope, indexEntry: newEntry });
  }

  async function handleDelete(
    res: VercelResponse,
    redis: RedisClient,
    userId: string,
    id: string
  ): Promise<void> {
    const existing = await getEntry(redis, userId, config.kind, id);
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
      await tombstone(redis, userId, config.kind, id, Date.now());
      res.status(204).end();
      return;
    }
    await deleteBlob(blobPath(userId, id));
    await tombstone(redis, userId, config.kind, id, Date.now());
    res.status(204).end();
  }

  return async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    if (!requireMethod(req, res, ['GET', 'PUT', 'DELETE'])) return;

    const session = await requireSession(req, res);
    if (!session) return;

    const id = singleParam(req.query.id);
    if (!id || !config.isValidId(id)) {
      sendError(res, 400, ErrorCode.VALIDATION_ERROR, config.invalidIdError);
      return;
    }

    const action = req.method === 'GET' ? 'sync.read' : 'sync.write';
    const rate = await checkRateLimit(session.userId, action);
    if (!rate.allowed) {
      rateLimited(res, rate.retryAfterSeconds);
      return;
    }

    const redis = getRedis();
    if (!redis) {
      serviceUnavailable(res);
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
      logger.error(`sync/${config.kind} handler failed`, {
        userId: session.userId,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
      });
      serverError(res);
    }
  };
}
