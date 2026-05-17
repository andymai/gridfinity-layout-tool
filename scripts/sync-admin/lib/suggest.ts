import { userIndexKey } from '../../../api/lib/redisKeys.js';
import { expectedEnvelopeDelta } from './delta.js';
import type { Finding } from './types.js';

export type SuggestCategory = 'drift' | 'orphans' | 'stale-tombstones' | 'malformed';

export const SUGGEST_CATEGORIES: readonly SuggestCategory[] = [
  'drift',
  'orphans',
  'stale-tombstones',
  'malformed',
];

const FINDING_TO_CATEGORY: Partial<Record<Finding['kind'], SuggestCategory>> = {
  sanitization_drift: 'drift',
  orphan_blob: 'orphans',
  missing_blob: 'orphans',
  stale_tombstone: 'stale-tombstones',
  malformed_index_entry: 'malformed',
  tombstone_with_blob: 'orphans',
};

export function suggestFor(f: Finding): string[] {
  switch (f.kind) {
    case 'sanitization_drift':
      return driftSuggestion(f);
    case 'orphan_blob':
      return orphanBlobSuggestion(f);
    case 'tombstone_with_blob':
      return tombstoneWithBlobSuggestion(f);
    case 'missing_blob':
      return missingBlobSuggestion(f);
    case 'stale_tombstone':
      return staleTombstoneSuggestion(f);
    case 'malformed_index_entry':
      return malformedSuggestion(f);
    default:
      return [];
  }
}

export function categoryOf(f: Finding): SuggestCategory | undefined {
  return FINDING_TO_CATEGORY[f.kind];
}

function driftSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const data = (f.data ?? {}) as { indexSize?: number; blobSize?: number };
  if (typeof data.blobSize !== 'number') return [];
  const modifiedAt = (f.data as { modifiedAt?: number } | undefined)?.modifiedAt;
  const newSize = modifiedAt
    ? data.blobSize - expectedEnvelopeDelta(f.itemKind, modifiedAt)
    : data.blobSize;
  const key = userIndexKey(f.uid, f.itemKind);
  return [
    `# ${f.detail}`,
    `redis-cli -u "$REDIS_URL" --no-auth-warning EVAL '`,
    `  local raw = redis.call("HGET", KEYS[1], ARGV[1])`,
    `  if not raw then return "no entry" end`,
    `  local entry = cjson.decode(raw)`,
    `  entry.sizeBytes = tonumber(ARGV[2])`,
    `  return redis.call("HSET", KEYS[1], ARGV[1], cjson.encode(entry))`,
    `' 1 ${shq(key)} ${shq(f.id)} ${newSize}`,
  ];
}

function orphanBlobSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const blobPath = `users/${f.uid}/${f.itemKind}/${f.id}.json`;
  return [
    `# ${f.detail} — review before deletion`,
    `# Inspect first:`,
    `#   pnpm sync-admin user ${shq(f.uid)} --kind=${f.itemKind} --json | jq '.blobs[] | select(.id==${shq(f.id)})'`,
    `vercel blob rm ${shq(blobPath)} --yes`,
  ];
}

function tombstoneWithBlobSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const blobPath = `users/${f.uid}/${f.itemKind}/${f.id}.json`;
  return [
    `# ${f.detail} — tombstone says deleted but blob remains`,
    `vercel blob rm ${shq(blobPath)} --yes`,
  ];
}

function missingBlobSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const key = userIndexKey(f.uid, f.itemKind);
  return [
    `# ${f.detail} — index entry without blob (failed PUT or manual delete)`,
    `redis-cli -u "$REDIS_URL" --no-auth-warning HDEL ${shq(key)} ${shq(f.id)}`,
  ];
}

function staleTombstoneSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const key = userIndexKey(f.uid, f.itemKind);
  return [
    `# ${f.detail}`,
    `redis-cli -u "$REDIS_URL" --no-auth-warning HDEL ${shq(key)} ${shq(f.id)}`,
  ];
}

function malformedSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const key = userIndexKey(f.uid, f.itemKind);
  return [
    `# ${f.detail} — inspect raw value, then HDEL if unrecoverable`,
    `redis-cli -u "$REDIS_URL" --no-auth-warning HGET ${shq(key)} ${shq(f.id)}`,
    `# redis-cli -u "$REDIS_URL" --no-auth-warning HDEL ${shq(key)} ${shq(f.id)}`,
  ];
}

function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
