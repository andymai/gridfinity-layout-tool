/**
 * Server-side validation for designer share payloads.
 *
 * Validates BinParams structure and constraints before storing in Blob.
 * These constraints mirror DESIGNER_CONSTRAINTS from the client.
 */

// Type-safe enum validation
const VALID_BIN_STYLES = ['standard', 'slotted'] as const;
const VALID_BASE_STYLES = ['standard', 'magnet', 'screw', 'magnet_and_screw', 'weighted'] as const;
const VALID_LABEL_TAB_SUPPORTS = ['bracket', 'solid'] as const;
const VALID_INSERT_SHAPES = ['rectangle', 'circle', 'hexagon', 'rounded-rect', 'slot'] as const;
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
} as const;

export interface DesignerSharePayload {
  type: 'designer';
  version: 1;
  params: Record<string, unknown>;
}

export type DesignerValidationResult =
  | { valid: true; payload: DesignerSharePayload }
  | { valid: false; error: { code: string; message: string } };

/**
 * Determines whether a value is a finite, non-NaN number.
 *
 * @param val - The value to test
 * @returns `true` if `val` is a number, not `NaN`, and finite; `false` otherwise.
 */
function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
}

/**
 * Determine whether a numeric value falls within an inclusive range.
 *
 * @param val - The value to test
 * @param min - The lower bound (inclusive)
 * @param max - The upper bound (inclusive)
 * @returns `true` if `val` is greater than or equal to `min` and less than or equal to `max`, `false` otherwise.
 */
function inRange(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}

/**
 * Determines whether a value is a string.
 *
 * @returns `true` if `val` is a string, `false` otherwise.
 */
function isString(val: unknown): val is string {
  return typeof val === 'string';
}

/**
 * Determines whether a value is a boolean.
 *
 * @param val - The value to test
 * @returns `true` if `val` is a boolean, `false` otherwise.
 */
function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

/**
 * Determines whether a value is a plain object (an object that is not null and not an array).
 *
 * @param val - The value to test
 * @returns `true` if `val` is a plain object (not null or an array), `false` otherwise.
 */
function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

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
 * Validates a label tab object from the designer payload.
 *
 * @param label - The value to validate as a label tab object
 * @returns `null` if valid; otherwise an error message
 */
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
    return {
      valid: false,
      error: { code: 'SIZE_EXCEEDED', message: 'Designer share payload too large (max 100KB)' },
    };
  }

  if (!isObject(body)) {
    return {
      valid: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Payload must be an object' },
    };
  }

  if (body.type !== 'designer') {
    return { valid: false, error: { code: 'INVALID_TYPE', message: 'type must be "designer"' } };
  }

  if (body.version !== 1) {
    return { valid: false, error: { code: 'INVALID_VERSION', message: 'version must be 1' } };
  }

  const params = body.params;
  if (!isObject(params)) {
    return { valid: false, error: { code: 'MISSING_PARAMS', message: 'params must be an object' } };
  }

  // Dimensions
  if (
    !isNumber(params.width) ||
    !inRange(params.width, CONSTRAINTS.MIN_DIMENSION, CONSTRAINTS.MAX_DIMENSION)
  ) {
    return {
      valid: false,
      error: {
        code: 'INVALID_PARAMS',
        message: `width must be ${CONSTRAINTS.MIN_DIMENSION}-${CONSTRAINTS.MAX_DIMENSION}`,
      },
    };
  }
  if (
    !isNumber(params.depth) ||
    !inRange(params.depth, CONSTRAINTS.MIN_DIMENSION, CONSTRAINTS.MAX_DIMENSION)
  ) {
    return {
      valid: false,
      error: {
        code: 'INVALID_PARAMS',
        message: `depth must be ${CONSTRAINTS.MIN_DIMENSION}-${CONSTRAINTS.MAX_DIMENSION}`,
      },
    };
  }
  if (
    !isNumber(params.height) ||
    !inRange(params.height, CONSTRAINTS.MIN_HEIGHT, CONSTRAINTS.MAX_HEIGHT)
  ) {
    return {
      valid: false,
      error: {
        code: 'INVALID_PARAMS',
        message: `height must be ${CONSTRAINTS.MIN_HEIGHT}-${CONSTRAINTS.MAX_HEIGHT}`,
      },
    };
  }

  // Style
  if (!VALID_BIN_STYLES.includes(params.style as (typeof VALID_BIN_STYLES)[number])) {
    return {
      valid: false,
      error: {
        code: 'INVALID_PARAMS',
        message: `style must be one of: ${VALID_BIN_STYLES.join(', ')}`,
      },
    };
  }

  // Sub-objects
  const baseErr = validateBase(params.base);
  if (baseErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: baseErr } };

  // Accept either legacy dividers or new compartments format
  if (params.compartments !== undefined) {
    const compErr = validateCompartments(params.compartments);
    if (compErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: compErr } };
  } else if (params.dividers !== undefined) {
    const divErr = validateDividers(params.dividers);
    if (divErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: divErr } };
  }
  // If neither is present, that's fine (no compartments = single cell)

  const labelErr = validateLabel(params.label);
  if (labelErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: labelErr } };

  // Inserts
  if (!Array.isArray(params.inserts)) {
    return { valid: false, error: { code: 'INVALID_PARAMS', message: 'inserts must be an array' } };
  }
  if (params.inserts.length > CONSTRAINTS.MAX_INSERTS) {
    return {
      valid: false,
      error: { code: 'INVALID_PARAMS', message: `max ${CONSTRAINTS.MAX_INSERTS} inserts` },
    };
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
      params: params,
    },
  };
}
