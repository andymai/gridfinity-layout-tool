/**
 * Server-side validation for designer share payloads.
 *
 * Validates BinParams structure and constraints before storing in Blob.
 * These constraints mirror DESIGNER_CONSTRAINTS from the client.
 */

import {
  isNumber,
  inRange,
  isString,
  isBoolean,
  isObject,
  validationError,
} from './validationUtils.js';

// Type-safe enum validation
const VALID_BIN_STYLES = ['standard', 'slotted'] as const;
const VALID_BASE_STYLES = ['standard', 'magnet', 'screw', 'magnet_and_screw', 'weighted'] as const;
const VALID_LABEL_TAB_SUPPORTS = ['bracket', 'solid'] as const;
const VALID_INSERT_SHAPES = ['rectangle', 'circle', 'hexagon', 'rounded-rect', 'slot'] as const;
const VALID_WALL_CUTOUT_SHAPES = ['u-shape', 'scoop', 'funnel'] as const;
const VALID_ROTATIONS = [0, 90, 180, 270] as const;

// Constraints (server-side copies of client DESIGNER_CONSTRAINTS)
const CONSTRAINTS = {
  MIN_DIMENSION: 0.5,
  MAX_DIMENSION: 8,
  MIN_HEIGHT: 2,
  MAX_HEIGHT: 20,
  MAX_DIVIDERS: 10,
  MIN_DIVIDER_THICKNESS: 0.8,
  MAX_DIVIDER_THICKNESS: 2.0,
  MIN_COMPARTMENT_GRID: 1,
  MAX_COMPARTMENT_GRID: 8,
  MIN_COMPARTMENT_THICKNESS: 0.8,
  MAX_COMPARTMENT_THICKNESS: 2.4,
  MIN_LABEL_TAB_DEPTH: 8,
  MAX_LABEL_TAB_DEPTH: 20,
  MIN_LABEL_TAB_WIDTH: 10, // %
  MAX_LABEL_TAB_WIDTH: 100, // %
  MAGNET_MIN_DEPTH: 2.0,
  MAGNET_MAX_DEPTH: 4.0,
  MAX_INSERTS: 20,
  MAX_INSERT_DIMENSION: 200,
  MAX_INSERT_DEPTH: 50,
  MAX_PAYLOAD_BYTES: 100_000, // 100KB max for designer shares
  // Mask cells are half-bin resolution: 10 grid units × 2 = 20 cells per
  // side. Mirrors MAX_MASK_DIMENSION in `src/shared/utils/cellMask.ts`.
  MAX_MASK_DIMENSION: 20,
} as const;

/**
 * Top-level keys allowed inside `params` after validation.
 *
 * Defense-in-depth: the validator only deep-validates the structurally-
 * significant fields, but unknown keys (e.g. attacker-controlled junk,
 * `__proto__`, future fields not yet in the schema) must not be persisted
 * verbatim into the public blob. Anything outside this set is silently
 * dropped during sanitization.
 *
 * Mirrors the top-level `BinParams` keys in
 * `src/features/bin-designer/types/index.ts`. Update both together when
 * adding a new generator-level parameter.
 */
const ALLOWED_PARAM_KEYS = new Set<string>([
  // Dimensions & units
  'width',
  'depth',
  'height',
  'gridUnitMm',
  'heightUnitMm',
  'wallThickness',
  // Style
  'style',
  // Sub-objects (deep-validated below)
  'base',
  'compartments',
  'dividers', // legacy alternative to compartments
  'label',
  'walls',
  'inserts',
  'cellMask',
  // Sub-objects not deep-validated (yet) — passed through but key-checked
  'scoop',
  'handles',
  'slotConfig',
  'dividerPieces',
  'cutouts',
  'cutoutConfig',
  'wallPattern',
  'splitConnectors',
  'featureColors',
  'lid',
]);

/**
 * Build a sanitized copy of the params object containing only allowlisted
 * top-level keys. Drops unknown / future / attacker-controlled keys before
 * the payload reaches the public blob.
 */
function pickAllowedParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(params)) {
    if (ALLOWED_PARAM_KEYS.has(key)) {
      out[key] = params[key];
    }
  }
  return out;
}

export interface DesignerSharePayload {
  type: 'designer';
  version: 1;
  params: Record<string, unknown>;
}

export type DesignerValidationResult =
  | { valid: true; payload: DesignerSharePayload }
  | { valid: false; error: { code: string; message: string } };

/**
 * Validate the `base` object of a designer payload.
 *
 * Checks that `base` is an object and that it contains a valid `style`, numeric `magnetDiameter` (1–20),
 * numeric `magnetDepth` (0.5–10), numeric `screwDiameter` (1–10), and boolean `stackingLip`.
 *
 * @param base - The value to validate as a designer `base` object (expected keys: `style`, `magnetDiameter`, `magnetDepth`, `screwDiameter`, `stackingLip`).
 * @returns A string describing the first validation error encountered, or `null` if `base` is valid.
 */
function validateBase(base: unknown): string | null {
  if (!isObject(base)) return 'base must be an object';
  if (!VALID_BASE_STYLES.includes(base.style as (typeof VALID_BASE_STYLES)[number])) {
    return `base.style must be one of: ${VALID_BASE_STYLES.join(', ')}`;
  }
  if (!isNumber(base.magnetDiameter) || !inRange(base.magnetDiameter, 1, 20)) {
    return 'base.magnetDiameter must be 1-20';
  }
  if (!isNumber(base.magnetDepth) || !inRange(base.magnetDepth, 0.5, 10)) {
    return 'base.magnetDepth must be 0.5-10';
  }
  if (!isNumber(base.screwDiameter) || !inRange(base.screwDiameter, 1, 10)) {
    return 'base.screwDiameter must be 1-10';
  }
  if (!isBoolean(base.stackingLip)) return 'base.stackingLip must be boolean';
  return null;
}

/**
 * Validates a dividers object (legacy format) ensuring x and y counts and thickness fall within allowed ranges.
 *
 * @param dividers - The value to validate as a dividers object (expected to have `x`, `y`, and `thickness`).
 * @returns A `string` with a human-readable error message for the first failed check, or `null` if `dividers` is valid.
 */
function validateDividers(dividers: unknown): string | null {
  if (!isObject(dividers)) return 'dividers must be an object';
  if (!isNumber(dividers.x) || !inRange(dividers.x, 0, CONSTRAINTS.MAX_DIVIDERS)) {
    return `dividers.x must be 0-${CONSTRAINTS.MAX_DIVIDERS}`;
  }
  if (!isNumber(dividers.y) || !inRange(dividers.y, 0, CONSTRAINTS.MAX_DIVIDERS)) {
    return `dividers.y must be 0-${CONSTRAINTS.MAX_DIVIDERS}`;
  }
  if (
    !isNumber(dividers.thickness) ||
    !inRange(
      dividers.thickness,
      CONSTRAINTS.MIN_DIVIDER_THICKNESS,
      CONSTRAINTS.MAX_DIVIDER_THICKNESS
    )
  ) {
    return `dividers.thickness must be ${CONSTRAINTS.MIN_DIVIDER_THICKNESS}-${CONSTRAINTS.MAX_DIVIDER_THICKNESS}`;
  }
  return null;
}

/**
 * Validates a cellMask object for share payloads.
 *
 * Mirrors the client-side `validateMask` in `src/shared/utils/cellMask.ts`
 * minus the expensive flood-fill checks — server-side we only need to
 * guard dimensions + cell-array size so a crafted share can't allocate
 * unbounded memory when a viewer loads it. The full structural check
 * runs client-side once the generator touches the mask.
 *
 * @param mask - The value to validate as a cellMask (expected `{ cols, rows, cells }`).
 * @returns An error string, or `null` if the mask is structurally sound.
 */
function validateCellMask(mask: unknown): string | null {
  if (!isObject(mask)) return 'cellMask must be an object';
  if (
    !isNumber(mask.cols) ||
    !inRange(mask.cols, 1, CONSTRAINTS.MAX_MASK_DIMENSION) ||
    !Number.isInteger(mask.cols)
  ) {
    return `cellMask.cols must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`;
  }
  if (
    !isNumber(mask.rows) ||
    !inRange(mask.rows, 1, CONSTRAINTS.MAX_MASK_DIMENSION) ||
    !Number.isInteger(mask.rows)
  ) {
    return `cellMask.rows must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`;
  }
  if (!Array.isArray(mask.cells)) return 'cellMask.cells must be an array';
  const cells = mask.cells as unknown[];
  const expected = mask.cols * mask.rows;
  if (cells.length !== expected) {
    return `cellMask.cells length must be cols × rows (${expected})`;
  }
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v !== 0 && v !== 1) return `cellMask.cells[${i}] must be 0 or 1`;
  }
  return null;
}

/**
 * Validates a compartments object (new format) ensuring cols, rows, thickness, and cells array are valid.
 *
 * @param compartments - The value to validate as a compartments object (expected to have `cols`, `rows`, `thickness`, and `cells`).
 * @returns A `string` with a human-readable error message for the first failed check, or `null` if `compartments` is valid.
 */
function validateCompartments(compartments: unknown): string | null {
  if (!isObject(compartments)) return 'compartments must be an object';
  if (
    !isNumber(compartments.cols) ||
    !inRange(compartments.cols, CONSTRAINTS.MIN_COMPARTMENT_GRID, CONSTRAINTS.MAX_COMPARTMENT_GRID)
  ) {
    return `compartments.cols must be ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
  }
  if (
    !isNumber(compartments.rows) ||
    !inRange(compartments.rows, CONSTRAINTS.MIN_COMPARTMENT_GRID, CONSTRAINTS.MAX_COMPARTMENT_GRID)
  ) {
    return `compartments.rows must be ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
  }
  if (
    !isNumber(compartments.thickness) ||
    !inRange(
      compartments.thickness,
      CONSTRAINTS.MIN_COMPARTMENT_THICKNESS,
      CONSTRAINTS.MAX_COMPARTMENT_THICKNESS
    )
  ) {
    return `compartments.thickness must be ${CONSTRAINTS.MIN_COMPARTMENT_THICKNESS}-${CONSTRAINTS.MAX_COMPARTMENT_THICKNESS}`;
  }
  if (!Array.isArray(compartments.cells)) return 'compartments.cells must be an array';
  const expectedLength = compartments.cols * compartments.rows;
  if (compartments.cells.length !== expectedLength) {
    return `compartments.cells length must be cols × rows (${expectedLength})`;
  }
  return null;
}

/**
 * Validates the walls configuration from the designer payload.
 *
 * @param walls - The value to validate as a walls object
 * @returns `null` if valid; otherwise an error message
 */
function validateWalls(walls: unknown): string | null {
  if (!isObject(walls)) return 'walls must be an object';
  // enabled is optional for legacy payloads (number-based wall format)
  if (walls.enabled !== undefined && !isBoolean(walls.enabled)) {
    return 'walls.enabled must be boolean';
  }
  if (
    walls.shape !== undefined &&
    !VALID_WALL_CUTOUT_SHAPES.includes(walls.shape as (typeof VALID_WALL_CUTOUT_SHAPES)[number])
  ) {
    return `walls.shape must be one of: ${VALID_WALL_CUTOUT_SHAPES.join(', ')}`;
  }
  // Validate per-side width/depth are in range (0-100%)
  for (const side of ['front', 'back', 'left', 'right', 'interior']) {
    const sideConfig = walls[side];
    if (sideConfig !== undefined && isObject(sideConfig)) {
      if (isNumber(sideConfig.width) && !inRange(sideConfig.width, 0, 100)) {
        return `walls.${side}.width must be 0-100`;
      }
      if (isNumber(sideConfig.depth) && !inRange(sideConfig.depth, 0, 100)) {
        return `walls.${side}.depth must be 0-100`;
      }
    }
  }
  return null;
}

function validateLabel(label: unknown): string | null {
  if (!isObject(label)) return 'label must be an object';
  if (!isBoolean(label.enabled)) return 'label.enabled must be boolean';

  // Only validate detail fields when the feature is enabled (matches client-side logic)
  if (label.enabled) {
    if (
      !isNumber(label.depth) ||
      !inRange(label.depth, CONSTRAINTS.MIN_LABEL_TAB_DEPTH, CONSTRAINTS.MAX_LABEL_TAB_DEPTH)
    ) {
      return `label.depth must be ${CONSTRAINTS.MIN_LABEL_TAB_DEPTH}-${CONSTRAINTS.MAX_LABEL_TAB_DEPTH}`;
    }
    if (
      !isNumber(label.width) ||
      !inRange(label.width, CONSTRAINTS.MIN_LABEL_TAB_WIDTH, CONSTRAINTS.MAX_LABEL_TAB_WIDTH)
    ) {
      return `label.width must be ${CONSTRAINTS.MIN_LABEL_TAB_WIDTH}-${CONSTRAINTS.MAX_LABEL_TAB_WIDTH}`;
    }
    if (
      label.support !== undefined &&
      !VALID_LABEL_TAB_SUPPORTS.includes(label.support as (typeof VALID_LABEL_TAB_SUPPORTS)[number])
    ) {
      return `label.support must be one of: ${VALID_LABEL_TAB_SUPPORTS.join(', ')}`;
    }
    if (
      label.alignment !== undefined &&
      !['left', 'center', 'right'].includes(label.alignment as string)
    ) {
      return 'label.alignment must be "left", "center", or "right"';
    }
  }
  return null;
}

/**
 * Validates a single insert object from the payload and returns a descriptive error message when invalid.
 *
 * @param insert - The insert value to validate (expected object with id, shape, x, y, width, depth, cutDepth, rotation, cornerRadius, and label)
 * @param index - The index of the insert in the inserts array (used to build precise error messages)
 * @returns A validation error message describing the first detected problem, or `null` if the insert is valid
 */
// 3- or 6-digit CSS hex, plus the legacy slot IDs we migrate client-side.
// Anything else is rejected before it lands in the blob.
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const LEGACY_SLOT_IDS = new Set(['slot1', 'slot2', 'slot3', 'slot4']);

function isValidColor(v: unknown): boolean {
  if (!isString(v)) return false;
  return HEX_COLOR_REGEX.test(v) || LEGACY_SLOT_IDS.has(v);
}

const LIP_CORNERS = ['frontLeft', 'frontRight', 'backRight', 'backLeft'] as const;
const ALLOWED_FEATURE_COLOR_KEYS = new Set([
  'body',
  'lip',
  'labelTab',
  'base',
  'scoop',
  'dividers',
]);
const ALLOWED_LIP_CORNER_KEYS = new Set<string>(LIP_CORNERS);

/**
 * Accepts the legacy `lip: string` shape (migrated client-side into four
 * matching corners) or the new 4-corner object. Rejects unknown keys at
 * both levels so a crafted share can't smuggle attacker-controlled junk
 * past the top-level size cap.
 */
function validateFeatureColors(value: unknown): string | null {
  if (!isObject(value)) return 'featureColors must be an object';

  for (const key of Object.keys(value)) {
    if (!ALLOWED_FEATURE_COLOR_KEYS.has(key)) {
      return `featureColors has unknown key: ${key}`;
    }
  }

  for (const key of ['body', 'labelTab', 'base', 'scoop', 'dividers'] as const) {
    if (value[key] !== undefined && !isValidColor(value[key])) {
      return `featureColors.${key} must be a hex color`;
    }
  }

  const lip = value.lip;
  if (lip !== undefined) {
    if (isString(lip)) {
      if (!isValidColor(lip)) return 'featureColors.lip must be a hex color';
    } else if (isObject(lip)) {
      for (const key of Object.keys(lip)) {
        if (!ALLOWED_LIP_CORNER_KEYS.has(key)) {
          return `featureColors.lip has unknown corner: ${key}`;
        }
      }
      for (const corner of LIP_CORNERS) {
        if (lip[corner] !== undefined && !isValidColor(lip[corner])) {
          return `featureColors.lip.${corner} must be a hex color`;
        }
      }
    } else {
      return 'featureColors.lip must be a hex color or 4-corner object';
    }
  }

  return null;
}

function validateInsert(insert: unknown, index: number): string | null {
  if (!isObject(insert)) return `inserts[${index}] must be an object`;
  if (!isString(insert.id)) return `inserts[${index}].id must be a string`;
  if (!VALID_INSERT_SHAPES.includes(insert.shape as (typeof VALID_INSERT_SHAPES)[number])) {
    return `inserts[${index}].shape must be one of: ${VALID_INSERT_SHAPES.join(', ')}`;
  }
  if (!isNumber(insert.x) || !inRange(insert.x, 0, CONSTRAINTS.MAX_INSERT_DIMENSION)) {
    return `inserts[${index}].x must be 0-${CONSTRAINTS.MAX_INSERT_DIMENSION}`;
  }
  if (!isNumber(insert.y) || !inRange(insert.y, 0, CONSTRAINTS.MAX_INSERT_DIMENSION)) {
    return `inserts[${index}].y must be 0-${CONSTRAINTS.MAX_INSERT_DIMENSION}`;
  }
  if (!isNumber(insert.width) || !inRange(insert.width, 0.1, CONSTRAINTS.MAX_INSERT_DIMENSION)) {
    return `inserts[${index}].width must be 0.1-${CONSTRAINTS.MAX_INSERT_DIMENSION}`;
  }
  if (!isNumber(insert.depth) || !inRange(insert.depth, 0.1, CONSTRAINTS.MAX_INSERT_DIMENSION)) {
    return `inserts[${index}].depth must be 0.1-${CONSTRAINTS.MAX_INSERT_DIMENSION}`;
  }
  if (!isNumber(insert.cutDepth) || !inRange(insert.cutDepth, 0.1, CONSTRAINTS.MAX_INSERT_DEPTH)) {
    return `inserts[${index}].cutDepth must be 0.1-${CONSTRAINTS.MAX_INSERT_DEPTH}`;
  }
  if (!VALID_ROTATIONS.includes(insert.rotation as (typeof VALID_ROTATIONS)[number])) {
    return `inserts[${index}].rotation must be 0, 90, 180, or 270`;
  }
  if (!isNumber(insert.cornerRadius) || !inRange(insert.cornerRadius, 0, 50)) {
    return `inserts[${index}].cornerRadius must be 0-50`;
  }
  if (!isString(insert.label) || insert.label.length > 100) {
    return `inserts[${index}].label must be a string (max 100 chars)`;
  }
  return null;
}

/**
 * Validate and normalize a designer share payload according to server-side constraints.
 *
 * @param body - The parsed request payload to validate; expected shape: `{ type: 'designer', version: 1, params: { ... } }`.
 * @param sizeBytes - The size of the raw payload in bytes (used to enforce the maximum payload size).
 * @returns A result object: on success `{ valid: true, payload }` where `payload` contains the validated `type`, `version`, and `params`; on failure `{ valid: false, error }` where `error` includes a `code` and human-readable `message` describing the validation failure.
 */
export function validateDesignerShare(body: unknown, sizeBytes: number): DesignerValidationResult {
  if (sizeBytes > CONSTRAINTS.MAX_PAYLOAD_BYTES) {
    return validationError('SIZE_EXCEEDED', 'Designer share payload too large (max 100KB)');
  }

  if (!isObject(body)) {
    return validationError('INVALID_PAYLOAD', 'Payload must be an object');
  }

  if (body.type !== 'designer') {
    return validationError('INVALID_TYPE', 'type must be "designer"');
  }

  if (body.version !== 1) {
    return validationError('INVALID_VERSION', 'version must be 1');
  }

  const params = body.params;
  if (!isObject(params)) {
    return validationError('MISSING_PARAMS', 'params must be an object');
  }

  // Dimensions
  if (
    !isNumber(params.width) ||
    !inRange(params.width, CONSTRAINTS.MIN_DIMENSION, CONSTRAINTS.MAX_DIMENSION)
  ) {
    return validationError(
      'INVALID_PARAMS',
      `width must be ${CONSTRAINTS.MIN_DIMENSION}-${CONSTRAINTS.MAX_DIMENSION}`
    );
  }
  if (
    !isNumber(params.depth) ||
    !inRange(params.depth, CONSTRAINTS.MIN_DIMENSION, CONSTRAINTS.MAX_DIMENSION)
  ) {
    return validationError(
      'INVALID_PARAMS',
      `depth must be ${CONSTRAINTS.MIN_DIMENSION}-${CONSTRAINTS.MAX_DIMENSION}`
    );
  }
  if (
    !isNumber(params.height) ||
    !inRange(params.height, CONSTRAINTS.MIN_HEIGHT, CONSTRAINTS.MAX_HEIGHT)
  ) {
    return validationError(
      'INVALID_PARAMS',
      `height must be ${CONSTRAINTS.MIN_HEIGHT}-${CONSTRAINTS.MAX_HEIGHT}`
    );
  }

  // Style
  if (!VALID_BIN_STYLES.includes(params.style as (typeof VALID_BIN_STYLES)[number])) {
    return validationError(
      'INVALID_PARAMS',
      `style must be one of: ${VALID_BIN_STYLES.join(', ')}`
    );
  }

  // Sub-objects
  const baseErr = validateBase(params.base);
  if (baseErr) return validationError('INVALID_PARAMS', baseErr);

  // Accept either legacy dividers or new compartments format
  if (params.compartments !== undefined) {
    const compErr = validateCompartments(params.compartments);
    if (compErr) return validationError('INVALID_PARAMS', compErr);
  } else if (params.dividers !== undefined) {
    const divErr = validateDividers(params.dividers);
    if (divErr) return validationError('INVALID_PARAMS', divErr);
  }
  // If neither is present, that's fine (no compartments = single cell)

  const labelErr = validateLabel(params.label);
  if (labelErr) return validationError('INVALID_PARAMS', labelErr);

  if (params.walls !== undefined) {
    const wallsErr = validateWalls(params.walls);
    if (wallsErr) return validationError('INVALID_PARAMS', wallsErr);
  }

  // Custom-shape footprint: structurally-valid masks are enforced here so
  // a crafted share can't ship an oversized `cells` array that the viewer
  // would have to allocate on load.
  if (params.cellMask !== undefined) {
    const maskErr = validateCellMask(params.cellMask);
    if (maskErr) return validationError('INVALID_PARAMS', maskErr);
  }

  if (params.featureColors !== undefined) {
    const fcErr = validateFeatureColors(params.featureColors);
    if (fcErr) return validationError('INVALID_PARAMS', fcErr);
  }

  // Inserts
  if (!Array.isArray(params.inserts)) {
    return validationError('INVALID_PARAMS', 'inserts must be an array');
  }
  if (params.inserts.length > CONSTRAINTS.MAX_INSERTS) {
    return validationError('INVALID_PARAMS', `max ${CONSTRAINTS.MAX_INSERTS} inserts`);
  }
  for (let i = 0; i < params.inserts.length; i++) {
    const insertErr = validateInsert(params.inserts[i], i);
    if (insertErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: insertErr } };
  }

  return {
    valid: true,
    payload: {
      type: 'designer',
      version: 1,
      params: pickAllowedParams(params),
    },
  };
}
