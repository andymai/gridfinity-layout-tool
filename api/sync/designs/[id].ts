import { ErrorCode, isValidShareId } from '../../lib/shared.js';
import { validateDesignerShare, sanitizeTags } from '../../lib/designerValidation.js';
import { sanitizeString } from '../../lib/validation.js';
import { createSyncResourceHandler } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** Max length for a user-visible design name (mirrors `inserts[].label`). */
const MAX_NAME_LENGTH = 100;

/** Generous cap for lineage ids (community ids are 12 chars today). */
const MAX_LINEAGE_ID_LENGTH = 64;

interface DesignEnvelope {
  /** `{ name, params, tags, publishedId?, lineage? }` wrapper; readers parse with `unwrapDesignPayload`. */
  design: unknown;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

interface StoredLineage {
  parentId: string;
  rootId: string;
  parentName: string;
  parentAuthorName: string;
  rootAuthorName: string;
}

/**
 * Loose shape check only: this envelope caches what the client already
 * learned from a publish response, it grants no authority (the community
 * endpoints never trust a client-sent publishedId). Malformed shapes are
 * rejected rather than dropped so a client bug surfaces instead of losing
 * data silently.
 */
function sanitizeLineage(
  value: unknown
): { ok: true; lineage: StoredLineage | null | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, lineage: undefined };
  if (value === null) return { ok: true, lineage: null };
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false };
  const l = value as Record<string, unknown>;
  const { parentId, rootId, parentName, parentAuthorName, rootAuthorName } = l;
  if (
    typeof parentId !== 'string' ||
    typeof rootId !== 'string' ||
    typeof parentName !== 'string' ||
    typeof parentAuthorName !== 'string' ||
    typeof rootAuthorName !== 'string'
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    lineage: {
      parentId: sanitizeString(parentId, MAX_LINEAGE_ID_LENGTH),
      rootId: sanitizeString(rootId, MAX_LINEAGE_ID_LENGTH),
      parentName: sanitizeString(parentName, MAX_NAME_LENGTH),
      parentAuthorName: sanitizeString(parentAuthorName, MAX_NAME_LENGTH),
      rootAuthorName: sanitizeString(rootAuthorName, MAX_NAME_LENGTH),
    },
  };
}

/**
 * Split `design` into `{ name, params }`. New shape carries a `params`
 * field; legacy shape is bare `BinParams` (no nested `params`), so the
 * two are unambiguous. Returns `null` if the wrapper is malformed (e.g.
 * `name` is present but isn't a string) so the caller can 400.
 */
function unwrapDesignPayload(design: unknown): {
  name: string | null;
  params: unknown;
  tags: unknown;
  publishedId: unknown;
  lineage: unknown;
} | null {
  if (design === null || typeof design !== 'object') return null;
  const { name, params, tags, publishedId, lineage } = design as {
    name?: unknown;
    params?: unknown;
    tags?: unknown;
    publishedId?: unknown;
    lineage?: unknown;
  };
  if (typeof params === 'object' && params !== null) {
    // Wrapper shape: name must be a string or absent. Reject other types
    // so malformed clients can't silently drop the user-visible field.
    if (name !== undefined && typeof name !== 'string') return null;
    // `tags` is sanitized (not strictly validated) downstream, so any shape
    // is tolerated here; non-array input becomes [].
    return { name: name ?? null, params, tags, publishedId, lineage };
  }
  return {
    name: null,
    params: design,
    tags: undefined,
    publishedId: undefined,
    lineage: undefined,
  };
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

    // Opaque passthrough: `null` (unpublish) and absent (legacy client) are
    // distinct and both preserved. Malformed ids are 400, not dropped:
    // community ids are the 12-char branch of `isValidShareId`.
    const rawPublishedId = unwrapped.publishedId;
    if (
      rawPublishedId !== undefined &&
      rawPublishedId !== null &&
      !isValidShareId(rawPublishedId)
    ) {
      return {
        ok: false,
        status: 400,
        error: 'publishedId must be a community design id or null',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const publishedId = rawPublishedId;
    const lineageResult = sanitizeLineage(unwrapped.lineage);
    if (!lineageResult.ok) {
      return {
        ok: false,
        status: 400,
        error:
          'lineage must be null or carry string parentId, rootId, parentName, parentAuthorName, rootAuthorName',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const lineage = lineageResult.lineage;

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
      JSON.stringify({ name, tags, publishedId, lineage, ...validationPayload }),
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
        publishedId,
        lineage,
        type: 'designer',
        version: 1,
        params: validation.payload.params,
      }),
      'utf8'
    );

    // Always emit the new wrapper shape. Legacy posts become `name = ''`;
    // readers fall back from there. `tags` is always an array (possibly
    // empty). `publishedId`/`lineage` are spread conditionally so an absent
    // field stays absent (an explicit `undefined` key would hash like `null`
    // in the tiebreaker, conflating "never published" with "unpublished").
    // Equal-ms ties hash over every stored key, so renames, tag-only edits,
    // and publish/lineage-only edits all participate.
    const stored = {
      name,
      params: validation.payload.params,
      tags,
      ...(publishedId !== undefined ? { publishedId } : {}),
      ...(lineage !== undefined ? { lineage } : {}),
    };
    return {
      ok: true,
      envelope: { design: stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
      sizeBytes,
      tiebreakerCandidate: stored,
    };
  },
  storedComparable: (stored) => stored.design,
});
