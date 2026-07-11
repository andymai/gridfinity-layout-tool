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

import { isNumber, inRange, isBoolean, isObject, validationError } from './validationUtils.js';

/** 100 KB — generous for a flat params object; a guard against smuggled bloat. */
const MAX_PAYLOAD_BYTES = 100_000;

/** Generous upper bound for drawer-fit padding (mm); the client clamps ≥ 0. */
const MAX_PADDING_MM = 1000;

/** Max corner radius (mm); matches the client clamp in `constants.ts` / `schemas.ts`. */
const MAX_CORNER_RADIUS_MM = 200;

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
  'connectorFitOffset',
  'cornerRadius',
  'cornerRadii',
  'fractionalEdgeX',
  'fractionalEdgeY',
  'detachMargins',
  'detachMarginConnector',
  'stackPrint',
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

  return {
    valid: true,
    payload: {
      type: 'baseplate',
      version: 1,
      params: pickAllowedParams(params),
    },
  };
}
