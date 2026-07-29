import { list } from '@vercel/blob';
import type Redis from 'ioredis';
import { userIndexKey } from '../../../api/lib/redisKeys.js';
import { pMap } from './concurrency.js';
import { parseRow } from './inventory.js';
import type { Finding, Inventory, IndexRow, Kind } from './types.js';

export interface ReverifyResult {
  confirmed: Finding[];
  suppressed: Finding[];
}

/**
 * How both stores see one item. Two reads that disagree mean the item was
 * written between them, which is the whole point of the comparison.
 */
export interface ItemState {
  indexPresent: boolean;
  indexModifiedAt: number | null;
  indexSizeBytes: number | null;
  indexDeletedAt: number | null;
  blobPresent: boolean;
  blobSize: number | null;
  blobUrl: string | null;
}

export function itemStateKey(uid: string, kind: Kind, id: string): string {
  return `${uid}/${kind}/${id}`;
}

/**
 * Identity of an observation. `withBlob` is false for inventories built with
 * `skipBlobs`, where the first pass never looked at blob storage and comparing
 * it against a fresh read would flag every item as having changed.
 */
export function stateKey(s: ItemState, withBlob = true): string {
  const parts = [s.indexPresent ? '1' : '0', s.indexModifiedAt, s.indexSizeBytes, s.indexDeletedAt];
  if (withBlob) parts.push(s.blobPresent ? '1' : '0', String(s.blobSize));
  return parts.join('|');
}

/** The first-pass observation, reconstructed from the scan's own inventory. */
export function stateFromInventory(inv: Inventory, uid: string, kind: Kind, id: string): ItemState {
  const key = itemStateKey(uid, kind, id);
  const row = inv.indexMap.get(key);
  const blob = inv.blobMap.get(key);
  return {
    indexPresent: row !== undefined,
    indexModifiedAt: row && Number.isFinite(row.entry.modifiedAt) ? row.entry.modifiedAt : null,
    indexSizeBytes: row && Number.isFinite(row.entry.sizeBytes) ? row.entry.sizeBytes : null,
    indexDeletedAt: row?.entry.deletedAt ?? null,
    blobPresent: blob !== undefined,
    blobSize: blob?.size ?? null,
    blobUrl: blob?.url ?? null,
  };
}

export async function readItemState(
  redis: Redis,
  uid: string,
  kind: Kind,
  id: string,
  withBlob = true
): Promise<ItemState> {
  const pathname = `users/${uid}/${kind}/${id}.json`;
  const [encoded, page] = await Promise.all([
    redis.hget(userIndexKey(uid, kind), id),
    // A skipBlobs inventory ignores these fields anyway; don't pay for them.
    withBlob ? list({ prefix: pathname, limit: 1 }) : Promise.resolve({ blobs: [] }),
  ]);
  const blob = page.blobs.find((b) => b.pathname === pathname);
  let row: IndexRow | null = null;
  if (encoded !== null) row = parseRow(uid, kind, id, encoded);
  return {
    indexPresent: encoded !== null,
    indexModifiedAt: row && Number.isFinite(row.entry.modifiedAt) ? row.entry.modifiedAt : null,
    indexSizeBytes: row && Number.isFinite(row.entry.sizeBytes) ? row.entry.sizeBytes : null,
    indexDeletedAt: row?.entry.deletedAt ?? null,
    blobPresent: blob !== undefined,
    blobSize: blob?.size ?? null,
    blobUrl: blob?.url ?? null,
  };
}

/**
 * Kinds decided entirely by data captured at scan time. Redis hash writes and
 * Vercel Blob puts are both atomic, so a malformed entry or a payload that
 * fails validation is a complete document that is genuinely wrong — re-reading
 * it proves nothing.
 */
const RACE_IMMUNE: ReadonlySet<Finding['kind']> = new Set([
  'malformed_index_entry',
  'payload_invalid',
]);

/** Kinds whose inconsistency can only be re-checked by refetching the blob. */
const NEEDS_PAYLOAD: ReadonlySet<Finding['kind']> = new Set([
  'modifiedAt_mismatch',
  'listing_size_mismatch',
  'envelope_invalid',
  'fetch_timeout',
]);

/**
 * Re-read every flagged item and drop the ones that were merely mid-write.
 *
 * `buildInventory` lists all blobs before reading the Redis index, so on a live
 * database any save landing in that gap is observed inconsistently — a create
 * looks like `missing_blob`, a shrinking edit like `index_size_undercount`, a
 * rewrite like `modifiedAt_mismatch` + `listing_size_mismatch`. A second read
 * separates those from real corruption: if the item moved again it is being
 * actively written, and if it is byte-identical yet still inconsistent the
 * finding is real.
 */
export async function reverify(
  redis: Redis,
  inv: Inventory,
  findings: readonly Finding[],
  fetchTimeoutMs: number,
  onProgress?: (done: number, total: number) => void
): Promise<ReverifyResult> {
  let done = 0;
  const settled = await pMap(findings, async (f) => {
    const keep = await isReal(redis, inv, f, fetchTimeoutMs);
    onProgress?.(++done, findings.length);
    return keep;
  });

  const confirmed: Finding[] = [];
  const suppressed: Finding[] = [];
  findings.forEach((f, i) => (settled[i] ? confirmed : suppressed).push(f));
  return { confirmed, suppressed };
}

async function isReal(
  redis: Redis,
  inv: Inventory,
  f: Finding,
  fetchTimeoutMs: number
): Promise<boolean> {
  if (!f.id || !f.itemKind) return true;
  if (RACE_IMMUNE.has(f.kind)) return true;

  const before = stateFromInventory(inv, f.uid, f.itemKind, f.id);
  const after = await readItemState(redis, f.uid, f.itemKind, f.id, inv.blobsListed);

  // Moved between the two reads — the item is being written right now.
  if (stateKey(before, inv.blobsListed) !== stateKey(after, inv.blobsListed)) return false;

  if (NEEDS_PAYLOAD.has(f.kind)) return await payloadStillInconsistent(f, after, fetchTimeoutMs);
  return membershipStillInconsistent(f, after, inv.blobsListed);
}

function membershipStillInconsistent(f: Finding, s: ItemState, blobsListed: boolean): boolean {
  switch (f.kind) {
    case 'missing_blob':
      return s.indexPresent && s.indexDeletedAt === null && !s.blobPresent;
    case 'orphan_blob':
      return s.blobPresent && !s.indexPresent;
    case 'tombstone_with_blob':
      return s.indexDeletedAt !== null && s.blobPresent;
    case 'stale_tombstone':
      // Age only grows; the tombstone still existing is the whole claim.
      return s.indexDeletedAt !== null;
    case 'sanitization_drift':
    case 'index_size_undercount':
      // Sizes are unchanged (stateKey matched), so the delta still holds.
      return s.indexPresent && (!blobsListed || s.blobPresent);
    default:
      return true;
  }
}

async function payloadStillInconsistent(
  f: Finding,
  s: ItemState,
  fetchTimeoutMs: number
): Promise<boolean> {
  if (!s.blobPresent || !s.blobUrl) return false;
  let text: string;
  try {
    const r = await fetch(s.blobUrl, { signal: AbortSignal.timeout(fetchTimeoutMs) });
    // Suppression requires positive evidence that the item is fine. A failed
    // re-fetch is the absence of evidence, so the finding has to stand — the
    // listing still shows this blob (stateKey matched), so a non-2xx here is
    // itself worth surfacing.
    if (!r.ok) return true;
    text = await r.text();
  } catch {
    return true;
  }

  if (f.kind === 'fetch_timeout' || f.kind === 'envelope_invalid') {
    // It fetched cleanly this time; only a still-broken envelope is real.
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      return body.schemaVersion !== 1 || !Number.isFinite(body.modifiedAt as number);
    } catch {
      return true;
    }
  }

  if (f.kind === 'listing_size_mismatch') {
    return Buffer.byteLength(text, 'utf8') !== s.blobSize;
  }

  try {
    const body = JSON.parse(text) as { modifiedAt?: unknown };
    return typeof body.modifiedAt === 'number' && body.modifiedAt !== s.indexModifiedAt;
  } catch {
    return true;
  }
}
