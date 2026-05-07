import type { Redis } from 'ioredis';
import { userIndexKey, userIndexUpdatedAtKey, type SyncItemKind } from './redisKeys.js';

export type { SyncItemKind } from './redisKeys.js';

/**
 * Per-item index entry stored as a JSON-encoded value in the user's
 * `users:{uid}:index:{kind}` hash.
 *
 *   modifiedAt  — ms since epoch, the LWW comparison value
 *   sizeBytes   — payload size, used by quota math (excluded for tombstones)
 *   deletedAt   — present only for tombstones; tombstones live forever
 */
export interface IndexEntry {
  modifiedAt: number;
  sizeBytes: number;
  deletedAt?: number;
}

/**
 * Read every entry in a user's index hash. Returns an empty object if the
 * user has nothing of this kind yet.
 */
export async function getIndex(
  redis: Redis,
  userId: string,
  kind: SyncItemKind
): Promise<Record<string, IndexEntry>> {
  const raw = await redis.hgetall(userIndexKey(userId, kind));
  const out: Record<string, IndexEntry> = {};
  for (const [id, encoded] of Object.entries(raw)) {
    const parsed = parseEntry(encoded);
    if (parsed) out[id] = parsed;
  }
  return out;
}

/** Read a single entry. Returns null if absent or malformed. */
export async function getEntry(
  redis: Redis,
  userId: string,
  kind: SyncItemKind,
  id: string
): Promise<IndexEntry | null> {
  const raw = await redis.hget(userIndexKey(userId, kind), id);
  if (raw === null) return null;
  return parseEntry(raw);
}

/**
 * Insert or replace an entry, atomically bumping `indexUpdatedAt` so
 * `/api/sync/manifest` can serve `If-Modified-Since` 304s without reading
 * the hash.
 */
export async function upsertEntry(
  redis: Redis,
  userId: string,
  kind: SyncItemKind,
  id: string,
  entry: IndexEntry
): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.hset(userIndexKey(userId, kind), id, JSON.stringify(entry));
  pipeline.set(userIndexUpdatedAtKey(userId), String(Date.now()));
  const run = pipeline.exec.bind(pipeline);
  const results = await run();
  if (results === null) throw new Error('userIndex pipeline failed: redis connection lost');
  for (const [err] of results) {
    if (err) throw err;
  }
}

/**
 * Mark an entry as a tombstone. Tombstones replace the live entry in the
 * same hash so manifest/poll logic doesn't have to merge two stores.
 *
 * `sizeBytes` is preserved as 0 — quota math excludes tombstones, but
 * keeping the field present means the on-the-wire shape is uniform.
 */
export async function tombstone(
  redis: Redis,
  userId: string,
  kind: SyncItemKind,
  id: string,
  deletedAt: number
): Promise<void> {
  await upsertEntry(redis, userId, kind, id, {
    modifiedAt: deletedAt,
    sizeBytes: 0,
    deletedAt,
  });
}

/**
 * Read the last-mutation timestamp used by the manifest's
 * `If-Modified-Since` cache. Returns 0 if the user has never written.
 */
export async function getIndexUpdatedAt(redis: Redis, userId: string): Promise<number> {
  const raw = await redis.get(userIndexUpdatedAtKey(userId));
  if (raw === null) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEntry(raw: string): IndexEntry | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Partial<IndexEntry>;
    // Reject NaN/Infinity — they would corrupt LWW comparisons (NaN
    // compares false to everything) and quota math (Infinity makes the
    // total unboundedly wrong). Same posture as `getIndexUpdatedAt`.
    if (!Number.isFinite(record.modifiedAt)) return null;
    if (!Number.isFinite(record.sizeBytes)) return null;
    if (record.deletedAt !== undefined && !Number.isFinite(record.deletedAt)) return null;
    return record as IndexEntry;
  } catch {
    return null;
  }
}
