/**
 * Content hash over BinParams for identical-remix detection. Key order is
 * normalized and `undefined` members dropped so a params object that
 * round-tripped through the server (JSON re-serialization) hashes the same
 * as the local copy.
 */
import type { BinParams } from '@/shared/types/bin';

function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  const body = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${body.join(',')}}`;
}

export function hashBinParams(params: BinParams): string {
  const text = stableStringify(params);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
