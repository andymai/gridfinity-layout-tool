import { ErrorCode, isValidShareId, MAX_NAME_LENGTH } from '../../lib/shared.js';
import { validateBaseplateShare } from '../../lib/baseplateValidation.js';
import { sanitizeString } from '../../lib/validation.js';
import { createSyncResourceHandler } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** The PUT body / GET envelope key for this resource; mirrors `PAYLOAD_KEY.baseplates` in src/core/sync/payloadKey.ts. */
export const PAYLOAD_KEY = 'baseplate' as const;

interface BaseplateEnvelope {
  /** `{ name, params }` wrapper; readers parse with `unwrapBaseplatePayload`. */
  baseplate: unknown;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * Split `baseplate` into `{ name, params }`. New shape carries a `params`
 * field; a bare params object (no nested `params`) is tolerated too, so the
 * two are unambiguous. Returns `null` if the wrapper is malformed (e.g. `name`
 * is present but isn't a string) so the caller can 400.
 */
function unwrapBaseplatePayload(
  baseplate: unknown
): { name: string | null; params: unknown } | null {
  if (baseplate === null || typeof baseplate !== 'object') return null;
  const { name, params } = baseplate as { name?: unknown; params?: unknown };
  if (typeof params === 'object' && params !== null) {
    if (name !== undefined && typeof name !== 'string') return null;
    return { name: name ?? null, params };
  }
  return { name: null, params: baseplate };
}

/**
 * GET    /api/sync/baseplates/{id}
 * PUT    /api/sync/baseplates/{id}  — body { baseplate, modifiedAt }. `baseplate`
 *                                     is `{ name, params }` (new shape) or bare
 *                                     params (legacy/tolerant, still accepted).
 * DELETE /api/sync/baseplates/{id}
 *
 * Mirrors the designs endpoint's LWW + tombstone semantics.
 */
export default createSyncResourceHandler<BaseplateEnvelope>({
  kind: 'baseplates',
  payloadKey: PAYLOAD_KEY,
  // Locally-minted baseplate ids (base36 suffix up to 6 chars but can be
  // shorter, so accept 1-8) plus the share formats for round-tripping.
  isValidId: (id) => /^baseplate_\d+_[a-z0-9]{1,8}$/.test(id) || isValidShareId(id),
  invalidIdError: 'Invalid baseplate id',
  deletedError: 'Baseplate was deleted on another device. Save again to restore.',
  buildPut: (baseplate, modifiedAt) => {
    const unwrapped = unwrapBaseplatePayload(baseplate);
    if (!unwrapped) {
      return {
        ok: false,
        status: 400,
        error: 'baseplate must be an object with a string `name`',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const name = sanitizeString(unwrapped.name ?? '', MAX_NAME_LENGTH);

    // Two byte counts: `preValidationBytes` is what the validator's size cap
    // sees (a CPU guard); `sizeBytes` is what we store after sanitization and
    // what the quota check + index entry track.
    const validationPayload = {
      type: 'baseplate' as const,
      version: 1 as const,
      params: unwrapped.params,
    };
    const preValidationBytes = Buffer.byteLength(
      JSON.stringify({ name, ...validationPayload }),
      'utf8'
    );
    const validation = validateBaseplateShare(validationPayload, preValidationBytes);
    if (!validation.valid) {
      return {
        ok: false,
        status: 400,
        error: validation.error.message,
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const sizeBytes = Buffer.byteLength(
      JSON.stringify({
        name,
        type: 'baseplate',
        version: 1,
        params: validation.payload.params,
      }),
      'utf8'
    );

    // Always emit the new wrapper shape. Bare-params posts become `name = ''`;
    // readers fall back from there. Equal-ms ties hash over `{ name, params }`
    // so renames also participate.
    const stored = { name, params: validation.payload.params };
    return {
      ok: true,
      envelope: { baseplate: stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
      sizeBytes,
      tiebreakerCandidate: stored,
    };
  },
  storedComparable: (stored) => stored.baseplate,
});
