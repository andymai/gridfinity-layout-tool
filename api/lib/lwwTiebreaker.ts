import { createHash } from 'node:crypto';

// SHA-256 over a canonical JSON encoding (recursively sorted keys, no
// whitespace) so two devices computing the same modifiedAt for distinct
// payloads converge on the same winner regardless of arrival order.
export function canonicalPayloadHash(payload: unknown): string {
  const h = createHash('sha256');
  hashInto(h, payload);
  return h.digest('hex');
}

// +1 candidate wins, -1 incumbent wins, 0 equal payloads (no write needed).
export function compareForTiebreaker(candidate: unknown, incumbent: unknown): -1 | 0 | 1 {
  const cHash = canonicalPayloadHash(candidate);
  const iHash = canonicalPayloadHash(incumbent);
  if (cHash > iHash) return 1;
  if (cHash < iHash) return -1;
  return 0;
}

function hashInto(h: ReturnType<typeof createHash>, value: unknown): void {
  if (value === null) {
    h.update('null');
    return;
  }
  if (typeof value === 'number') {
    h.update(Number.isFinite(value) ? String(value) : 'null');
    return;
  }
  if (typeof value === 'string') {
    h.update(JSON.stringify(value));
    return;
  }
  if (typeof value === 'boolean') {
    h.update(value ? 'true' : 'false');
    return;
  }
  if (Array.isArray(value)) {
    h.update('[');
    for (let i = 0; i < value.length; i++) {
      if (i > 0) h.update(',');
      hashInto(h, value[i]);
    }
    h.update(']');
    return;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    h.update('{');
    for (let i = 0; i < keys.length; i++) {
      if (i > 0) h.update(',');
      h.update(JSON.stringify(keys[i]) + ':');
      hashInto(h, (value as Record<string, unknown>)[keys[i]]);
    }
    h.update('}');
    return;
  }
  h.update('null');
}
