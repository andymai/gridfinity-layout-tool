/**
 * Server-side validation for designer share payloads.
 *
 * Validates BinParams structure and constraints before storing in Blob.
 * These constraints mirror DESIGNER_CONSTRAINTS from the client.
 */

// Type-safe enum validation
const VALID_BIN_STYLES = ['standard', 'lite', 'solid', 'vase', 'rugged'] as const;
const VALID_BASE_STYLES = ['standard', 'magnet', 'screw', 'weighted'] as const;
const VALID_INSERT_SHAPES = ['rectangle', 'circle', 'hexagon', 'rounded-rect', 'slot'] as const;
const VALID_ROTATIONS = [0, 90, 180, 270] as const;

// Constraints (server-side copies of client DESIGNER_CONSTRAINTS)
const CONSTRAINTS = {
  MIN_DIMENSION: 0.5,
  MAX_DIMENSION: 6,
  MIN_HEIGHT: 2,
  MAX_HEIGHT: 12,
  MAX_DIVIDERS: 10,
  MIN_DIVIDER_THICKNESS: 0.8,
  MAX_DIVIDER_THICKNESS: 2.0,
  MAX_WALL_CUTOUT: 100,
  MAX_LABEL_LENGTH: 20,
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

function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
}

function inRange(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function validateBase(base: unknown): string | null {
  if (!isObject(base)) return 'base must be an object';
  if (!VALID_BASE_STYLES.includes(base.style as typeof VALID_BASE_STYLES[number])) {
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

function validateDividers(dividers: unknown): string | null {
  if (!isObject(dividers)) return 'dividers must be an object';
  if (!isNumber(dividers.x) || !inRange(dividers.x, 0, CONSTRAINTS.MAX_DIVIDERS)) {
    return `dividers.x must be 0-${CONSTRAINTS.MAX_DIVIDERS}`;
  }
  if (!isNumber(dividers.y) || !inRange(dividers.y, 0, CONSTRAINTS.MAX_DIVIDERS)) {
    return `dividers.y must be 0-${CONSTRAINTS.MAX_DIVIDERS}`;
  }
  if (!isNumber(dividers.thickness) ||
    !inRange(dividers.thickness, CONSTRAINTS.MIN_DIVIDER_THICKNESS, CONSTRAINTS.MAX_DIVIDER_THICKNESS)) {
    return `dividers.thickness must be ${CONSTRAINTS.MIN_DIVIDER_THICKNESS}-${CONSTRAINTS.MAX_DIVIDER_THICKNESS}`;
  }
  return null;
}

function validateLabel(label: unknown): string | null {
  if (!isObject(label)) return 'label must be an object';
  if (!isBoolean(label.enabled)) return 'label.enabled must be boolean';
  if (!isString(label.text)) return 'label.text must be a string';
  if (label.text.length > CONSTRAINTS.MAX_LABEL_LENGTH) {
    return `label.text must be ${CONSTRAINTS.MAX_LABEL_LENGTH} chars or less`;
  }
  if (label.fontSize !== 'auto' && (!isNumber(label.fontSize) || !inRange(label.fontSize, 4, 72))) {
    return 'label.fontSize must be "auto" or 4-72';
  }
  return null;
}

function validateWalls(walls: unknown): string | null {
  if (!isObject(walls)) return 'walls must be an object';
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    if (!isNumber(walls[side]) || !inRange(walls[side] as number, 0, CONSTRAINTS.MAX_WALL_CUTOUT)) {
      return `walls.${side} must be 0-${CONSTRAINTS.MAX_WALL_CUTOUT}`;
    }
  }
  return null;
}

function validateInsert(insert: unknown, index: number): string | null {
  if (!isObject(insert)) return `inserts[${index}] must be an object`;
  if (!isString(insert.id)) return `inserts[${index}].id must be a string`;
  if (!VALID_INSERT_SHAPES.includes(insert.shape as typeof VALID_INSERT_SHAPES[number])) {
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
  if (!VALID_ROTATIONS.includes(insert.rotation as typeof VALID_ROTATIONS[number])) {
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

/** Validate a designer share payload */
export function validateDesignerShare(
  body: unknown,
  sizeBytes: number
): DesignerValidationResult {
  if (sizeBytes > CONSTRAINTS.MAX_PAYLOAD_BYTES) {
    return { valid: false, error: { code: 'SIZE_EXCEEDED', message: 'Designer share payload too large (max 100KB)' } };
  }

  if (!isObject(body)) {
    return { valid: false, error: { code: 'INVALID_PAYLOAD', message: 'Payload must be an object' } };
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
  if (!isNumber(params.width) || !inRange(params.width, CONSTRAINTS.MIN_DIMENSION, CONSTRAINTS.MAX_DIMENSION)) {
    return { valid: false, error: { code: 'INVALID_PARAMS', message: `width must be ${CONSTRAINTS.MIN_DIMENSION}-${CONSTRAINTS.MAX_DIMENSION}` } };
  }
  if (!isNumber(params.depth) || !inRange(params.depth, CONSTRAINTS.MIN_DIMENSION, CONSTRAINTS.MAX_DIMENSION)) {
    return { valid: false, error: { code: 'INVALID_PARAMS', message: `depth must be ${CONSTRAINTS.MIN_DIMENSION}-${CONSTRAINTS.MAX_DIMENSION}` } };
  }
  if (!isNumber(params.height) || !inRange(params.height, CONSTRAINTS.MIN_HEIGHT, CONSTRAINTS.MAX_HEIGHT)) {
    return { valid: false, error: { code: 'INVALID_PARAMS', message: `height must be ${CONSTRAINTS.MIN_HEIGHT}-${CONSTRAINTS.MAX_HEIGHT}` } };
  }

  // Style
  if (!VALID_BIN_STYLES.includes(params.style as typeof VALID_BIN_STYLES[number])) {
    return { valid: false, error: { code: 'INVALID_PARAMS', message: `style must be one of: ${VALID_BIN_STYLES.join(', ')}` } };
  }

  // Scoop
  if (!isBoolean(params.scoop)) {
    return { valid: false, error: { code: 'INVALID_PARAMS', message: 'scoop must be boolean' } };
  }

  // Sub-objects
  const baseErr = validateBase(params.base);
  if (baseErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: baseErr } };

  const divErr = validateDividers(params.dividers);
  if (divErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: divErr } };

  const labelErr = validateLabel(params.label);
  if (labelErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: labelErr } };

  const wallsErr = validateWalls(params.walls);
  if (wallsErr) return { valid: false, error: { code: 'INVALID_PARAMS', message: wallsErr } };

  // Inserts
  if (!Array.isArray(params.inserts)) {
    return { valid: false, error: { code: 'INVALID_PARAMS', message: 'inserts must be an array' } };
  }
  if (params.inserts.length > CONSTRAINTS.MAX_INSERTS) {
    return { valid: false, error: { code: 'INVALID_PARAMS', message: `max ${CONSTRAINTS.MAX_INSERTS} inserts` } };
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
      params: params as Record<string, unknown>,
    },
  };
}
