/**
 * Server-side validation for baseplate sync payloads.
 *
 * Baseplate params are far simpler than bin-designer params: a flat object of
 * booleans and numbers. This validator enforces the structurally-significant
 * required fields plus sane numeric ranges (mirroring the client clamps in
 * `src/core/cqrs/v2/domain/layout/setBaseplateParams.ts`), drops unknown /
 * attacker-controlled top-level keys, and caps total size — matching the
 * safety posture of `designerValidation.ts` without the deep schema.
 */

import {
  isNumber,
  inRange,
  isBoolean,
  isObject,
  isString,
  validationError,
} from './validationUtils.js';

/** 100 KB — generous for a flat params object; a guard against smuggled bloat. */
const MAX_PAYLOAD_BYTES = 100_000;

/** Generous upper bound for drawer-fit padding (mm); the client clamps ≥ 0. */
const MAX_PADDING_MM = 1000;

/** Max corner radius (mm); matches the client clamp in `constants.ts` / `schemas.ts`. */
const MAX_CORNER_RADIUS_MM = 200;

/**
 * Max chunks per axis in a custom split plan. A plate caps at 50 grid units and
 * a chunk is at least a half unit, so 100 covers every legal plan; the bound
 * exists so a crafted payload can't ask the worker for thousands of pieces.
 */
const MAX_SPLIT_CHUNKS = 100;

/** Mount-down screw hole bounds (#3425), mirroring `SCREW_*` in `src/core/constants.ts`. */
const MIN_SCREW_DIAMETER_MM = 2;
const MAX_SCREW_DIAMETER_MM = 8;
const MIN_SCREW_HEAD_DIAMETER_MM = 3;
const MAX_SCREW_HEAD_DIAMETER_MM = 16;
const MIN_SCREWS_PER_PIECE = 1;
const MAX_SCREWS_PER_PIECE = 8;
/**
 * The counterbore pocket IS the head recess, and a floor-sited screw grows the
 * plate's slab by that recess plus its retaining floor, so an unbounded depth is
 * an unbounded printed plate.
 *
 * Mirrors SCREW_COUNTERBORE_MAX_DEPTH_MM in src/core/constants.ts by value, not
 * by import: api/ has no `@/` alias. Keep the two in step. The client clamps at
 * this bound and the CQRS schema rejects past it, so an equal cap here can never
 * reject a payload the app could honestly author.
 */
const MAX_COUNTERBORE_DEPTH_MM = 6;

const VALID_SCREW_HEAD_STYLES = ['countersink', 'counterbore'] as const;

/**
 * Keys allowed inside `screwHoles`. The nested object is closed rather than
 * merely allowlisted at the top level, so its entry count is bounded by this set
 * and a crafted payload can't park arbitrary fields on it.
 */
const ALLOWED_SCREW_HOLE_KEYS = new Set<string>([
  'enabled',
  'diameter',
  'headStyle',
  'headDiameter',
  'counterboreDepth',
  'screwsPerPiece',
]);

/**
 * Top-level keys allowed inside `params` after validation. Mirrors
 * `StoredBaseplateParams` in `src/core/types.ts` — update both together when
 * adding a generator-level baseplate parameter. Anything outside this set
 * (including `__proto__` / `constructor`) is dropped before the payload
 * reaches the blob.
 */
const ALLOWED_PARAM_KEYS = new Set<string>([
  'magnetHoles',
  'magnetDiameter',
  'magnetDepth',
  'paddingLeft',
  'paddingRight',
  'paddingFront',
  'paddingBack',
  'paddingAnchor',
  'overTile',
  'overTileHalfGrid',
  'overTileHalfGridSolidLeftover',
  'wholeCellsOnly',
  'connectorNubs',
  'lightweight',
  'solidFloor',
  'solidFloorThickness',
  'syncWithLayout',
  'baseplateWidth',
  'baseplateDepth',
  'invertDovetails',
  'preferIdenticalPieces',
  'connectorStyle',
  'connectorSlotsAllEdges',
  'connectorFitOffset',
  'cornerRadius',
  'cornerRadii',
  'fractionalEdgeX',
  'fractionalEdgeY',
  'detachMargins',
  'detachMarginConnector',
  'stackPrint',
  'splitOverride',
  'screwHoles',
]);

function pickAllowedParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(params)) {
    if (ALLOWED_PARAM_KEYS.has(key)) {
      out[key] = params[key];
    }
  }
  return out;
}

export interface BaseplateSharePayload {
  type: 'baseplate';
  version: 1;
  params: Record<string, unknown>;
}

export type BaseplateValidationResult =
  | { valid: true; payload: BaseplateSharePayload }
  | { valid: false; error: { code: string; message: string } };

/**
 * Validate and normalize a baseplate sync payload.
 *
 * @param body - Expected shape `{ type: 'baseplate', version: 1, params: { ... } }`.
 * @param sizeBytes - Size of the raw payload in bytes (enforces the size cap).
 */
export function validateBaseplateShare(
  body: unknown,
  sizeBytes: number
): BaseplateValidationResult {
  if (sizeBytes > MAX_PAYLOAD_BYTES) {
    return validationError('SIZE_EXCEEDED', 'Baseplate payload too large (max 100KB)');
  }

  if (!isObject(body)) {
    return validationError('INVALID_PAYLOAD', 'Payload must be an object');
  }

  if (body.type !== 'baseplate') {
    return validationError('INVALID_TYPE', 'type must be "baseplate"');
  }

  if (body.version !== 1) {
    return validationError('INVALID_VERSION', 'version must be 1');
  }

  const params = body.params;
  if (!isObject(params)) {
    return validationError('MISSING_PARAMS', 'params must be an object');
  }

  // Required v1 fields.
  if (!isBoolean(params.magnetHoles)) {
    return validationError('INVALID_PARAMS', 'magnetHoles must be a boolean');
  }
  if (!isNumber(params.magnetDiameter) || !inRange(params.magnetDiameter, 0.5, 20)) {
    return validationError('INVALID_PARAMS', 'magnetDiameter must be 0.5-20');
  }
  if (!isNumber(params.magnetDepth) || !inRange(params.magnetDepth, 0.5, 10)) {
    return validationError('INVALID_PARAMS', 'magnetDepth must be 0.5-10');
  }
  for (const side of ['paddingLeft', 'paddingRight', 'paddingFront', 'paddingBack'] as const) {
    const value = params[side];
    if (!isNumber(value) || !inRange(value, 0, MAX_PADDING_MM)) {
      return validationError('INVALID_PARAMS', `${side} must be 0-${MAX_PADDING_MM}`);
    }
  }

  // Optional numeric fields: range-checked only when present so a crafted
  // payload can't smuggle absurd values into the BREP worker.
  if (
    params.baseplateWidth !== undefined &&
    (!isNumber(params.baseplateWidth) || !inRange(params.baseplateWidth, 0.5, 50))
  ) {
    return validationError('INVALID_PARAMS', 'baseplateWidth must be 0.5-50');
  }
  if (
    params.baseplateDepth !== undefined &&
    (!isNumber(params.baseplateDepth) || !inRange(params.baseplateDepth, 0.5, 50))
  ) {
    return validationError('INVALID_PARAMS', 'baseplateDepth must be 0.5-50');
  }
  if (
    params.solidFloorThickness !== undefined &&
    (!isNumber(params.solidFloorThickness) || !inRange(params.solidFloorThickness, 0, 50))
  ) {
    return validationError('INVALID_PARAMS', 'solidFloorThickness must be 0-50');
  }
  if (
    params.cornerRadius !== undefined &&
    (!isNumber(params.cornerRadius) || !inRange(params.cornerRadius, 0, MAX_CORNER_RADIUS_MM))
  ) {
    return validationError('INVALID_PARAMS', `cornerRadius must be 0-${MAX_CORNER_RADIUS_MM}`);
  }
  if (params.cornerRadii !== undefined) {
    if (!isObject(params.cornerRadii)) {
      return validationError('INVALID_PARAMS', 'cornerRadii must be an object');
    }
    for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
      const value = params.cornerRadii[corner];
      if (!isNumber(value) || !inRange(value, 0, MAX_CORNER_RADIUS_MM)) {
        return validationError(
          'INVALID_PARAMS',
          `cornerRadii.${corner} must be 0-${MAX_CORNER_RADIUS_MM}`
        );
      }
    }
  }
  if (
    params.connectorFitOffset !== undefined &&
    (!isNumber(params.connectorFitOffset) || !inRange(params.connectorFitOffset, -10, 10))
  ) {
    return validationError('INVALID_PARAMS', 'connectorFitOffset must be -10-10');
  }

  // A user-drawn split plan is the only param that carries arrays, and its
  // length drives how many pieces the BREP worker generates — so it is shape-
  // and bound-checked rather than merely allowlisted. The client re-validates
  // it against the actual plate dimensions (`normalizeSplitOverride`) and drops
  // a plan that no longer fits, so the check here is purely a resource guard.
  if (params.splitOverride !== undefined) {
    if (!isObject(params.splitOverride)) {
      return validationError('INVALID_PARAMS', 'splitOverride must be an object');
    }
    for (const axis of ['cols', 'rows'] as const) {
      const chunks = params.splitOverride[axis];
      if (!Array.isArray(chunks) || chunks.length < 1 || chunks.length > MAX_SPLIT_CHUNKS) {
        return validationError(
          'INVALID_PARAMS',
          `splitOverride.${axis} must be an array of 1-${MAX_SPLIT_CHUNKS} chunk sizes`
        );
      }
      if (chunks.some((size) => !isNumber(size) || !inRange(size, 0.5, 50))) {
        return validationError('INVALID_PARAMS', `splitOverride.${axis} sizes must be 0.5-50`);
      }
    }
  }

  // Mount-down screw holes (#3425). Every field is checked rather than trusted:
  // the head recess drives how tall the plate prints, and `screwsPerPiece` drives
  // how many boolean cuts the BREP worker performs on every split piece.
  if (params.screwHoles !== undefined) {
    const screwHoles = params.screwHoles;
    if (!isObject(screwHoles)) {
      return validationError('INVALID_PARAMS', 'screwHoles must be an object');
    }
    for (const key of Object.keys(screwHoles)) {
      if (!ALLOWED_SCREW_HOLE_KEYS.has(key)) {
        return validationError('INVALID_PARAMS', `screwHoles has unknown key: ${key}`);
      }
    }
    if (!isBoolean(screwHoles.enabled)) {
      return validationError('INVALID_PARAMS', 'screwHoles.enabled must be a boolean');
    }
    if (
      !isNumber(screwHoles.diameter) ||
      !inRange(screwHoles.diameter, MIN_SCREW_DIAMETER_MM, MAX_SCREW_DIAMETER_MM)
    ) {
      return validationError(
        'INVALID_PARAMS',
        `screwHoles.diameter must be ${MIN_SCREW_DIAMETER_MM}-${MAX_SCREW_DIAMETER_MM}`
      );
    }
    if (
      !isString(screwHoles.headStyle) ||
      !VALID_SCREW_HEAD_STYLES.includes(
        screwHoles.headStyle as (typeof VALID_SCREW_HEAD_STYLES)[number]
      )
    ) {
      return validationError(
        'INVALID_PARAMS',
        `screwHoles.headStyle must be one of: ${VALID_SCREW_HEAD_STYLES.join(', ')}`
      );
    }
    if (
      screwHoles.headDiameter !== undefined &&
      (!isNumber(screwHoles.headDiameter) ||
        !inRange(screwHoles.headDiameter, MIN_SCREW_HEAD_DIAMETER_MM, MAX_SCREW_HEAD_DIAMETER_MM))
    ) {
      return validationError(
        'INVALID_PARAMS',
        `screwHoles.headDiameter must be ${MIN_SCREW_HEAD_DIAMETER_MM}-${MAX_SCREW_HEAD_DIAMETER_MM}`
      );
    }
    if (
      screwHoles.counterboreDepth !== undefined &&
      (!isNumber(screwHoles.counterboreDepth) ||
        !inRange(screwHoles.counterboreDepth, 0, MAX_COUNTERBORE_DEPTH_MM))
    ) {
      return validationError(
        'INVALID_PARAMS',
        `screwHoles.counterboreDepth must be 0-${MAX_COUNTERBORE_DEPTH_MM}`
      );
    }
    if (
      screwHoles.screwsPerPiece !== undefined &&
      (!isNumber(screwHoles.screwsPerPiece) ||
        !Number.isInteger(screwHoles.screwsPerPiece) ||
        !inRange(screwHoles.screwsPerPiece, MIN_SCREWS_PER_PIECE, MAX_SCREWS_PER_PIECE))
    ) {
      return validationError(
        'INVALID_PARAMS',
        `screwHoles.screwsPerPiece must be a whole number ${MIN_SCREWS_PER_PIECE}-${MAX_SCREWS_PER_PIECE}`
      );
    }
  }

  return {
    valid: true,
    payload: {
      type: 'baseplate',
      version: 1,
      params: pickAllowedParams(params),
    },
  };
}
