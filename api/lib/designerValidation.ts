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

// Type-safe enum validation. Mirror the client unions in
// `src/features/bin-designer/types/index.ts` — when a value is added there
// it must be added here too, otherwise cloud sync PUTs from up-to-date
// clients will be rejected with a 400.
const VALID_BIN_STYLES = ['standard', 'slotted', 'solid'] as const;
const VALID_BASE_STYLES = [
  'standard',
  'magnet',
  'screw',
  'magnet_and_screw',
  'weighted',
  'flat',
] as const;
const VALID_LABEL_TAB_SUPPORTS = ['bracket', 'solid', 'fillet'] as const;
const VALID_INSERT_SHAPES = ['rectangle', 'circle', 'hexagon', 'rounded-rect', 'slot'] as const;
const VALID_WALL_CUTOUT_SHAPES = ['u-shape', 'scoop', 'funnel'] as const;
const VALID_ROTATIONS = [0, 90, 180, 270] as const;
const VALID_TEXT_FONTS = ['atkinson', 'jetbrains-mono', 'allerta-stencil'] as const;
const VALID_TEXT_MODES = ['engrave', 'emboss', 'through-cut'] as const;

// Constraints (server-side copies of client DESIGNER_CONSTRAINTS in
// src/features/bin-designer/constants/gridfinity.ts — keep in sync).
const CONSTRAINTS = {
  MIN_DIMENSION: 0.5,
  MAX_DIMENSION: 16,
  MIN_HEIGHT: 2,
  MAX_HEIGHT: 20,
  MAX_DIVIDERS: 10,
  MIN_DIVIDER_THICKNESS: 0.8,
  MAX_DIVIDER_THICKNESS: 2.4,
  MIN_COMPARTMENT_GRID: 1,
  MAX_COMPARTMENT_GRID: 12,
  MIN_COMPARTMENT_THICKNESS: 0.4,
  MAX_COMPARTMENT_THICKNESS: 2.4,
  MIN_LABEL_TAB_DEPTH: 8,
  // Raised from 20 → 50 in #1898 to enable tuck-under ledges for wire bins.
  MAX_LABEL_TAB_DEPTH: 50,
  MIN_LABEL_TAB_WIDTH: 10, // %
  MAX_LABEL_TAB_WIDTH: 100, // %
  // Label tab height is the Z of the shelf top above the cavity floor (mm).
  // Static bounds for API payloads — the client's UI uses a dynamic max
  // tied to the current bin's interior height. Floor (9) = MIN_LABEL_TAB_DEPTH + 1;
  // ceiling (140) = MAX_HEIGHT * 7mm (heightUnitMm).
  MIN_LABEL_TAB_HEIGHT: 9,
  MAX_LABEL_TAB_HEIGHT: 140,
  // Inset moves the tab inward from its anchor wall (#1898).
  MIN_LABEL_TAB_INSET: 0,
  MAX_LABEL_TAB_INSET: 100,
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
  'textDefaults',
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
  // Each cell must be a non-negative integer compartment ID. The
  // dividerOverrides validator below derives its knownIds set from cells
  // and runs an adjacency check that assumes integer IDs — a crafted
  // payload could otherwise smuggle in floats/strings and break both
  // checks silently.
  for (let i = 0; i < compartments.cells.length; i++) {
    const c = compartments.cells[i] as unknown;
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0) {
      return `compartments.cells[${i}] must be a non-negative integer`;
    }
  }
  // Optional per-compartment engraved text. Mirrors the client-side
  // `TEXT_MAX_LENGTH = 50` cap so a direct HTTP POST can't smuggle in
  // unbounded strings that bypass `setCompartmentText`. Array length
  // can't exceed the total cell count (one slot per possible compartment ID).
  if (compartments.compartmentTexts !== undefined) {
    if (!Array.isArray(compartments.compartmentTexts)) {
      return 'compartments.compartmentTexts must be an array';
    }
    if (compartments.compartmentTexts.length > expectedLength) {
      return `compartments.compartmentTexts length must not exceed cols × rows (${expectedLength})`;
    }
    for (let i = 0; i < compartments.compartmentTexts.length; i++) {
      const t = compartments.compartmentTexts[i];
      if (typeof t !== 'string') {
        return `compartments.compartmentTexts[${i}] must be a string`;
      }
      if (t.length > 50) {
        return `compartments.compartmentTexts[${i}] must not exceed 50 characters`;
      }
    }
  }
  // Optional per-divider tilt overrides. Mirrors the client-side
  // `DIVIDER_OFFSET_MAX_MM = 200` cap and the canonical pair ordering rule
  // (compartmentA < compartmentB) so a direct HTTP POST can't smuggle in
  // unordered or absurd overrides that bypass the store action. Also
  // verifies (1) both compartment IDs actually exist in cells and (2) the
  // pair is adjacent — same checks the client validator does.
  if (compartments.dividerOverrides !== undefined) {
    if (!Array.isArray(compartments.dividerOverrides)) {
      return 'compartments.dividerOverrides must be an array';
    }
    if (compartments.dividerOverrides.length > expectedLength * 2) {
      return `compartments.dividerOverrides length is unreasonably large`;
    }
    const knownIds = new Set<number>();
    for (const cell of compartments.cells as unknown[]) {
      if (typeof cell === 'number' && Number.isInteger(cell)) knownIds.add(cell);
    }
    const seenPairs = new Set<string>();
    for (let i = 0; i < compartments.dividerOverrides.length; i++) {
      const o = compartments.dividerOverrides[i] as Record<string, unknown>;
      if (!isObject(o)) {
        return `compartments.dividerOverrides[${i}] must be an object`;
      }
      if (!isNumber(o.compartmentA) || !Number.isInteger(o.compartmentA) || o.compartmentA < 0) {
        return `compartments.dividerOverrides[${i}].compartmentA must be a non-negative integer`;
      }
      if (!isNumber(o.compartmentB) || !Number.isInteger(o.compartmentB) || o.compartmentB < 0) {
        return `compartments.dividerOverrides[${i}].compartmentB must be a non-negative integer`;
      }
      if (o.compartmentA >= o.compartmentB) {
        return `compartments.dividerOverrides[${i}] must have compartmentA < compartmentB`;
      }
      if (!knownIds.has(o.compartmentA) || !knownIds.has(o.compartmentB)) {
        return `compartments.dividerOverrides[${i}] references unknown compartment ID`;
      }
      if (!compartmentsAreAdjacent(compartments, o.compartmentA, o.compartmentB)) {
        return `compartments.dividerOverrides[${i}] compartments are not adjacent`;
      }
      if (!isNumber(o.offsetStart) || !inRange(o.offsetStart, -200, 200)) {
        return `compartments.dividerOverrides[${i}].offsetStart must be -200..200`;
      }
      if (!isNumber(o.offsetEnd) || !inRange(o.offsetEnd, -200, 200)) {
        return `compartments.dividerOverrides[${i}].offsetEnd must be -200..200`;
      }
      const key = `${o.compartmentA}|${o.compartmentB}`;
      if (seenPairs.has(key)) {
        return `compartments.dividerOverrides has duplicate pair ${key}`;
      }
      seenPairs.add(key);
    }
  }
  return null;
}

/**
 * Server-side adjacency check mirroring the client helper. Two compartments
 * are adjacent if any pair of orthogonally-neighboring cells holds them.
 */
function compartmentsAreAdjacent(
  compartments: Record<string, unknown>,
  a: number,
  b: number
): boolean {
  const cols = compartments.cols as number;
  const rows = compartments.rows as number;
  const cells = compartments.cells as readonly number[];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cells[row * cols + col];
      if (id !== a && id !== b) continue;
      if (col + 1 < cols) {
        const r = cells[row * cols + (col + 1)];
        if ((id === a && r === b) || (id === b && r === a)) return true;
      }
      if (row + 1 < rows) {
        const d = cells[(row + 1) * cols + col];
        if ((id === a && d === b) || (id === b && d === a)) return true;
      }
    }
  }
  return false;
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

const ALLOWED_TEXT_DEFAULTS_KEYS = new Set([
  'font',
  'mode',
  'depth',
  'margin',
  'minFontSize',
  'maxFontSize',
]);

/**
 * Caps mirror the geometry-pipeline safe ranges that ship in the next PR;
 * keeping them server-side now means a crafted share can't smuggle in a
 * `depth: -1` or `maxFontSize: 1e9` that crashes the BREP worker.
 */
function validateTextDefaults(value: unknown): string | null {
  if (!isObject(value)) return 'textDefaults must be an object';

  for (const key of Object.keys(value)) {
    if (!ALLOWED_TEXT_DEFAULTS_KEYS.has(key)) {
      return `textDefaults has unknown key: ${key}`;
    }
  }

  if (
    value.font !== undefined &&
    !VALID_TEXT_FONTS.includes(value.font as (typeof VALID_TEXT_FONTS)[number])
  ) {
    return `textDefaults.font must be one of: ${VALID_TEXT_FONTS.join(', ')}`;
  }
  if (
    value.mode !== undefined &&
    !VALID_TEXT_MODES.includes(value.mode as (typeof VALID_TEXT_MODES)[number])
  ) {
    return `textDefaults.mode must be one of: ${VALID_TEXT_MODES.join(', ')}`;
  }
  if (value.depth !== undefined && (!isNumber(value.depth) || !inRange(value.depth, 0, 10))) {
    return 'textDefaults.depth must be 0-10';
  }
  if (value.margin !== undefined && (!isNumber(value.margin) || !inRange(value.margin, 0, 50))) {
    return 'textDefaults.margin must be 0-50';
  }
  if (
    value.minFontSize !== undefined &&
    (!isNumber(value.minFontSize) || !inRange(value.minFontSize, 0.5, 100))
  ) {
    return 'textDefaults.minFontSize must be 0.5-100';
  }
  if (
    value.maxFontSize !== undefined &&
    (!isNumber(value.maxFontSize) || !inRange(value.maxFontSize, 0.5, 200))
  ) {
    return 'textDefaults.maxFontSize must be 0.5-200';
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
    // Optional field; absent = anchor shelf at the wall top (legacy behavior).
    if (label.height !== undefined) {
      if (
        !isNumber(label.height) ||
        !inRange(label.height, CONSTRAINTS.MIN_LABEL_TAB_HEIGHT, CONSTRAINTS.MAX_LABEL_TAB_HEIGHT)
      ) {
        return `label.height must be ${CONSTRAINTS.MIN_LABEL_TAB_HEIGHT}-${CONSTRAINTS.MAX_LABEL_TAB_HEIGHT}`;
      }
      // Cross-field: gusset needs at least 1mm clearance above the floor,
      // so the shelf top must sit above the tab depth. Without this guard,
      // the payload passes range checks but the builder silently drops the
      // tab — the consumer's design loses geometry with no error signal.
      if (isNumber(label.depth) && label.height <= label.depth) {
        return 'label.height must be greater than label.depth';
      }
    }
    // Optional field (#1898); absent = back-edge anchor (legacy).
    if (label.edges !== undefined && !['back', 'front', 'both'].includes(label.edges as string)) {
      return 'label.edges must be "back", "front", or "both"';
    }
    // Optional field (#1898); absent = 0 (tab abuts anchor wall).
    if (label.inset !== undefined) {
      if (
        !isNumber(label.inset) ||
        !inRange(label.inset, CONSTRAINTS.MIN_LABEL_TAB_INSET, CONSTRAINTS.MAX_LABEL_TAB_INSET)
      ) {
        return `label.inset must be ${CONSTRAINTS.MIN_LABEL_TAB_INSET}-${CONSTRAINTS.MAX_LABEL_TAB_INSET}`;
      }
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
  'enabled',
  'body',
  'lip',
  'labelTab',
  'base',
  'scoop',
  'dividers',
  'text',
  'lid',
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

  if (value.enabled !== undefined && !isBoolean(value.enabled)) {
    return 'featureColors.enabled must be boolean';
  }

  for (const key of ['body', 'labelTab', 'base', 'scoop', 'dividers', 'text', 'lid'] as const) {
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

  if (params.textDefaults !== undefined) {
    const tdErr = validateTextDefaults(params.textDefaults);
    if (tdErr) return validationError('INVALID_PARAMS', tdErr);
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
