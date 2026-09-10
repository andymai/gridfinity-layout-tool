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
import { sanitizeString } from './sanitize.js';
import {
  CONSTRAINTS,
  SLIDE_CONSTRAINTS,
  VALID_SLIDE_RAIL_MOUNTS,
} from './designerValidationConstants.js';
import {
  validateDividers,
  validateCellMask,
  validateCompartments,
} from './designerCompartmentValidation.js';
import { HEX_COLOR_REGEX, validateFeatureColors } from './designerColorValidation.js';
import {
  validateTextDefaults,
  validateSurfaceText,
  validateWallLabelSlots,
  validateLabel,
} from './designerTextValidation.js';
import {
  validateCutoutConfig,
  validateCutouts,
  validateCutoutGroupNames,
  validateMeshAssets,
} from './designerCutoutValidation.js';
import { validateLid } from './designerLidValidation.js';
import { validateBase, validateWalls } from './designerBaseValidation.js';
export {
  VALID_FOOT_LATTICES,
  VALID_LIGHTWEIGHT_MODES,
  VALID_LIP_TIPS,
  VALID_FEET_MODES,
  VALID_PIN_DIAMETERS,
  MAX_CUTOUT_CORNER_RADIUS,
} from './designerBaseValidation.js';
export {
  VALID_LID_ATTACHMENTS_TOP,
  VALID_LID_SLIDE_PLACEMENTS,
  VALID_LID_SLIDE_PULLS,
  VALID_LID_RAIL_SIDES,
  VALID_LID_HINGE_CATCHES,
  VALID_LID_GRIP_MODES,
} from './designerLidValidation.js';
export {
  VALID_CUTOUT_FILL_REFERENCES,
  VALID_CUTOUT_LABEL_MODES,
} from './designerCutoutValidation.js';
export {
  VALID_TEXT_FONTS,
  VALID_TEXT_ANCHORS,
  VALID_TEXT_CASES,
  VALID_TEXT_CUT_PROFILES,
  VALID_WALL_TEXT_SIDES,
  VALID_WALL_TEXT_ALIGNS,
  VALID_LABEL_SOCKET_STYLES,
} from './designerTextValidation.js';
export {
  LIP_CORNERS,
  VALID_LIP_AXIS_COUNTS,
  validateFeatureColors,
} from './designerColorValidation.js';

/**
 * Tag limits. Cross-boundary contract: these MUST match `MAX_TAGS` /
 * `MAX_TAG_LENGTH` in `src/features/bin-designer/utils/tags.ts`, so a tag the
 * client accepts is never silently dropped on sync.
 */
export const DESIGN_TAG_MAX_COUNT = 12;
export const DESIGN_TAG_MAX_LENGTH = 32;

/**
 * Sanitize a raw design tag list: coerce to strings, strip control chars,
 * trim, cap length, drop empties, dedupe case-insensitively (first casing
 * wins), cap count. Non-array input yields `[]`. Lenient (sanitize, don't
 * reject) so a slightly-malformed client never 400s a whole design save.
 */
export function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const clean = sanitizeString(raw, DESIGN_TAG_MAX_LENGTH);
    if (clean === '') continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= DESIGN_TAG_MAX_COUNT) break;
  }
  return out;
}

// Type-safe enum validation. Mirror the client unions in
// `src/features/bin-designer/types/index.ts` — when a value is added there
// it must be added here too, otherwise cloud sync PUTs from up-to-date
// clients will be rejected with a 400.
export const VALID_BIN_STYLES = ['standard', 'slotted', 'solid'] as const;
const VALID_INSERT_SHAPES = ['rectangle', 'circle', 'hexagon', 'rounded-rect', 'slot'] as const;

const VALID_ROTATIONS = [0, 90, 180, 270] as const;

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
  'fractionalEdgeX',
  'fractionalEdgeY',
  'fractionalEdgeManualX',
  'fractionalEdgeManualY',
  'gridUnitMm',
  'magnetAnchor',
  'heightUnitMm',
  'wallThickness',
  'extraWallHeightMm',
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
  'floorPattern',
  'splitConnectors',
  'featureColors',
  'lid',
  'slide',
  'textDefaults',
  'surfaceText',
  'meshAssets',
  'cutoutGroupNames',
  'knifeRest',
  'wallLabelSlots',
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
 * Validate the sliding-tray sub-object. Every field here feeds the generator
 * directly, so a crafted share could otherwise drive a runaway rail or tray.
 * Bounds mirror `SLIDE_CONSTRAINTS` in
 * `src/features/bin-designer/types/slide.ts`. Fields are individually optional
 * so a payload written by an older client still validates.
 */
function validateSlide(slide: unknown): string | null {
  if (!isObject(slide)) return 'slide must be an object';
  if (slide.enabled !== undefined && !isBoolean(slide.enabled)) {
    return 'slide.enabled must be boolean';
  }
  if (
    slide.railMount !== undefined &&
    !VALID_SLIDE_RAIL_MOUNTS.includes(slide.railMount as string)
  ) {
    return `slide.railMount must be one of: ${VALID_SLIDE_RAIL_MOUNTS.join(', ')}`;
  }
  const ranges: readonly [string, number, number][] = [
    [
      'trayWidthUnits',
      SLIDE_CONSTRAINTS.MIN_TRAY_WIDTH_UNITS,
      SLIDE_CONSTRAINTS.MAX_TRAY_WIDTH_UNITS,
    ],
    ['trayDepthMm', SLIDE_CONSTRAINTS.MIN_TRAY_DEPTH_MM, SLIDE_CONSTRAINTS.MAX_TRAY_DEPTH_MM],
    ['trayWallMm', SLIDE_CONSTRAINTS.MIN_TRAY_WALL_MM, SLIDE_CONSTRAINTS.MAX_TRAY_WALL_MM],
    ['railDropMm', SLIDE_CONSTRAINTS.MIN_RAIL_DROP_MM, SLIDE_CONSTRAINTS.MAX_RAIL_DROP_MM],
    [
      'railProtrusionMm',
      SLIDE_CONSTRAINTS.MIN_RAIL_PROTRUSION_MM,
      SLIDE_CONSTRAINTS.MAX_RAIL_PROTRUSION_MM,
    ],
    [
      'railThicknessMm',
      SLIDE_CONSTRAINTS.MIN_RAIL_THICKNESS_MM,
      SLIDE_CONSTRAINTS.MAX_RAIL_THICKNESS_MM,
    ],
    ['clearanceMm', SLIDE_CONSTRAINTS.MIN_CLEARANCE_MM, SLIDE_CONSTRAINTS.MAX_CLEARANCE_MM],
  ];
  for (const [field, min, max] of ranges) {
    const value = slide[field];
    if (value === undefined) continue;
    if (!isNumber(value) || !inRange(value, min, max)) {
      return `slide.${field} must be a number between ${min} and ${max}`;
    }
  }
  return null;
}

/** Mirrors the client `types/knifeBlock.ts` bounds. No text fields — nothing to moderate. */
const VALID_KNIFE_REST_STYLES = ['companion', 'integrated'] as const;
const ALLOWED_KNIFE_REST_KEYS = new Set<string>([
  'enabled',
  'style',
  'gapMm',
  'depthU',
  'grooveDepthMm',
  'color',
]);

function validateKnifeRest(value: unknown): string | null {
  if (!isObject(value)) return 'knifeRest must be an object';
  for (const key of Object.keys(value)) {
    if (!ALLOWED_KNIFE_REST_KEYS.has(key)) return `knifeRest has unknown key: ${key}`;
  }
  if (!isBoolean(value.enabled)) return 'knifeRest.enabled must be boolean';
  if (
    value.style !== undefined &&
    !(VALID_KNIFE_REST_STYLES as readonly string[]).includes(value.style as string)
  ) {
    return `knifeRest.style must be one of: ${VALID_KNIFE_REST_STYLES.join(', ')}`;
  }
  if (value.gapMm !== undefined && !(isNumber(value.gapMm) && inRange(value.gapMm, 0, 200))) {
    return 'knifeRest.gapMm must be a number between 0 and 200';
  }
  if (
    value.depthU !== undefined &&
    !(isNumber(value.depthU) && inRange(value.depthU, 0.5, 4) && (value.depthU * 2) % 1 === 0)
  ) {
    return 'knifeRest.depthU must be between 0.5 and 4 in 0.5 steps';
  }
  if (
    value.grooveDepthMm !== undefined &&
    !(isNumber(value.grooveDepthMm) && inRange(value.grooveDepthMm, 0, 15))
  ) {
    return 'knifeRest.grooveDepthMm must be a number between 0 and 15';
  }
  if (
    value.color !== undefined &&
    !(typeof value.color === 'string' && HEX_COLOR_REGEX.test(value.color))
  ) {
    return 'knifeRest.color must be a hex color';
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
  // Hard ceiling first; the tighter no-mesh cap is applied once params are
  // parsed and we know whether the design legitimately carries mesh assets.
  if (sizeBytes > CONSTRAINTS.MESH_MAX_PAYLOAD_BYTES) {
    return validationError('SIZE_EXCEEDED', 'Designer share payload too large (max 2MB)');
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

  // The tighter no-mesh cap is applied AFTER validateMeshAssets below: the
  // raised budget must be earned by a structurally valid mesh design (assets
  // deep-validated and cross-referenced by mesh cutouts), never by merely
  // having a non-empty `meshAssets` key.

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
  // Mirrors `minHeightUnits` in `src/features/bin-designer/constants/gridfinity.ts`,
  // including its EFFECTIVE-spacer condition: `deriveDimensions` makes the flag
  // inert on a flat base (no socket to shell through), so a crafted
  // `{ style: 'flat', spacer: true, height: 1 }` would otherwise buy the relaxed
  // floor while generating an ordinary 1u bin.
  // A base-only bin (`base.tile`) takes the same relaxed floor on the same
  // effective-flag condition: its wall height is pinned to 0, so `height` is
  // inert and stored as 1.
  const socketed =
    isObject(params.base) && params.base.style !== 'flat' && params.base.style !== 'lid';
  const effectiveTray = socketed && isObject(params.base) && params.base.tile === true;
  const effectiveSpacer = socketed && isObject(params.base) && params.base.spacer === true;
  // A spacer keeps its walls, so unlike the tray its 1u floor only holds while
  // `height * heightUnitMm` clears SOCKET_HEIGHT. `heightUnitMm` is allowlisted
  // but not range-checked here, so fall back to the default for anything that is
  // not a sane positive number rather than dividing by it.
  const rawHeightUnit = params.heightUnitMm;
  const heightUnit =
    isNumber(rawHeightUnit) && Number.isFinite(rawHeightUnit) && rawHeightUnit > 0
      ? rawHeightUnit
      : CONSTRAINTS.DEFAULT_HEIGHT_UNIT_MM;
  const spacerFloor = Math.max(
    CONSTRAINTS.MIN_SPACER_HEIGHT,
    Math.ceil((CONSTRAINTS.SOCKET_HEIGHT + CONSTRAINTS.MIN_BODY_WALL_MM) / heightUnit)
  );
  const minHeight = effectiveTray
    ? CONSTRAINTS.MIN_SPACER_HEIGHT
    : effectiveSpacer
      ? spacerFloor
      : CONSTRAINTS.MIN_HEIGHT;
  if (!isNumber(params.height) || !inRange(params.height, minHeight, CONSTRAINTS.MAX_HEIGHT)) {
    return validationError(
      'INVALID_PARAMS',
      `height must be ${minHeight}-${CONSTRAINTS.MAX_HEIGHT}`
    );
  }

  // Exterior-wall collar (optional; absent = no collar).
  if (
    params.extraWallHeightMm !== undefined &&
    (!isNumber(params.extraWallHeightMm) ||
      !inRange(
        params.extraWallHeightMm,
        CONSTRAINTS.MIN_EXTRA_WALL_HEIGHT,
        CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT
      ))
  ) {
    return validationError(
      'INVALID_PARAMS',
      `extraWallHeightMm must be ${CONSTRAINTS.MIN_EXTRA_WALL_HEIGHT}-${CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT}`
    );
  }

  // Magnet anchor (optional; absent = 'edge', the default corner-tracking anchor).
  if (
    params.magnetAnchor !== undefined &&
    params.magnetAnchor !== 'edge' &&
    params.magnetAnchor !== 'center'
  ) {
    return validationError('INVALID_PARAMS', "magnetAnchor must be 'edge' or 'center'");
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

  if (params.lid !== undefined) {
    const lidErr = validateLid(params.lid);
    if (lidErr) return validationError('INVALID_PARAMS', lidErr);
  }

  if (params.slide !== undefined) {
    const slideErr = validateSlide(params.slide);
    if (slideErr) return validationError('INVALID_PARAMS', slideErr);
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

  if (params.cutouts !== undefined) {
    const cutoutsErr = validateCutouts(params.cutouts);
    if (cutoutsErr) return validationError('INVALID_PARAMS', cutoutsErr);
  }

  if (params.cutoutConfig !== undefined) {
    const cfgErr = validateCutoutConfig(params.cutoutConfig);
    if (cfgErr) return validationError('INVALID_PARAMS', cfgErr);
  }

  const groupNamesErr = validateCutoutGroupNames(params.cutoutGroupNames);
  if (groupNamesErr) return validationError('INVALID_PARAMS', groupNamesErr);

  if (params.meshAssets !== undefined || Array.isArray(params.cutouts)) {
    const meshErr = validateMeshAssets(params.meshAssets, params.cutouts);
    if (meshErr) return validationError('INVALID_PARAMS', meshErr);
  }

  // Conditional payload cap: only a validated mesh design (non-empty assets
  // that survived validateMeshAssets, which guarantees each is referenced by a
  // mesh cutout) earns the raised MESH_MAX_PAYLOAD_BYTES budget checked at the
  // top; everything else keeps the 100KB cap.
  const hasValidMeshImprints =
    isObject(params.meshAssets) && Object.keys(params.meshAssets).length > 0;
  if (!hasValidMeshImprints && sizeBytes > CONSTRAINTS.MAX_PAYLOAD_BYTES) {
    return validationError('SIZE_EXCEEDED', 'Designer share payload too large (max 100KB)');
  }

  if (params.textDefaults !== undefined) {
    const tdErr = validateTextDefaults(params.textDefaults);
    if (tdErr) return validationError('INVALID_PARAMS', tdErr);
  }

  if (params.surfaceText !== undefined) {
    const stErr = validateSurfaceText(params.surfaceText);
    if (stErr) return validationError('INVALID_PARAMS', stErr);
  }

  if (params.wallLabelSlots !== undefined) {
    const slotsErr = validateWallLabelSlots(params.wallLabelSlots);
    if (slotsErr) return validationError('INVALID_PARAMS', slotsErr);
  }
  if (params.knifeRest !== undefined) {
    const krErr = validateKnifeRest(params.knifeRest);
    if (krErr) return validationError('INVALID_PARAMS', krErr);
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
