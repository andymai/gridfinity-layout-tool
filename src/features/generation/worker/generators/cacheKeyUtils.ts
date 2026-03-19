/**
 * Cache key utilities for the generation worker's LRU caches.
 *
 * Provides deterministic key generation so that semantically identical
 * parameters always produce the same cache key, regardless of property
 * insertion order or IEEE 754 floating-point drift.
 */

/** Character length above which keys are hashed to keep Map overhead low. */
export const KEY_HASH_THRESHOLD = 200;

/**
 * Quantize a float to 2 decimal places to eliminate IEEE 754 drift.
 *
 * Example: `quantize(0.1 + 0.2)` → `0.3`
 */
export function quantize(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * FNV-1a 32-bit hash — fast, non-cryptographic, good distribution.
 * Used internally by `compactKey` when a serialized key exceeds the threshold.
 */
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // Ensure unsigned
}

/**
 * Deterministic serializer that produces stable string representations
 * regardless of object key insertion order.
 *
 * - Objects: keys sorted alphabetically, formatted as `key1:val1,key2:val2`
 * - Arrays: `[val1,val2,val3]`
 * - Numbers: quantized to 2 decimal places
 * - Other primitives: direct string conversion
 */
export function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'number':
      return String(quantize(value));
    case 'string':
      return value;
    case 'boolean':
      return String(value);
    default:
      break;
  }

  if (Array.isArray(value)) {
    const items = (value as ReadonlyArray<unknown>).map(stableSerialize);
    return `[${items.join(',')}]`;
  }

  // Plain object — sort keys for deterministic output
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${k}:${stableSerialize(obj[k])}`);
  return parts.join(',');
}

/**
 * If the key exceeds `KEY_HASH_THRESHOLD` characters, replace it with
 * an FNV-1a 32-bit hex hash prefixed by `#`. Short keys pass through unchanged.
 */
export function compactKey(key: string): string {
  if (key.length > KEY_HASH_THRESHOLD) {
    return `#${fnv1a32(key).toString(16)}`;
  }
  return key;
}

/**
 * Build a versioned, pipe-delimited cache key.
 *
 * Numbers are quantized to avoid float drift; all segments are stringified.
 *
 * @example
 * buildCacheKey('v1', 'socket', 2, 3, true) → 'v1|socket|2|3|true'
 */
export function buildCacheKey(
  version: string,
  ...segments: Array<string | number | boolean>
): string {
  return [
    version,
    ...segments.map((s) => (typeof s === 'number' ? String(quantize(s)) : String(s))),
  ].join('|');
}
