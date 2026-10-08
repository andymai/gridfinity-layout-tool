/**
 * Server-side validation for whole-bin STL designs (`importedMesh`): a
 * hand-written mirror of `importedMeshSchema` in
 * src/shared/items/importedMesh/descriptor.ts and of the item envelope
 * (api/ cannot import from src/; keep them in sync). The asset gets the bounds
 * a bin's mesh assets get, and may be a ref to a stored mesh file.
 */
import { isBoolean, isNumber, inRange, isObject, isString } from './validationUtils.js';
import { CONSTRAINTS } from './designerValidationConstants.js';
import { validateAssemblyEnvelope } from './assemblyValidation.js';
import { isMeshRef, validateMeshAsset } from './designerCutoutValidation.js';
import { ErrorCode, type ErrorCodeType } from './shared.js';

/** MIRROR: `MAX_IMPORTED_MESH_HEIGHT_UNITS` in src/shared/items/importedMesh/descriptor.ts. */
export const MAX_IMPORTED_MESH_HEIGHT_UNITS = 20;
/** MIRROR: the `sourceFileName` bound of `importedMeshSchema`. */
export const MAX_SOURCE_FILE_NAME_LENGTH = 255;

/** MIRROR: the fields of `ItemEnvelope` in src/shared/types/item.ts. */
const ENVELOPE_KEYS = new Set([
  'width',
  'depth',
  'gridUnitMm',
  'heightUnitMm',
  'attachment',
  'featureColors',
]);
/** MIRROR: the fields of `AttachmentConfig` in src/shared/types/item.ts. */
const ATTACHMENT_KEYS = new Set([
  'magnetHoles',
  'magnetDiameter',
  'magnetDepth',
  'magnetCrushRibs',
  'magnetChamfer',
  'screwHoles',
  'screwDiameter',
]);
const OPTIONAL_ATTACHMENT_FLAGS = ['magnetCrushRibs', 'magnetChamfer'] as const;
/** MIRROR: the fields of `ImportedMeshStructure` in src/shared/types/item.ts. */
const STRUCTURE_KEYS = new Set(['kind', 'heightUnits', 'asset', 'volumeMm3', 'sourceFileName']);

function unknownKey(value: Record<string, unknown>, allowed: ReadonlySet<string>): string | null {
  return Object.keys(value).find((key) => !allowed.has(key)) ?? null;
}

export function validateImportedMeshEnvelope(envelope: unknown): string | null {
  if (!isObject(envelope)) return 'envelope must be an object';
  const extra = unknownKey(envelope, ENVELOPE_KEYS);
  if (extra !== null) return `envelope has unknown key: ${extra}`;
  if (isObject(envelope.attachment)) {
    const extraAttachment = unknownKey(envelope.attachment, ATTACHMENT_KEYS);
    if (extraAttachment !== null) return `envelope.attachment has unknown key: ${extraAttachment}`;
    for (const flag of OPTIONAL_ATTACHMENT_FLAGS) {
      const value = envelope.attachment[flag];
      if (value !== undefined && !isBoolean(value)) {
        return `envelope.attachment.${flag} must be boolean`;
      }
    }
  }
  // The import dialog and the panel step the claim within a bin's footprint,
  // tighter than an assembly's.
  for (const axis of ['width', 'depth'] as const) {
    const value = envelope[axis];
    if (!isNumber(value) || !inRange(value, CONSTRAINTS.MIN_DIMENSION, CONSTRAINTS.MAX_DIMENSION)) {
      return `envelope.${axis} must be between ${CONSTRAINTS.MIN_DIMENSION} and ${CONSTRAINTS.MAX_DIMENSION}`;
    }
  }
  // The rest is the envelope every item kind shares: units, attachment, colors.
  const shared = validateAssemblyEnvelope(envelope);
  return shared.valid ? null : shared.error.message;
}

/** The asset may be inline or name a stored mesh file by hash. */
export function validateImportedMeshStructure(structure: unknown): string | null {
  if (!isObject(structure)) return 'structure must be an object';
  const extra = unknownKey(structure, STRUCTURE_KEYS);
  if (extra !== null) return `structure has unknown key: ${extra}`;
  if (structure.kind !== 'importedMesh') return 'structure.kind must be importedMesh';
  const { heightUnits, volumeMm3, sourceFileName } = structure;
  if (
    !isNumber(heightUnits) ||
    !Number.isInteger(heightUnits) ||
    !inRange(heightUnits, 1, MAX_IMPORTED_MESH_HEIGHT_UNITS)
  ) {
    return `structure.heightUnits must be an integer in [1, ${MAX_IMPORTED_MESH_HEIGHT_UNITS}]`;
  }
  if (volumeMm3 !== undefined && !(isNumber(volumeMm3) && volumeMm3 > 0)) {
    return 'structure.volumeMm3 must be a positive number';
  }
  if (
    sourceFileName !== undefined &&
    !(isString(sourceFileName) && sourceFileName.length <= MAX_SOURCE_FILE_NAME_LENGTH)
  ) {
    return `structure.sourceFileName must be a string (max ${MAX_SOURCE_FILE_NAME_LENGTH} chars)`;
  }
  return validateMeshAsset(structure.asset, 'structure.asset', true);
}

export type ImportedMeshContentResult =
  | {
      ok: true;
      envelope: unknown;
      structure: unknown;
      /** The stored mesh file the asset names, which the account must hold. */
      meshHashes: string[];
    }
  | { ok: false; status: number; error: string; code: ErrorCodeType };

const rejectContent = (error: string): ImportedMeshContentResult => ({
  ok: false,
  status: 400,
  error,
  code: ErrorCode.VALIDATION_ERROR,
});

/**
 * Validate an imported-mesh design or version body for sync. `preBytes` is the
 * caller's to measure, as for `validateAssemblyContent`. Only an inline asset
 * earns the raised mesh cap: a ref is a few hundred bytes, so a design of refs
 * keeps the cap of a design without meshes.
 */
export function validateImportedMeshContent(
  content: { envelope: unknown; structure: unknown },
  options: { preBytes: number; sizeLabel: string }
): ImportedMeshContentResult {
  if (options.preBytes > CONSTRAINTS.MESH_MAX_PAYLOAD_BYTES) {
    return rejectContent(`${options.sizeLabel} exceeds the size limit`);
  }
  const envelopeError = validateImportedMeshEnvelope(content.envelope);
  if (envelopeError) return rejectContent(envelopeError);
  const structureError = validateImportedMeshStructure(content.structure);
  if (structureError) return rejectContent(structureError);
  const asset = (content.structure as { asset: Record<string, unknown> }).asset;
  const ref = isMeshRef(asset);
  if (ref && options.preBytes > CONSTRAINTS.MAX_PAYLOAD_BYTES) {
    return rejectContent(`${options.sizeLabel} exceeds the size limit`);
  }
  return {
    ok: true,
    envelope: content.envelope,
    structure: content.structure,
    meshHashes: ref ? [asset.hash as string] : [],
  };
}
