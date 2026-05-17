import type { Kind } from './types.js';

/**
 * Expected `blob.size - index.sizeBytes` when the validator made no
 * byte-level change to the payload. Anything beyond this is sanitization
 * drift — bytes the validator stripped that the index still accounts for.
 *
 *   Layouts: blob is `{"layout":<L>,"modifiedAt":N,"schemaVersion":1}`,
 *            index sizeBytes is `byteLen({"layout":<L>})`.
 *            Overhead = `,"modifiedAt":` (14) + digits(N) + `,"schemaVersion":1` (18).
 *   Designs: blob is `{"design":{"name":..,"params":..},"modifiedAt":N,"schemaVersion":1}`,
 *            index sizeBytes is `byteLen({"name":..,"type":"designer","version":1,"params":..})`.
 *            Net delta = 13 + digits(N).
 */
export function expectedEnvelopeDelta(kind: Kind, modifiedAt: number): number {
  const digits = String(modifiedAt).length;
  return (kind === 'layouts' ? 32 : 13) + digits;
}
