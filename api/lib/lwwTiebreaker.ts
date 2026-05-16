import { createHash } from 'node:crypto';

/**
 * Deterministic tiebreaker for LWW writes that arrive with the same
 * `modifiedAt`. Two devices that produce the same `modifiedAt` for
 * distinct payloads must agree on which payload wins, regardless of
 * which one happened to land at the server first. Without this, the
 * "winner" is whoever raced to the index first — opaque to the user
 * and non-reproducible across reties.
 *
 * Approach: SHA-256 of a canonical JSON encoding (object keys sorted
 * recursively, no whitespace). The lexicographically larger hash wins.
 *
 * Hash collisions on 256 bits with the universe of plausible payloads
 * are not a concern; identical hashes mean identical payloads, in which
 * case the tiebreaker is a no-op (returns 0, caller treats existing as
 * still winning so no unnecessary write happens).
 */
export function canonicalPayloadHash(payload: unknown): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

/**
 * Compare two payloads for tiebreaker purposes.
 *
 *   +1 → `candidate` wins (its hash is lexicographically larger)
 *   −1 → `incumbent` wins
 *    0 → equal payloads (functionally identical; no write needed)
 */
export function compareForTiebreaker(candidate: unknown, incumbent: unknown): -1 | 0 | 1 {
  const cHash = canonicalPayloadHash(candidate);
  const iHash = canonicalPayloadHash(incumbent);
  if (cHash > iHash) return 1;
  if (cHash < iHash) return -1;
  return 0;
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return '[' + value.map((v) => canonicalize(v)).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const parts = keys.map(
      (k) => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k])
    );
    return '{' + parts.join(',') + '}';
  }
  // undefined / functions / symbols collapse to null — same as JSON.stringify.
  return 'null';
}
