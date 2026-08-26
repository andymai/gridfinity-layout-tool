import { ErrorCode, isValidShareId, MAX_NAME_LENGTH } from '../../lib/shared.js';
import { validateDesignerShare, sanitizeTags } from '../../lib/designerValidation.js';
import { validateAssemblyContent } from '../../lib/assemblyValidation.js';
import { sanitizeString } from '../../lib/validation.js';
import { createSyncResourceHandler } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** The PUT body / GET envelope key for this resource; mirrors `PAYLOAD_KEY.designs` in src/core/sync/payloadKey.ts. */
export const PAYLOAD_KEY = 'design' as const;

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
interface BranchLineage {
  parentDesignId?: string;
  parentVersionId?: string;
  parentVersionName?: string;
  variantOf?: string;
  overrides?: StoredOverrides;
}

interface StoredOverrides {
  dimensions?: Record<string, number>;
  cutouts?: Record<string, Record<string, number>>;
}

/** Fields a variant may claim. Mirrors the client's curated override surface. */
const DIMENSION_FIELDS = new Set(['width', 'depth', 'height', 'wallThickness']);
const CUTOUT_FIELDS = new Set(['width', 'depth', 'cutDepth', 'clearance', 'chamferWidth']);

/** Bounds the record so a crafted payload cannot store an unbounded map. */
const MAX_CUTOUT_OVERRIDES = 400;

function finiteNumbers(
  value: unknown,
  allowed: ReadonlySet<string>
): Record<string, number> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!allowed.has(key)) continue;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    out[key] = raw;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Validate a variant's claimed values.
 *
 * Unknown keys and non-finite numbers are dropped rather than rejected: the
 * override set is the client's curated surface and a newer client may name a
 * field this server has not heard of, which must not make the whole design
 * unsyncable. What survives is bounded and numeric, which is all the resolver
 * needs.
 */
function sanitizeOverrides(value: unknown): StoredOverrides | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const raw = value as { dimensions?: unknown; cutouts?: unknown };

  const dimensions = finiteNumbers(raw.dimensions, DIMENSION_FIELDS);

  let cutouts: Record<string, Record<string, number>> | undefined;
  if (typeof raw.cutouts === 'object' && raw.cutouts !== null && !Array.isArray(raw.cutouts)) {
    const entries: Record<string, Record<string, number>> = {};
    for (const [cutoutId, fields] of Object.entries(raw.cutouts).slice(0, MAX_CUTOUT_OVERRIDES)) {
      if (typeof cutoutId !== 'string' || cutoutId.length === 0) continue;
      const sanitized = finiteNumbers(fields, CUTOUT_FIELDS);
      if (sanitized) entries[sanitizeString(cutoutId, MAX_NAME_LENGTH)] = sanitized;
    }
    if (Object.keys(entries).length > 0) cutouts = entries;
  }

  if (!dimensions && !cutouts) return undefined;
  return { ...(dimensions ? { dimensions } : {}), ...(cutouts ? { cutouts } : {}) };
}

/**
 * Local branch lineage: which design this one was branched from, and which
 * version seeded it.
 *
 * Opaque passthrough, like `publishedId`: the server never resolves these ids,
 * they only exist so the owning library can draw the family. Non-string values
 * are dropped rather than rejected, because a malformed pointer costs a nesting
 * indent, not correctness, and refusing the write would block the design itself.
 */
function sanitizeBranch(
  parentDesignId: unknown,
  parentVersionId: unknown,
  parentVersionName: unknown,
  variantOf: unknown,
  overrides: unknown
): BranchLineage {
  const claimed = sanitizeOverrides(overrides);
  return {
    ...(typeof variantOf === 'string' && variantOf.length > 0
      ? { variantOf: sanitizeString(variantOf, MAX_NAME_LENGTH) }
      : {}),
    ...(claimed ? { overrides: claimed } : {}),
    ...(typeof parentDesignId === 'string' && parentDesignId.length > 0
      ? { parentDesignId: sanitizeString(parentDesignId, MAX_NAME_LENGTH) }
      : {}),
    ...(typeof parentVersionId === 'string' && parentVersionId.length > 0
      ? { parentVersionId: sanitizeString(parentVersionId, MAX_NAME_LENGTH) }
      : {}),
    ...(typeof parentVersionName === 'string'
      ? { parentVersionName: sanitizeString(parentVersionName, MAX_NAME_LENGTH) }
      : {}),
  };
}

function unwrapDesignPayload(design: unknown): {
  name: string | null;
  params: unknown;
  kind?: 'assembly';
  envelope?: unknown;
  structure?: unknown;
  tags: unknown;
  publishedId: unknown;
  lineage: unknown;
  branch: BranchLineage;
} | null {
  if (design === null || typeof design !== 'object') return null;
  const {
    name,
    params,
    kind,
    envelope,
    structure,
    tags,
    publishedId,
    lineage,
    parentDesignId,
    parentVersionId,
    parentVersionName,
    variantOf,
    overrides,
  } = design as {
    name?: unknown;
    params?: unknown;
    kind?: unknown;
    envelope?: unknown;
    structure?: unknown;
    tags?: unknown;
    publishedId?: unknown;
    lineage?: unknown;
    parentDesignId?: unknown;
    parentVersionId?: unknown;
    parentVersionName?: unknown;
    variantOf?: unknown;
    overrides?: unknown;
  };
  const branch = sanitizeBranch(
    parentDesignId,
    parentVersionId,
    parentVersionName,
    variantOf,
    overrides
  );
  if (kind === 'assembly') {
    if (name !== undefined && typeof name !== 'string') return null;
    if (typeof envelope !== 'object' || envelope === null) return null;
    if (typeof structure !== 'object' || structure === null) return null;
    return {
      name: name ?? null,
      params: null,
      kind: 'assembly',
      envelope,
      structure,
      tags,
      publishedId,
      lineage,
      branch,
    };
  }
  if (typeof params === 'object' && params !== null) {
    // Wrapper shape: name must be a string or absent. Reject other types
    // so malformed clients can't silently drop the user-visible field.
    if (name !== undefined && typeof name !== 'string') return null;
    // `tags` is sanitized (not strictly validated) downstream, so any shape
    // is tolerated here; non-array input becomes [].
    return { name: name ?? null, params, tags, publishedId, lineage, branch };
  }
  return {
    name: null,
    params: design,
    tags: undefined,
    publishedId: undefined,
    lineage: undefined,
    branch: {},
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
  payloadKey: PAYLOAD_KEY,
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
    if (unwrapped.kind === 'assembly') {
      const preBytes = Buffer.byteLength(JSON.stringify({ ...unwrapped, name, tags }), 'utf8');
      const assembly = validateAssemblyContent(
        { envelope: unwrapped.envelope, structure: unwrapped.structure },
        { preBytes, sizeLabel: 'assembly design' }
      );
      if (!assembly.ok) return assembly;
      const stored = {
        name,
        kind: 'assembly' as const,
        envelope: assembly.envelope,
        structure: assembly.structure,
        tags,
        ...(publishedId !== undefined ? { publishedId } : {}),
        ...(lineage !== undefined ? { lineage } : {}),
        ...unwrapped.branch,
      };
      return {
        ok: true,
        envelope: { design: stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
        sizeBytes: Buffer.byteLength(JSON.stringify(stored), 'utf8'),
        tiebreakerCandidate: stored,
      };
    }

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
      ...unwrapped.branch,
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
