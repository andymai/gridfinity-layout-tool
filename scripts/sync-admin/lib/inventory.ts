import { list } from '@vercel/blob';
import type Redis from 'ioredis';
import { userIndexKey } from '../../../api/lib/redisKeys.js';
import type { IndexEntry } from '../../../api/lib/userIndex.js';
import { scanKeys } from './redis.js';
import type { BlobRow, Inventory, IndexRow, Kind } from './types.js';

interface BuildOpts {
  user?: string;
  kind?: Kind;
  /** Skip the Vercel Blob listing — only Redis index data is needed. */
  skipBlobs?: boolean;
}

export async function buildInventory(redis: Redis, opts: BuildOpts = {}): Promise<Inventory> {
  const blobs = opts.skipBlobs ? [] : await listBlobs(opts);
  const blobMap = new Map<string, BlobRow>();
  const blobUsers = new Set<string>();
  for (const b of blobs) {
    blobMap.set(itemKey(b.uid, b.kind, b.id), b);
    blobUsers.add(b.uid);
  }

  const indexRows = await readIndexes(redis, opts);
  const indexMap = new Map<string, IndexRow>();
  const redisUsers = new Set<string>();
  for (const r of indexRows) {
    indexMap.set(itemKey(r.uid, r.kind, r.id), r);
    redisUsers.add(r.uid);
  }

  return { blobs, blobMap, indexRows, indexMap, blobUsers, redisUsers };
}

export function itemKey(uid: string, kind: Kind, id: string): string {
  return `${uid}/${kind}/${id}`;
}

async function listBlobs(opts: BuildOpts): Promise<BlobRow[]> {
  const prefix = opts.user ? `users/${opts.user}/` : 'users/';
  const out: BlobRow[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const parts = b.pathname.split('/');
      if (parts[0] !== 'users' || !parts[1]) continue;
      if (parts[2] !== 'layouts' && parts[2] !== 'designs' && parts[2] !== 'baseplates') continue;
      if (opts.kind && parts[2] !== opts.kind) continue;
      const file = parts[3] ?? '';
      if (!file.endsWith('.json')) continue;
      out.push({
        uid: parts[1],
        kind: parts[2],
        id: file.slice(0, -5),
        size: b.size,
        url: b.url,
        uploadedAt: b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt),
      });
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}

async function readIndexes(redis: Redis, opts: BuildOpts): Promise<IndexRow[]> {
  const kinds: Kind[] = opts.kind ? [opts.kind] : ['layouts', 'designs', 'baseplates'];
  const out: IndexRow[] = [];
  for (const kind of kinds) {
    const keys = opts.user
      ? [userIndexKey(opts.user, kind)]
      : await scanKeys(redis, `users:*:index:${kind}`);
    for (const key of keys) {
      const uid = key.split(':')[1];
      const raw = await redis.hgetall(key);
      for (const [id, encoded] of Object.entries(raw)) {
        out.push(parseRow(uid, kind, id, encoded));
      }
    }
  }
  return out;
}

export function parseRow(uid: string, kind: Kind, id: string, encoded: string): IndexRow {
  const malformed: IndexRow = {
    uid,
    kind,
    id,
    entry: { modifiedAt: NaN, sizeBytes: NaN },
    tombstone: false,
  };
  try {
    const entry = JSON.parse(encoded) as IndexEntry;
    if (!Number.isFinite(entry.modifiedAt) || !Number.isFinite(entry.sizeBytes)) return malformed;
    // Match userIndex.parseEntry: deletedAt is either absent or a finite number.
    if (entry.deletedAt !== undefined && !Number.isFinite(entry.deletedAt)) return malformed;
    return { uid, kind, id, entry, tombstone: entry.deletedAt !== undefined };
  } catch {
    return malformed;
  }
}

export function isMalformedRow(r: IndexRow): boolean {
  return Number.isNaN(r.entry.modifiedAt) || Number.isNaN(r.entry.sizeBytes);
}
