import { ErrorCode, isValidShareId } from '../../lib/shared.js';
import { validateDesignerShare, sanitizeTags } from '../../lib/designerValidation.js';
import { sanitizeString } from '../../lib/validation.js';
import { createSyncResourceHandler } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** Max length for a user-visible design name (mirrors `inserts[].label`). */
const MAX_NAME_LENGTH = 100;

interface DesignEnvelope {
  /** `{ name, params, tags }` wrapper; readers parse with `unwrapDesignPayload`. */
  design: unknown;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * Split `design` into `{ name, params }`. New shape carries a `params`
 * field; legacy shape is bare `BinParams` (no nested `params`), so the
 * two are unambiguous. Returns `null` if the wrapper is malformed (e.g.
 * `name` is present but isn't a string) so the caller can 400.
 */
function unwrapDesignPayload(
  design: unknown
): { name: string | null; params: unknown; tags: unknown } | null {
  if (design === null || typeof design !== 'object') return null;
  const { name, params, tags } = design as { name?: unknown; params?: unknown; tags?: unknown };
  if (typeof params === 'object' && params !== null) {
    // Wrapper shape: name must be a string or absent. Reject other types
    // so malformed clients can't silently drop the user-visible field.
    if (name !== undefined && typeof name !== 'string') return null;
    // `tags` is sanitized (not strictly validated) downstream, so any shape
    // is tolerated here; non-array input becomes [].
    return { name: name ?? null, params, tags };
  }
  return { name: null, params: design, tags: undefined };
}

/**
 * GET    /api/sync/designs/{id}
 * PUT    /api/sync/designs/{id}   — body { design, modifiedAt }. `design`
 *                                    is `{ name, params }` (new shape) or
 *                                    bare BinParams (legacy, still accepted).
 * DELETE /api/sync/designs/{id}
 *
 * Mirrors the layouts endpoint's LWW + tombstone semantics.
 */
export default createSyncResourceHandler<DesignEnvelope>({
  kind: 'designs',
  payloadKey: 'design',
  // Locally-minted design ids plus the share formats (UUID, base36
  // timestamp, 12-char alphanumeric) so ids round-trip with the share
  // feature without renaming.
  isValidId: (id) => /^design_\d+_[a-z0-9]{6}$/.test(id) || isValidShareId(id),
  invalidIdError: 'Invalid design id',
  deletedError: 'Design was deleted on another device. Save again to restore.',
  buildPut: (design, modifiedAt) => {
    const unwrapped = unwrapDesignPayload(design);
    if (!unwrapped) {
      return {
        ok: false,
        status: 400,
        error: 'design must be an object with a string `name`',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    // Mirror the share validator's handling of user-visible strings: strip
    // null bytes and control chars, trim, and truncate. Legacy bare-params
    // posts have no name; they persist as '' and the adapter falls back.
    const name = sanitizeString(unwrapped.name ?? '', MAX_NAME_LENGTH);
    // Tags ride alongside `name` (not inside `params`), so they bypass the
    // params validator and are sanitized/capped here instead.
    const tags = sanitizeTags(unwrapped.tags);

    // Two byte counts intentionally: `preValidationBytes` is what the
    // validator's 100 KB size cap sees — purely a CPU guard against huge
    // params. `sizeBytes` is what we actually store after sanitization, and
    // it's what the quota check and index entry track. Without the split,
    // users get charged for bytes the validator stripped and the index
    // drifts from what the blob holds.
    const validationPayload = {
      type: 'designer' as const,
      version: 1 as const,
      params: unwrapped.params,
    };
    const preValidationBytes = Buffer.byteLength(
      JSON.stringify({ name, tags, ...validationPayload }),
      'utf8'
    );
    const validation = validateDesignerShare(validationPayload, preValidationBytes);
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
        tags,
        type: 'designer',
        version: 1,
        params: validation.payload.params,
      }),
      'utf8'
    );

    // Always emit the new wrapper shape. Legacy posts become `name = ''`;
    // readers fall back from there. `tags` is always an array (possibly
    // empty). Equal-ms ties hash over `{ name, params, tags }` so renames
    // and tag-only edits also participate.
    const stored = { name, params: validation.payload.params, tags };
    return {
      ok: true,
      envelope: { design: stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
      sizeBytes,
      tiebreakerCandidate: stored,
    };
  },
  storedComparable: (stored) => stored.design,
});
