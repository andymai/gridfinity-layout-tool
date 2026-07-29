import { list } from '@vercel/blob';
import type Redis from 'ioredis';
import { userIndexKey } from '../../../api/lib/redisKeys.js';
import type { IndexEntry } from '../../../api/lib/userIndex.js';
import { createProgress, type Progress } from './progress.js';
import { hgetallMany, scanKeys } from './redis.js';
import type { BlobRow, Inventory, IndexRow, Kind } from './types.js';

interface BuildOpts {
  user?: string;
  kind?: Kind;
  /** Skip the Vercel Blob listing — only Redis index data is needed. */
  skipBlobs?: boolean;
  progress?: Progress;
}

export async function buildInventory(redis: Redis, opts: BuildOpts = {}): Promise<Inventory> {
  const progress = opts.progress ?? createProgress(false);
  const blobs = opts.skipBlobs ? [] : await listBlobs(opts, progress);
  const blobMap = new Map<string, BlobRow>();
  const blobUsers = new Set<string>();
  for (const b of blobs) {
    blobMap.set(itemKey(b.uid, b.kind, b.id), b);
    blobUsers.add(b.uid);
  }

  const indexRows = await readIndexes(redis, opts, progress);
  const indexMap = new Map<string, IndexRow>();
  const redisUsers = new Set<string>();
  for (const r of indexRows) {
    indexMap.set(itemKey(r.uid, r.kind, r.id), r);
    redisUsers.add(r.uid);
  }

  return {
    blobs,
    blobMap,
    indexRows,
    indexMap,
    blobUsers,
    redisUsers,
    blobsListed: !opts.skipBlobs,
  };
}

export function itemKey(uid: string, kind: Kind, id: string): string {
  return `${uid}/${kind}/${id}`;
}

async function listBlobs(opts: BuildOpts, progress: Progress): Promise<BlobRow[]> {
  const prefix = opts.user ? `users/${opts.user}/` : 'users/';
  const out: BlobRow[] = [];
  let cursor: string | undefined;
  progress.phase('listing blobs');
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
    progress.update(`${out.length} found`);
  } while (cursor);
  progress.done(`${out.length} found`);
  return out;
}

const ALL_KINDS: readonly Kind[] = ['layouts', 'designs', 'baseplates'];

/**
 * `users:{uid}:index:{kind}` → its parts, or null for anything else the glob
 * happens to reach. Sibling keys (`indexUpdatedAt`, `tombstoneSweptAt`) can't
 * match `users:*:index:*` today, but a future one shouldn't become an index row.
 */
export function parseIndexKey(key: string): { uid: string; kind: Kind } | null {
  const parts = key.split(':');
  if (parts.length !== 4 || parts[0] !== 'users' || parts[2] !== 'index') return null;
  const kind = parts[3] as Kind;
  if (!ALL_KINDS.includes(kind) || !parts[1]) return null;
  return { uid: parts[1], kind };
}

async function readIndexes(redis: Redis, opts: BuildOpts, progress: Progress): Promise<IndexRow[]> {
  const kinds = opts.kind ? [opts.kind] : ALL_KINDS;
  const user = opts.user;
  progress.phase('reading index');

  const targets: { key: string; uid: string; kind: Kind }[] = [];
  if (user) {
    // uid and kind are already known here; no need to parse them back out.
    for (const kind of kinds) targets.push({ key: userIndexKey(user, kind), uid: user, kind });
  } else {
    // One cursor pass covers every kind. MATCH filters server-side but SCAN
    // still walks the whole keyspace, so a scan per kind paid that walk thrice.
    const keys = await scanKeys(redis, `users:*:index:${opts.kind ?? '*'}`);
    const wanted = new Set<Kind>(kinds);
    for (const key of keys) {
      const parsed = parseIndexKey(key);
      if (parsed && wanted.has(parsed.kind)) targets.push({ key, ...parsed });
    }
  }

  const hashes = await hgetallMany(
    redis,
    targets.map((t) => t.key),
    200,
    (done) => progress.update(`${done}/${targets.length} indexes`)
  );

  const out: IndexRow[] = [];
  for (const { key, uid, kind } of targets) {
    for (const [id, encoded] of Object.entries(hashes.get(key) ?? {})) {
      out.push(parseRow(uid, kind, id, encoded));
    }
  }
  progress.done(
    `${targets.length} indexes across ${new Set(targets.map((t) => t.uid)).size} users`
  );
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
