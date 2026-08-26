import { isValidShareId } from '../../lib/shared.js';
import { isValidationError, validateShareLayout } from '../../lib/validation.js';
import { createSyncResourceHandler } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** The PUT body / GET envelope key for this resource; mirrors `PAYLOAD_KEY.layouts` in src/core/sync/payloadKey.ts. */
export const PAYLOAD_KEY = 'layout' as const;

interface LayoutEnvelope {
  layout: unknown;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * GET    /api/sync/layouts/{id}   — fetch envelope (200 / 404 / 410)
 * PUT    /api/sync/layouts/{id}   — body { layout, modifiedAt }; LWW
 *                                    409 if remote is newer; 410 if a
 *                                    stale resurrect would clobber a
 *                                    tombstone newer than the edit.
 * DELETE /api/sync/layouts/{id}   — tombstone + blob delete (204)
 */
export default createSyncResourceHandler<LayoutEnvelope>({
  kind: 'layouts',
  payloadKey: PAYLOAD_KEY,
  // Layouts the client may sync share three id formats with the existing
  // share feature (UUID, base36 timestamp, 12-char alphanumeric); we accept
  // the same shapes here so layouts can be round-tripped between local
  // storage and the cloud without renaming.
  isValidId: isValidShareId,
  invalidIdError: 'Invalid layout id',
  deletedError: 'Layout was deleted on another device. Save again to restore.',
  buildPut: (layout, modifiedAt) => {
    // Two byte counts intentionally: `preValidationBytes` is what the
    // validator's 500 KB size cap sees — purely a CPU guard against huge
    // inputs. `sizeBytes` is what we actually store after sanitization, and
    // it's what the quota check and index entry track. Without the split,
    // users get charged for bytes the validator stripped and the index
    // drifts from what the blob holds.
    const preValidationBytes = Buffer.byteLength(JSON.stringify({ layout }), 'utf8');
    const validation = validateShareLayout(layout, preValidationBytes);
    if (isValidationError(validation)) {
      return {
        ok: false,
        status: 400,
        error: validation.error.message,
        code: validation.error.code,
      };
    }
    const sizeBytes = Buffer.byteLength(JSON.stringify({ layout: validation.layout }), 'utf8');
    return {
      ok: true,
      envelope: { layout: validation.layout, modifiedAt, schemaVersion: SCHEMA_VERSION },
      sizeBytes,
      tiebreakerCandidate: validation.layout,
    };
  },
  storedComparable: (stored) => stored.layout,
});
