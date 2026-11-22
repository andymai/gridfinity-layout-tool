import { KIND_SPECS } from './kinds.js';
import type { Kind } from './types.js';

/**
 * Expected `blob.size - index.sizeBytes` when the validator made no
 * byte-level change to the payload. Anything beyond this is sanitization
 * drift — bytes the validator stripped that the index still accounts for.
 * Every envelope ends `,"modifiedAt":N,"schemaVersion":V}`, with V one digit.
 *
 *   Layouts: blob is `{"layout":<L>,"modifiedAt":N,"schemaVersion":V}`,
 *            index sizeBytes is `byteLen({"layout":<L>})`.
 *            Overhead = `,"modifiedAt":` (14) + digits(N) + `,"schemaVersion":V` (18).
 *   Designs: a plain bin design's blob is `{"design":{"name":..,"params":..,"tags":..},"modifiedAt":N,"schemaVersion":V}`,
 *            index sizeBytes is `byteLen({"name":..,"tags":..,"type":"designer","version":1,"params":..})`.
 *            Net delta = 13 + digits(N). `name` and `tags` appear with the same
 *            key+value on both sides, so they cancel and don't affect the delta.
 *            Other shapes and variants measure differently, so `analyze`
 *            takes a design's figure from its handler instead.
 *   Baseplates: blob is `{"baseplate":{"name":..,"params":..},"modifiedAt":N,"schemaVersion":V}`,
 *            index sizeBytes is `byteLen({"name":..,"type":"baseplate","version":1,"params":..})`.
 *            Net delta = 15 + digits(N). `name` cancels on both sides.
 *   Design versions, folders, cutout items and cutout folders: blob is
 *            `{"<key>":<S>,"modifiedAt":N,"schemaVersion":V}`, index sizeBytes
 *            is `byteLen(<S>)`. Net delta = len(key) + 37 + digits(N).
 */
export function expectedEnvelopeDelta(kind: Kind, modifiedAt: number): number {
  const digits = String(modifiedAt).length;
  switch (kind) {
    case 'layouts':
      return 32 + digits;
    case 'designs':
      return 13 + digits;
    case 'baseplates':
      return 15 + digits;
    case 'designVersions':
    case 'folders':
    case 'cutoutItems':
    case 'cutoutFolders':
      return KIND_SPECS[kind].payloadKey.length + 37 + digits;
  }
}
