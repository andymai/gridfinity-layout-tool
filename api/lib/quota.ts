import type { Redis } from 'ioredis';
import { getIndex, type SyncItemKind } from './userIndex.js';

/**
 * Per-kind caps. Tombstones are excluded from both axes — deleting an
 * item frees its slot and bytes immediately.
 *
 * Values match the existing `CONSTRAINTS.MAX_LAYOUTS = 100` and the
 * server-side payload cap of 500 KB per item × 100 items = ~50 MB
 * theoretical worst case, conservatively bounded to 10 MB total.
 */
const QUOTA: Record<SyncItemKind, { maxCount: number; maxBytes: number }> = {
  layouts: { maxCount: 100, maxBytes: 10 * 1024 * 1024 },
  designs: { maxCount: 100, maxBytes: 10 * 1024 * 1024 },
  baseplates: { maxCount: 100, maxBytes: 10 * 1024 * 1024 },
};

export type QuotaErrorReason = 'count' | 'bytes';

export interface QuotaError {
  type: 'QUOTA_EXCEEDED';
  reason: QuotaErrorReason;
  /** Current usage that would result if the write proceeded. */
  current: number;
  /** The cap that was hit. */
  limit: number;
}

export type QuotaCheck = { ok: true } | { ok: false; error: QuotaError };

export type QuotaIntent =
  | {
      op: 'put';
      /** Size of the new payload in bytes. */
      sizeBytes: number;
      /**
       * If this PUT replaces an existing live entry, its size is freed
       * before the new size is added — so `replacingId` lets the same
       * item be updated without consuming an extra slot or extra bytes.
       */
      replacingId?: string;
    }
  | { op: 'delete'; id: string };

/**
 * Check whether `intent` would push the user over their quota for `kind`.
 *
 * Concurrent-write note: two tabs racing on different items both read
 * the index, both pass quota, and both write — the total can briefly
 * exceed the cap by one item. Acceptable: caps are soft ceilings at
 * this scale, not hard invariants. A Lua-script atomic reservation
 * would prevent it but isn't worth the complexity.
 */
export async function checkQuota(
  redis: Redis,
  userId: string,
  kind: SyncItemKind,
  intent: QuotaIntent
): Promise<QuotaCheck> {
  const caps = QUOTA[kind];
  const index = await getIndex(redis, userId, kind);

  // Live (non-tombstoned) view.
  let liveCount = 0;
  let liveBytes = 0;
  let replacingExisting = false;
  let replacingSize = 0;
  for (const [id, entry] of Object.entries(index)) {
    if (entry.deletedAt !== undefined) continue;
    liveCount++;
    liveBytes += entry.sizeBytes;
    if (intent.op === 'put' && intent.replacingId === id) {
      replacingExisting = true;
      replacingSize = entry.sizeBytes;
    }
  }

  if (intent.op === 'delete') {
    // Deletes always free space — never blocked by quota.
    return { ok: true };
  }

  // PUT: project the resulting state.
  const projectedCount = replacingExisting ? liveCount : liveCount + 1;
  const projectedBytes = liveBytes - replacingSize + intent.sizeBytes;

  if (projectedCount > caps.maxCount) {
    return {
      ok: false,
      error: {
        type: 'QUOTA_EXCEEDED',
        reason: 'count',
        current: projectedCount,
        limit: caps.maxCount,
      },
    };
  }
  if (projectedBytes > caps.maxBytes) {
    return {
      ok: false,
      error: {
        type: 'QUOTA_EXCEEDED',
        reason: 'bytes',
        current: projectedBytes,
        limit: caps.maxBytes,
      },
    };
  }
  return { ok: true };
}

export function getQuotaCaps(kind: SyncItemKind): { maxCount: number; maxBytes: number } {
  return QUOTA[kind];
}
