import { ErrorCode, isValidShareId, MAX_NAME_LENGTH } from '../../lib/shared.js';
import { validateDesignerShare } from '../../lib/designerValidation.js';
import { validateAssemblyContent } from '../../lib/assemblyValidation.js';
import { sanitizeString } from '../../lib/validation.js';
import { createSyncResourceHandler } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** The PUT body / GET envelope key for this resource; mirrors `PAYLOAD_KEY.designVersions` in src/core/sync/payloadKey.ts. */
export const PAYLOAD_KEY = 'designVersion' as const;

/** Mirrors `DesignVersionOrigin` on the client. */
const ORIGINS = ['manual', 'pre-restore'] as const;
type Origin = (typeof ORIGINS)[number];

interface DesignVersionEnvelope {
  designVersion: unknown;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * The wire body carries the version's content **uncompressed**.
 *
 * Locally a version is stored LZ-compressed, but shipping that string would
 * hand the server an opaque blob it cannot check, and every other synced
 * payload here is validated before it is stored. The client decompresses on
 * push and re-compresses on apply, so the same `validateDesignerShare` that
 * guards a design guards a version of one.
 *
 * The thumbnail is deliberately absent from this shape: it is a rendered PNG
 * data URL that would consume most of `MAX_PAYLOAD_BYTES` on its own, and it
 * regenerates locally from the params.
 */
export default createSyncResourceHandler<DesignVersionEnvelope>({
  kind: 'designVersions',
  payloadKey: PAYLOAD_KEY,
  isValidId: (id) => isValidShareId(id),
  invalidIdError: 'Invalid design version id',
  deletedError: 'This design version was deleted on another device',
  buildPut: (payload, modifiedAt) => {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return {
        ok: false,
        status: 400,
        error: 'designVersion must be an object',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const body = payload as Record<string, unknown>;

    // A version is meaningless without the design it belongs to: an orphan row
    // would sync forever and never appear in any history list.
    if (typeof body.designId !== 'string' || body.designId.length === 0) {
      return {
        ok: false,
        status: 400,
        error: 'designVersion.designId is required',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const designId = sanitizeString(body.designId, MAX_NAME_LENGTH);

    if (typeof body.createdAt !== 'string' || Number.isNaN(Date.parse(body.createdAt))) {
      return {
        ok: false,
        status: 400,
        error: 'designVersion.createdAt must be an ISO timestamp',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const createdAt = new Date(body.createdAt).toISOString();

    const origin: Origin = ORIGINS.includes(body.origin as Origin)
      ? (body.origin as Origin)
      : 'manual';
    const pinned = body.pinned === true;
    const name = sanitizeString(typeof body.name === 'string' ? body.name : '', MAX_NAME_LENGTH);

    const content = body.content;
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return {
        ok: false,
        status: 400,
        error: 'designVersion.content must be an object',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const inner = content as Record<string, unknown>;
    const contentName = sanitizeString(
      typeof inner.name === 'string' ? inner.name : '',
      MAX_NAME_LENGTH
    );

    if (inner.kind !== undefined && inner.kind !== 'bin') {
      const preBytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
      const assembly = validateAssemblyContent(
        { envelope: inner.envelope, structure: inner.structure },
        { preBytes, sizeLabel: 'design version' }
      );
      if (!assembly.ok) return assembly;
      const stored = {
        designId,
        name,
        createdAt,
        origin,
        ...(pinned ? { pinned } : {}),
        content: {
          name: contentName,
          kind: inner.kind,
          envelope: assembly.envelope,
          structure: assembly.structure,
        },
      };
      return {
        ok: true,
        envelope: { designVersion: stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
        sizeBytes: Buffer.byteLength(JSON.stringify(stored), 'utf8'),
        tiebreakerCandidate: stored,
      };
    }

    const validationPayload = {
      type: 'designer' as const,
      version: 1 as const,
      params: inner.params,
    };
    const preValidationBytes = Buffer.byteLength(
      JSON.stringify({ name: contentName, ...validationPayload }),
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

    const stored = {
      designId,
      name,
      createdAt,
      origin,
      ...(pinned ? { pinned } : {}),
      content: { name: contentName, params: validation.payload.params },
    };
    return {
      ok: true,
      envelope: { designVersion: stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
      sizeBytes: Buffer.byteLength(JSON.stringify(stored), 'utf8'),
      tiebreakerCandidate: stored,
    };
  },
  storedComparable: (stored) => stored.designVersion,
});
