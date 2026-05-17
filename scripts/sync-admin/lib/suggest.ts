import { userIndexKey, userIndexUpdatedAtKey } from '../../../api/lib/redisKeys.js';
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
  index_size_undercount: 'drift',
  orphan_blob: 'orphans',
  missing_blob: 'orphans',
  stale_tombstone: 'stale-tombstones',
  malformed_index_entry: 'malformed',
  tombstone_with_blob: 'orphans',
};

/**
 * Header to emit at the top of a `suggest <category>` script so the file is
 * runnable standalone. The audit process loaded creds inside Node; the saved
 * file has to source them itself before any redis-cli / vercel blob calls.
 */
export const SCRIPT_PREAMBLE = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  '',
  '# Load REDIS_URL + BLOB_READ_WRITE_TOKEN from .env.production.local.',
  '# Run `vercel env pull .env.production.local` to refresh.',
  'if [ -f .env.production.local ]; then',
  '  set -a; . ./.env.production.local; set +a',
  'fi',
  ': "${REDIS_URL:?REDIS_URL not set; run \\`vercel env pull .env.production.local\\` first}"',
  ': "${BLOB_READ_WRITE_TOKEN:?BLOB_READ_WRITE_TOKEN not set; run \\`vercel env pull .env.production.local\\` first}"',
  '',
];

export function suggestFor(f: Finding): string[] {
  switch (f.kind) {
    case 'sanitization_drift':
    case 'index_size_undercount':
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
  const data = (f.data ?? {}) as { blobSize?: number; modifiedAt?: number };
  if (typeof data.blobSize !== 'number' || typeof data.modifiedAt !== 'number') return [];
  const newSize = data.blobSize - expectedEnvelopeDelta(f.itemKind, data.modifiedAt);
  if (!Number.isFinite(newSize) || newSize < 0) return [];
  const indexKey = userIndexKey(f.uid, f.itemKind);
  const updatedAtKey = userIndexUpdatedAtKey(f.uid);
  // Lua: read-modify-write the entry, but only if the audited modifiedAt
  // still matches — guards against the user updating the item between the
  // audit and the fix. Also bumps indexUpdatedAt so the manifest endpoint's
  // If-Modified-Since 304 path can't serve the stale sizeBytes.
  return [
    `# ${f.detail}`,
    `redis-cli -u "$REDIS_URL" --no-auth-warning EVAL '`,
    `  local raw = redis.call("HGET", KEYS[1], ARGV[1])`,
    `  if not raw then return "absent" end`,
    `  local entry = cjson.decode(raw)`,
    `  if tostring(entry.modifiedAt) ~= ARGV[3] then return "stale-modifiedAt" end`,
    `  entry.sizeBytes = tonumber(ARGV[2])`,
    `  redis.call("HSET", KEYS[1], ARGV[1], cjson.encode(entry))`,
    `  redis.call("SET", KEYS[2], ARGV[4])`,
    `  return "ok"`,
    `' 2 ${shq(indexKey)} ${shq(updatedAtKey)} ${shq(f.id)} ${newSize} ${shq(String(data.modifiedAt))} "$(date +%s%3N)"`,
  ];
}

function orphanBlobSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const blobPath = `users/${f.uid}/${f.itemKind}/${f.id}.json`;
  const indexKey = userIndexKey(f.uid, f.itemKind);
  // Preflight: re-check the index entry just before deletion. A live entry
  // means the user re-uploaded between audit and remediation, so we abort.
  return [
    `# ${f.detail} — preflight checks index is still absent before deleting blob`,
    `# Inspect: pnpm sync-admin user ${shq(f.uid)} --kind=${f.itemKind} --json | jq --arg id ${shq(f.id)} '.blobs[] | select(.id == $id)'`,
    `if [ "$(redis-cli -u "$REDIS_URL" --no-auth-warning HGET ${shq(indexKey)} ${shq(f.id)})" = "" ]; then`,
    `  vercel blob rm ${shq(blobPath)} --yes`,
    `else`,
    `  echo "skip: ${blobPath} — index entry now present, item likely re-uploaded"`,
    `fi`,
  ];
}

function tombstoneWithBlobSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const blobPath = `users/${f.uid}/${f.itemKind}/${f.id}.json`;
  const indexKey = userIndexKey(f.uid, f.itemKind);
  return [
    `# ${f.detail} — preflight checks index is still tombstoned before deleting blob`,
    `if redis-cli -u "$REDIS_URL" --no-auth-warning HGET ${shq(indexKey)} ${shq(f.id)} | grep -q '"deletedAt"'; then`,
    `  vercel blob rm ${shq(blobPath)} --yes`,
    `else`,
    `  echo "skip: ${blobPath} — index entry no longer tombstoned (item restored)"`,
    `fi`,
  ];
}

function missingBlobSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const data = (f.data ?? {}) as { modifiedAt?: number };
  if (typeof data.modifiedAt !== 'number') return [];
  const key = userIndexKey(f.uid, f.itemKind);
  return [
    `# ${f.detail} — guarded on audited modifiedAt`,
    `redis-cli -u "$REDIS_URL" --no-auth-warning EVAL '`,
    `  local raw = redis.call("HGET", KEYS[1], ARGV[1])`,
    `  if not raw then return "already-gone" end`,
    `  local entry = cjson.decode(raw)`,
    `  if tostring(entry.modifiedAt) ~= ARGV[2] then return "stale-modifiedAt" end`,
    `  return redis.call("HDEL", KEYS[1], ARGV[1])`,
    `' 1 ${shq(key)} ${shq(f.id)} ${shq(String(data.modifiedAt))}`,
  ];
}

function staleTombstoneSuggestion(f: Finding): string[] {
  if (!f.id || !f.itemKind) return [];
  const key = userIndexKey(f.uid, f.itemKind);
  // Lua: only delete if the entry is still a tombstone (deletedAt present).
  // Catches the case where the user re-uploaded after the audit.
  return [
    `# ${f.detail} — guarded on still-tombstoned state`,
    `redis-cli -u "$REDIS_URL" --no-auth-warning EVAL '`,
    `  local raw = redis.call("HGET", KEYS[1], ARGV[1])`,
    `  if not raw then return "already-gone" end`,
    `  local entry = cjson.decode(raw)`,
    `  if entry.deletedAt == nil then return "restored" end`,
    `  return redis.call("HDEL", KEYS[1], ARGV[1])`,
    `' 1 ${shq(key)} ${shq(f.id)}`,
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
