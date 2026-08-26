/**
 * Server-side validation for community publish/update payloads.
 *
 * The design params themselves are validated by the existing
 * `validateDesignerShare` (same allowlist + caps as designer shares); this
 * module validates the publish envelope around them (name, description,
 * author display name, category, thumbnails, GLB) and derives technique tags
 * from the sanitized params.
 */

import { checkText, filterDisplayName, filterSharedDesignsContent } from './contentFilter.js';
import { validateDesignerShare } from './designerValidation.js';
import {
  sanitizeAssemblyContent,
  validateAssemblyEnvelope,
  validateAssemblyStructure,
} from './assemblyValidation.js';
import { isValidShareId } from './shared.js';
import type { ErrorCodeType } from './shared.js';
import { isObject, isString, validationError } from './validationUtils.js';
import {
  classifyCommunityDescription,
  classifyCommunityName,
  COMMUNITY_DESCRIPTION_MIN_LENGTH,
  COMMUNITY_NAME_MIN_LENGTH,
} from './communityLowEffort.js';
import type { CommunityLineage } from './communityStore.js';

/**
 * MIRROR: must match `COMMUNITY_CATEGORIES` in `src/shared/types/community.ts`
 * (api/ cannot import from src/). Update both sides together; the
 * cross-boundary equality test in `src/shared/types/community.test.ts` guards
 * against drift.
 */
export const COMMUNITY_CATEGORIES = [
  'tools',
  'hardware',
  'kitchen',
  'office',
  'crafts',
  'electronics',
  'toys-games',
  'other',
] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

/**
 * Closed union of report reasons, matching the detail view's radio options
 * (Inappropriate, Spam, Doesn't generate correctly, Stolen work). Registered
 * in scripts/check-union-exhaustiveness.sh.
 */
export const COMMUNITY_REPORT_REASONS = ['inappropriate', 'spam', 'broken', 'stolen'] as const;
export type CommunityReportReason = (typeof COMMUNITY_REPORT_REASONS)[number];
export const COMMUNITY_REPORT_NOTE_MAX_LENGTH = 500;

export type ParsedReportBody =
  | { readonly ok: true; readonly reason: CommunityReportReason; readonly note: string }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: ErrorCodeType;
      readonly message: string;
    };

/**
 * One report-body contract for design reports and print reports: same reason
 * allowlist, same note policy (absent or null means no note, over-length is
 * truncated BEFORE the content filter's ReDoS-prone regexes run, blocked
 * content is CONTENT_BLOCKED).
 */
export function parseReportBody(body: Record<string, unknown>): ParsedReportBody {
  const { reason, note } = body;
  if (!isString(reason) || !(COMMUNITY_REPORT_REASONS as readonly string[]).includes(reason)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: `reason must be one of: ${COMMUNITY_REPORT_REASONS.join(', ')}`,
    };
  }
  let parsedNote = '';
  if (note !== undefined && note !== null) {
    if (!isString(note)) {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'note must be a string' };
    }
    parsedNote = note.slice(0, COMMUNITY_REPORT_NOTE_MAX_LENGTH);
    if (parsedNote !== '' && !checkText(parsedNote).passed) {
      return {
        ok: false,
        status: 400,
        code: 'CONTENT_BLOCKED',
        message: 'note contains prohibited content',
      };
    }
  }
  return { ok: true, reason: reason as CommunityReportReason, note: parsedNote };
}

/**
 * Description-required publish policy toggle. Default ON; set
 * COMMUNITY_REQUIRE_DESCRIPTION to the literal string 'false' to relax it. The
 * server is the final authority. Documented in CLAUDE.md's env section.
 */
export function communityRequiresDescription(): boolean {
  return process.env.COMMUNITY_REQUIRE_DESCRIPTION !== 'false';
}

/**
 * The rejection to send for a description, or null when it passes. Each issue
 * gets its own code so the client can route it to the field.
 */
export function checkCommunityDescriptionPolicy(
  description: string
): { code: string; message: string } | null {
  if (!communityRequiresDescription()) return null;
  const issue = classifyCommunityDescription(description);
  if (issue === null) return null;
  if (issue === 'too-short') {
    return {
      code: 'DESCRIPTION_TOO_SHORT',
      message: `Description must be at least ${COMMUNITY_DESCRIPTION_MIN_LENGTH} characters.`,
    };
  }
  if (issue === 'low-effort') {
    return {
      code: 'DESCRIPTION_LOW_EFFORT',
      message: 'Description is too generic; say what this design is for.',
    };
  }
  return {
    code: 'DESCRIPTION_REQUIRED',
    message: 'Add a description saying what this design is for.',
  };
}

/**
 * MIRROR: must match `COMMUNITY_FEATURE_REASONS` in
 * `src/shared/types/community.ts` (api/ cannot import from src/). Guarded by
 * the cross-boundary equality test in `community.test.ts`.
 */
export const COMMUNITY_FEATURE_REASONS = [
  'well-made',
  'clever',
  'versatile',
  'beginner-friendly',
] as const;
export type CommunityFeatureReason = (typeof COMMUNITY_FEATURE_REASONS)[number];

export function isCommunityFeatureReason(value: string): value is CommunityFeatureReason {
  return (COMMUNITY_FEATURE_REASONS as readonly string[]).includes(value);
}

/**
 * Drop C0/C1 control bytes from a user-authored display string.
 *
 * `trim()` only removes control characters at the ends, and the content filter
 * normalizes Unicode tricks but not raw ESC/CR. These fields are later printed
 * to a moderator's TTY by the community-admin CLI, where an interior ESC can
 * rewrite the screen the operator is deciding from. The CLI escapes on output
 * too — this keeps newly-stored data clean at the door.
 */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex -- the point is to match control bytes
  return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

export const COMMUNITY_NAME_MAX_LENGTH = 60;
export const COMMUNITY_DESCRIPTION_MAX_LENGTH = 500;
/** Matches MAX_DISPLAY_NAME_LENGTH in supporters.ts: one cap for every rendered public name. */
export const COMMUNITY_AUTHOR_NAME_MAX_LENGTH = 32;
export const MAX_COMMUNITY_THUMBNAILS = 3;
export const MAX_COMMUNITY_THUMBNAIL_BYTES = 200_000;
export const MAX_COMMUNITY_GLB_BYTES = 2_000_000;
// Per-assembly content cap, matching the sync endpoint's design payload budget.
const MAX_COMMUNITY_ASSEMBLY_BYTES = 100 * 1024;

/**
 * MIRROR: derivation logic must match `deriveTechniques` in
 * `src/shared/utils/communityTechniques.ts` (client copy; api/ cannot import
 * from src/). Union order mirrors `ExampleTechnique` in
 * `src/shared/types/exampleTechniques.ts`. Update both sides together; the
 * cross-boundary equality test in
 * `src/shared/utils/communityTechniques.crossBoundary.test.ts` guards against
 * drift.
 */
export const COMMUNITY_TECHNIQUES = [
  'compartments',
  'wallCutouts',
  'scoop',
  'labelTab',
  'slotted',
  'lid',
  'handles',
  'customShape',
  'wallPattern',
  'workshop',
] as const;
export type CommunityTechnique = (typeof COMMUNITY_TECHNIQUES)[number];

function isEnabledFeature(value: unknown): boolean {
  return isObject(value) && value.enabled === true;
}

function compartmentCount(value: unknown): number {
  if (!isObject(value) || !Array.isArray(value.cells)) return 1;
  return new Set(value.cells).size;
}

// Mirrors `isPartialMask` in src/shared/utils/cellMask.ts: an all-filled mask
// is treated as a plain rectangle by the generator, so it must not tag.
function isPartialCellMask(value: unknown): boolean {
  if (!isObject(value) || !Array.isArray(value.cells)) return false;
  return value.cells.some((cell) => cell === 0);
}

/**
 * Derive technique tags from validated, sanitized params.
 *
 * Each predicate is the same gate the generation pipeline itself checks before
 * building the feature. Two traps encoded here: `walls`/`handles` per-side
 * sub-objects ship enabled in the defaults, so only the master `enabled` flag
 * is authoritative; and `slotConfig` is populated even on standard bins, so
 * `slotted` keys off `style` alone.
 */
export function deriveCommunityTechniques(params: Record<string, unknown>): CommunityTechnique[] {
  const techniques: CommunityTechnique[] = [];
  if (compartmentCount(params.compartments) > 1) techniques.push('compartments');
  if (isEnabledFeature(params.walls)) techniques.push('wallCutouts');
  if (isEnabledFeature(params.scoop)) techniques.push('scoop');
  if (isEnabledFeature(params.label)) techniques.push('labelTab');
  if (params.style === 'slotted') techniques.push('slotted');
  if (isEnabledFeature(params.lid)) techniques.push('lid');
  if (isEnabledFeature(params.handles)) techniques.push('handles');
  if (isPartialCellMask(params.cellMask)) techniques.push('customShape');
  if (isEnabledFeature(params.wallPattern)) techniques.push('wallPattern');
  return techniques;
}

export type CommunityLineageParseResult =
  { ok: true; lineage: CommunityLineage | null } | { ok: false; message: string };

function lineageName(value: unknown, maxLength: number): string | null {
  if (!isString(value)) return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) return null;
  if (!checkText(trimmed).passed) return null;
  return trimmed;
}

/**
 * Shape-validates the publish payload's lineage envelope. The name fields
 * parsed here are only fallback snapshots: the publish handler re-derives
 * them from the stored parent record.
 */
export function parseCommunityLineage(value: unknown): CommunityLineageParseResult {
  if (value === undefined || value === null) return { ok: true, lineage: null };
  if (!isObject(value)) return { ok: false, message: 'lineage must be an object' };
  if (!isValidShareId(value.parentId)) {
    return { ok: false, message: 'lineage.parentId must be a valid design id' };
  }
  if (!isValidShareId(value.rootId)) {
    return { ok: false, message: 'lineage.rootId must be a valid design id' };
  }
  const parentName = lineageName(value.parentName, COMMUNITY_NAME_MAX_LENGTH);
  if (parentName === null) return { ok: false, message: 'lineage.parentName is invalid' };
  const parentAuthorName = lineageName(value.parentAuthorName, COMMUNITY_AUTHOR_NAME_MAX_LENGTH);
  if (parentAuthorName === null) {
    return { ok: false, message: 'lineage.parentAuthorName is invalid' };
  }
  const rootAuthorName = lineageName(value.rootAuthorName, COMMUNITY_AUTHOR_NAME_MAX_LENGTH);
  if (rootAuthorName === null) return { ok: false, message: 'lineage.rootAuthorName is invalid' };
  return {
    ok: true,
    lineage: {
      parentId: value.parentId,
      rootId: value.rootId,
      parentName,
      parentAuthorName,
      rootAuthorName,
    },
  };
}

export interface CommunityPublishPayload {
  name: string;
  description: string;
  authorName: string;
  category: CommunityCategory;
  /** Sanitized, allowlist-filtered params from `validateDesignerShare`; persist
   *  these, never the raw input. Absent on a Workshop assembly publish. */
  params?: Record<string, unknown>;
  /** Workshop assemblies publish envelope + structure instead of params,
   *  validated by the same deep validators the sync endpoint uses. */
  kind?: 'assembly';
  envelope?: Record<string, unknown>;
  structure?: Record<string, unknown>;
  /** Server-derived standing height in height units — computed from the
   *  validated part tree, never client-supplied. */
  heightUnits?: number;
  techniques: CommunityTechnique[];
  /** Raw base64 (any data-URL prefix stripped), ready to decode for blob upload. */
  thumbnails: string[];
  /** Raw base64 GLB, magic-byte checked. */
  glb: string;
}

export type CommunityValidationResult =
  | { valid: true; payload: CommunityPublishPayload }
  | { valid: false; error: { code: string; message: string } };

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;
const WEBP_DATA_URL_PREFIX = 'data:image/webp;base64,';

// Worst-case encoded length for a decoded cap, checked before the base64
// regex runs so the regex never walks an unbounded string.
function maxEncodedLength(maxDecodedBytes: number): number {
  return Math.ceil(maxDecodedBytes / 3) * 4 + 4;
}

function decodedBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

// WebP is RIFF-framed: 'RIFF' at 0-3, 'WEBP' at 8-11. Slicing at a
// 4-char base64 boundary decodes the header without touching the body.
function hasWebpMagic(base64: string): boolean {
  const head = Buffer.from(base64.slice(0, 24), 'base64');
  return (
    head.length >= 12 &&
    head.toString('latin1', 0, 4) === 'RIFF' &&
    head.toString('latin1', 8, 12) === 'WEBP'
  );
}

function hasGlbMagic(base64: string): boolean {
  const head = Buffer.from(base64.slice(0, 8), 'base64');
  return head.length >= 4 && head.toString('latin1', 0, 4) === 'glTF';
}

type AssetCheck = { ok: true; base64: string } | { ok: false; message: string };

function checkThumbnail(value: unknown, index: number): AssetCheck {
  if (!isString(value)) {
    return { ok: false, message: `thumbnails[${index}] must be a string` };
  }
  let base64 = value;
  if (base64.startsWith('data:')) {
    if (!base64.startsWith(WEBP_DATA_URL_PREFIX)) {
      return { ok: false, message: `thumbnails[${index}] must be an image/webp data URL` };
    }
    base64 = base64.slice(WEBP_DATA_URL_PREFIX.length);
  }
  if (base64.length === 0) {
    return { ok: false, message: `thumbnails[${index}] is empty` };
  }
  if (base64.length > maxEncodedLength(MAX_COMMUNITY_THUMBNAIL_BYTES)) {
    return {
      ok: false,
      message: `thumbnails[${index}] exceeds ${MAX_COMMUNITY_THUMBNAIL_BYTES} decoded bytes`,
    };
  }
  if (!BASE64_REGEX.test(base64)) {
    return { ok: false, message: `thumbnails[${index}] must be base64` };
  }
  if (decodedBase64Bytes(base64) > MAX_COMMUNITY_THUMBNAIL_BYTES) {
    return {
      ok: false,
      message: `thumbnails[${index}] exceeds ${MAX_COMMUNITY_THUMBNAIL_BYTES} decoded bytes`,
    };
  }
  if (!hasWebpMagic(base64)) {
    return { ok: false, message: `thumbnails[${index}] is not a WebP image` };
  }
  return { ok: true, base64 };
}

function checkGlb(value: unknown): AssetCheck {
  if (!isString(value) || value.length === 0) {
    return { ok: false, message: 'glb must be a base64 string' };
  }
  if (value.length > maxEncodedLength(MAX_COMMUNITY_GLB_BYTES)) {
    return { ok: false, message: `glb exceeds ${MAX_COMMUNITY_GLB_BYTES} decoded bytes` };
  }
  if (!BASE64_REGEX.test(value)) {
    return { ok: false, message: 'glb must be base64' };
  }
  if (decodedBase64Bytes(value) > MAX_COMMUNITY_GLB_BYTES) {
    return { ok: false, message: `glb exceeds ${MAX_COMMUNITY_GLB_BYTES} decoded bytes` };
  }
  if (!hasGlbMagic(value)) {
    return { ok: false, message: 'glb is missing the glTF magic bytes' };
  }
  return { ok: true, base64: value };
}

export function validateCommunityPublish(body: unknown): CommunityValidationResult {
  if (!isObject(body)) {
    return validationError('INVALID_PAYLOAD', 'Request body must be an object');
  }

  if (!isString(body.name)) {
    return validationError('INVALID_NAME', 'name must be a string');
  }
  const name = stripControlChars(body.name).trim();
  if (name.length > COMMUNITY_NAME_MAX_LENGTH) {
    return validationError(
      'INVALID_NAME',
      `name must be 1-${COMMUNITY_NAME_MAX_LENGTH} characters`
    );
  }
  // Low-effort name guard (B2): empty/whitespace keeps the legacy INVALID_NAME
  // code; the new junk categories get their own actionable codes.
  const nameIssue = classifyCommunityName(name);
  if (nameIssue === 'empty') {
    return validationError(
      'INVALID_NAME',
      `name must be 1-${COMMUNITY_NAME_MAX_LENGTH} characters`
    );
  }
  if (nameIssue === 'too-short') {
    return validationError(
      'NAME_TOO_SHORT',
      `name must be at least ${COMMUNITY_NAME_MIN_LENGTH} characters`
    );
  }
  if (nameIssue === 'placeholder') {
    return validationError(
      'NAME_PLACEHOLDER',
      'name is the default placeholder; rename the design'
    );
  }
  if (nameIssue === 'low-effort') {
    return validationError('NAME_LOW_EFFORT', 'name is too generic; use a descriptive name');
  }

  let description = '';
  if (body.description !== undefined) {
    if (!isString(body.description)) {
      return validationError('INVALID_DESCRIPTION', 'description must be a string');
    }
    description = body.description.trim();
  }
  if (description.length > COMMUNITY_DESCRIPTION_MAX_LENGTH) {
    return validationError(
      'INVALID_DESCRIPTION',
      `description must be at most ${COMMUNITY_DESCRIPTION_MAX_LENGTH} characters`
    );
  }
  // Must stay ahead of the content filter: that rejection cannot name a field,
  // so keysmash would surface as "prohibited content" on no input.
  const descriptionRejection = checkCommunityDescriptionPolicy(description);
  if (descriptionRejection !== null) {
    return validationError(descriptionRejection.code, descriptionRejection.message);
  }

  if (!isString(body.authorName)) {
    return validationError('INVALID_AUTHOR_NAME', 'authorName must be a string');
  }
  const authorName = stripControlChars(body.authorName).trim();
  if (authorName.length < 1 || authorName.length > COMMUNITY_AUTHOR_NAME_MAX_LENGTH) {
    return validationError(
      'INVALID_AUTHOR_NAME',
      `authorName must be 1-${COMMUNITY_AUTHOR_NAME_MAX_LENGTH} characters`
    );
  }

  // Length caps above bound every string before the filter's regexes run
  // (they are ReDoS-prone on unbounded input). A publish has no "show as
  // anonymous" fallback, so a filter failure is a hard reject.
  if (!checkText(name).passed) {
    return validationError('CONTENT_BLOCKED', 'name contains prohibited content');
  }
  if (description !== '' && !checkText(description).passed) {
    return validationError('CONTENT_BLOCKED', 'description contains prohibited content');
  }
  if (!filterDisplayName(authorName).passed) {
    return validationError('CONTENT_BLOCKED', 'authorName contains prohibited content');
  }

  if (
    !isString(body.category) ||
    !(COMMUNITY_CATEGORIES as readonly string[]).includes(body.category)
  ) {
    return validationError(
      'INVALID_CATEGORY',
      `category must be one of: ${COMMUNITY_CATEGORIES.join(', ')}`
    );
  }
  const category = body.category as CommunityCategory;

  let params: Record<string, unknown> | undefined;
  let assembly:
    | {
        envelope: Record<string, unknown>;
        structure: Record<string, unknown>;
        heightUnits: number;
      }
    | undefined;
  if (body.kind === 'assembly') {
    // Workshop assembly: the same deep validators the sync endpoint trusts,
    // so a community publish can't become a side door around them.
    const envelopeResult = validateAssemblyEnvelope(body.envelope);
    if (!envelopeResult.valid) {
      return { valid: false, error: envelopeResult.error };
    }
    const structureResult = validateAssemblyStructure(body.structure);
    if (!structureResult.valid) {
      return { valid: false, error: structureResult.error };
    }
    // Project onto the known shape: unknown keys drop, part ids are reduced
    // to a machine-safe charset, and the standing height derives from the
    // validated part tree — the client cannot smuggle strings past the
    // validators or game the stored height.
    const sanitized = sanitizeAssemblyContent(body.envelope, body.structure);
    const assemblyBytes = Buffer.byteLength(
      JSON.stringify({ envelope: sanitized.envelope, structure: sanitized.structure }),
      'utf8'
    );
    if (assemblyBytes > MAX_COMMUNITY_ASSEMBLY_BYTES) {
      return validationError(
        'SIZE_LIMIT',
        `design exceeds maximum size of ${MAX_COMMUNITY_ASSEMBLY_BYTES / 1024}KB`
      );
    }
    const heightUnitMm = (sanitized.envelope.heightUnitMm as number) || 7;
    assembly = {
      envelope: sanitized.envelope,
      structure: sanitized.structure,
      heightUnits: Math.max(1, Math.ceil(sanitized.riseMm / heightUnitMm)),
    };
    // Assembly structures carry no free text after the projection, so the
    // name/description sweeps above are the whole text surface.
  } else {
    if (!isObject(body.params)) {
      return validationError('MISSING_PARAMS', 'params must be an object');
    }
    const designerPayload = { type: 'designer' as const, version: 1 as const, params: body.params };
    // sizeBytes covers what the design blob will actually persist (envelope +
    // params). Thumbnails and the GLB are separate blobs with their own caps.
    const sizeBytes = Buffer.byteLength(
      JSON.stringify({ name, description, category, ...designerPayload }),
      'utf8'
    );
    const designResult = validateDesignerShare(designerPayload, sizeBytes);
    if (!designResult.valid) {
      return { valid: false, error: designResult.error };
    }
    params = designResult.payload.params;

    // Sweeps engraved/label text nested inside the sanitized params, a
    // separate channel from the envelope strings checked above.
    const designText = filterSharedDesignsContent([{ name, params }]);
    if (!designText.passed) {
      return validationError('CONTENT_BLOCKED', designText.reason ?? 'contains prohibited content');
    }
  }

  if (!Array.isArray(body.thumbnails) || body.thumbnails.length < 1) {
    return validationError('INVALID_THUMBNAILS', 'thumbnails must be a non-empty array');
  }
  if (body.thumbnails.length > MAX_COMMUNITY_THUMBNAILS) {
    return validationError(
      'INVALID_THUMBNAILS',
      `at most ${MAX_COMMUNITY_THUMBNAILS} thumbnails allowed`
    );
  }
  const thumbnails: string[] = [];
  for (let i = 0; i < body.thumbnails.length; i++) {
    const check = checkThumbnail(body.thumbnails[i], i);
    if (!check.ok) return validationError('INVALID_THUMBNAILS', check.message);
    thumbnails.push(check.base64);
  }

  const glbCheck = checkGlb(body.glb);
  if (!glbCheck.ok) return validationError('INVALID_GLB', glbCheck.message);

  return {
    valid: true,
    payload: {
      name,
      description,
      authorName,
      category,
      ...(assembly !== undefined
        ? { kind: 'assembly' as const, ...assembly, techniques: ['workshop' as const] }
        : { params, techniques: deriveCommunityTechniques(params ?? {}) }),
      thumbnails,
      glb: glbCheck.base64,
    },
  };
}
