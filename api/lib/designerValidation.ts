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
import { sanitizeString } from './validation.js';
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
const VALID_BIN_STYLES = ['standard', 'slotted', 'solid'] as const;
const VALID_BASE_STYLES = [
  'standard',
  'magnet',
  'screw',
  'magnet_and_screw',
  'weighted',
  'flat',
  // Underside is lid mating geometry instead of a socket.
  'lid',
] as const;
// Mirrors `FOOT_LATTICES` in `src/features/bin-designer/types/base.ts`.
const VALID_FOOT_LATTICES = ['grid', 'half'] as const;
// Mirrors `LIGHTWEIGHT_MODES` in the same file.
const VALID_LIGHTWEIGHT_MODES = ['interior', 'underside'] as const;
// Mirrors `FEET_MODES` and `DETACHABLE_PIN_DIAMETERS_MM` in the same file.
const VALID_FEET_MODES = ['integral', 'detachable'] as const;
const VALID_PIN_DIAMETERS = [2.9, 3] as const;
const VALID_LABEL_TAB_SUPPORTS = ['bracket', 'solid', 'fillet'] as const;
// Mirrors `LabelTabMode` in `src/features/bin-designer/types/index.ts`.
const VALID_LABEL_TAB_MODES = ['text', 'socket'] as const;
const VALID_LABEL_SOCKET_STYLES = ['clickIn', 'slideChannel'] as const;
const VALID_INSERT_SHAPES = ['rectangle', 'circle', 'hexagon', 'rounded-rect', 'slot'] as const;
const VALID_WALL_CUTOUT_SHAPES = ['u-shape', 'scoop', 'funnel'] as const;

/**
 * Cross-boundary contract: MUST match `MAX_CUTOUT_CORNER_RADIUS` in
 * `src/shared/utils/wallCutoutPosition.ts`. A cutout's corner radius drives a
 * blend the generator has to build, so an unbounded one is a crafted payload
 * that turns into an unbounded boolean.
 */
const MAX_CUTOUT_CORNER_RADIUS = 25;
// Mirrors `LidAttachment` in `src/features/bin-designer/types/lid.ts`.
const VALID_LID_ATTACHMENTS = ['friction', 'clickRails', 'magnetic'] as const;
// Mirrors `LidGripMode` / `LidGripConfig` / `LidGripSides` in the same
// module.
const VALID_LID_GRIP_MODES = ['none', 'chamfer', 'reveal', 'scallop'] as const;
const ALLOWED_LID_GRIP_KEYS = new Set(['mode', 'sides', 'coverage', 'heightMm', 'binDip']);
const ALLOWED_LID_GRIP_SIDE_KEYS = new Set(['front', 'back', 'left', 'right']);
const VALID_ROTATIONS = [0, 90, 180, 270] as const;
const VALID_TEXT_FONTS = ['atkinson', 'jetbrains-mono', 'allerta-stencil'] as const;
const VALID_TEXT_MODES = ['engrave', 'emboss', 'through-cut'] as const;
const VALID_CUTOUT_COLOR_SCOPES = ['floor', 'floorAndWalls'] as const;

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
 * Retention-magnet dimensions, shared by `lid.retentionMagnet` and
 * `base.trayBottom.retentionMagnet`. Both feed the SAME worker
 * placement code, so they must be bounded identically — validating them
 * separately is how the tray path ended up accepting values the lid rejects.
 *
 * `edgeMagnets` must be a whole number, not merely in range: the
 * placement loop divides the span by `count + 1`, so a fractional 2.5 emits
 * two magnets spaced for 3.5 and lands them off-centre. The cap also stops a
 * crafted share spawning thousands of boss/pocket booleans. Mirrors
 * LID_MAGNET_* on the client.
 */
function validateRetentionMagnet(magnet: unknown, path: string): string | null {
  if (!isObject(magnet)) return `${path} must be an object`;
  if (isNumber(magnet.diameter) && !inRange(magnet.diameter, 3, 15)) {
    return `${path}.diameter must be 3-15`;
  }
  if (isNumber(magnet.depth) && !inRange(magnet.depth, 1, 6)) {
    return `${path}.depth must be 1-6`;
  }
  if (
    magnet.edgeMagnets !== undefined &&
    (!isNumber(magnet.edgeMagnets) ||
      !Number.isInteger(magnet.edgeMagnets) ||
      !inRange(magnet.edgeMagnets, 0, 3))
  ) {
    return `${path}.edgeMagnets must be an integer 0-3`;
  }
  return null;
}

/**
 * Validate the `base` object of a designer payload.
 *
 * Checks that `base` is an object and that it contains a valid `style`, numeric `magnetDiameter` (1–20),
 * numeric `magnetDepth` (0.5–10), numeric `screwDiameter` (1–10), and boolean `stackingLip`.
 *
 * @param base - The value to validate as a designer `base` object (expected keys: `style`, `magnetDiameter`, `magnetDepth`, `screwDiameter`, `stackingLip`, and the optional `spacer` and `tile`).
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
  // Spacer changes the shell (a floorless riser), so a shared payload has to
  // declare it honestly rather than smuggle a truthy non-boolean past the client.
  if (base.spacer !== undefined && !isBoolean(base.spacer)) {
    return 'base.spacer must be boolean';
  }
  // Same reasoning for the base-only bin: it collapses the wall to zero, which
  // is a different solid entirely, so it must be declared as a real boolean.
  if (base.tile !== undefined && !isBoolean(base.tile)) {
    return 'base.tile must be boolean';
  }
  // Foot lattice per axis: a closed set, so an unknown value is
  // rejected rather than silently falling back to a different set of feet than
  // the publisher previewed — one that may not seat in a baseplate.
  for (const axis of ['footLatticeX', 'footLatticeY'] as const) {
    const value = base[axis];
    if (
      value !== undefined &&
      !VALID_FOOT_LATTICES.includes(value as (typeof VALID_FOOT_LATTICES)[number])
    ) {
      return `base.${axis} must be one of: ${VALID_FOOT_LATTICES.join(', ')}`;
    }
  }
  // Relief direction: a closed set for the same reason the lattice is. The two
  // modes are different solids — one opens the cavity floor, the other leaves it
  // — so an unknown value must be rejected rather than fall back to whichever
  // the publisher did not preview.
  if (
    base.lightweightMode !== undefined &&
    !VALID_LIGHTWEIGHT_MODES.includes(
      base.lightweightMode as (typeof VALID_LIGHTWEIGHT_MODES)[number]
    )
  ) {
    return `base.lightweightMode must be one of: ${VALID_LIGHTWEIGHT_MODES.join(', ')}`;
  }
  // Feet mode: a closed set, and a consequential one — a detachable-feet bin
  // has no socket under it at all, so an unknown value falling back to
  // 'integral' would publish a different part than the one previewed.
  if (
    base.feet !== undefined &&
    !VALID_FEET_MODES.includes(base.feet as (typeof VALID_FEET_MODES)[number])
  ) {
    return `base.feet must be one of: ${VALID_FEET_MODES.join(', ')}`;
  }
  // The pin diameter is an interference fit against a fixed hole, not a free
  // dimension: values outside the offered pair either fall out or will not go
  // on, so membership is checked rather than a range.
  if (
    base.feetPinDiameter !== undefined &&
    !VALID_PIN_DIAMETERS.includes(base.feetPinDiameter as (typeof VALID_PIN_DIAMETERS)[number])
  ) {
    return `base.feetPinDiameter must be one of: ${VALID_PIN_DIAMETERS.join(', ')}`;
  }
  if (base.trayBottom !== undefined) {
    const trayErr = validateTrayBottom(base.trayBottom);
    if (trayErr) return trayErr;
  }
  return null;
}

/**
 * Validate `base.trayBottom`. Mirrors `TrayBottomConfig` in
 * `src/features/bin-designer/types/base.ts`. Every field is required: unlike
 * `lid`, this object has no legacy payloads to tolerate — `migrateParams` only
 * ever writes it whole.
 */
function validateTrayBottom(trayBottom: unknown): string | null {
  if (!isObject(trayBottom)) return 'base.trayBottom must be an object';
  if (
    !VALID_LID_ATTACHMENTS.includes(trayBottom.attachment as (typeof VALID_LID_ATTACHMENTS)[number])
  ) {
    return `base.trayBottom.attachment must be one of: ${VALID_LID_ATTACHMENTS.join(', ')}`;
  }
  if (!isNumber(trayBottom.extraHeightMm) || !inRange(trayBottom.extraHeightMm, 0, 100)) {
    return 'base.trayBottom.extraHeightMm must be 0-100';
  }
  if (!isNumber(trayBottom.clickRailCoverage) || !inRange(trayBottom.clickRailCoverage, 0, 100)) {
    return 'base.trayBottom.clickRailCoverage must be 0-100';
  }
  if (!isObject(trayBottom.clickRails)) return 'base.trayBottom.clickRails must be an object';
  for (const side of ['front', 'back', 'left', 'right']) {
    if (!isBoolean(trayBottom.clickRails[side])) {
      return `base.trayBottom.clickRails.${side} must be boolean`;
    }
  }
  return validateRetentionMagnet(trayBottom.retentionMagnet, 'base.trayBottom.retentionMagnet');
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
  // Corner radii: null is the value that means "defer to the level above", so
  // it is accepted alongside a missing field. Anything else has to be a number
  // in range at BOTH levels — the side's override is what the generator reads.
  const cornerErr = validateCornerRadii(walls, 'walls');
  if (cornerErr) return cornerErr;
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
      const sideCornerErr = validateCornerRadii(sideConfig, `walls.${side}`);
      if (sideCornerErr) return sideCornerErr;
    }
  }
  return null;
}

/** Bound `cornerRadiusTop` / `cornerRadiusBottom` on a walls or per-side object. */
function validateCornerRadii(cfg: Record<string, unknown>, path: string): string | null {
  for (const key of ['cornerRadiusTop', 'cornerRadiusBottom']) {
    const value = cfg[key];
    if (value === undefined || value === null) continue;
    if (!isNumber(value) || !inRange(value, 0, MAX_CUTOUT_CORNER_RADIUS)) {
      return `${path}.${key} must be 0-${MAX_CUTOUT_CORNER_RADIUS} or null`;
    }
  }
  return null;
}

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

/**
 * Validate the lid sub-object's geometry-driving fields. The worker
 * feeds `retentionMagnet.*` and `tray.*` straight into BREP, so a crafted
 * share could otherwise smuggle a runaway pocket/recess depth. Bounds mirror
 * `src/features/bin-designer/types/lid.ts`. All fields optional/legacy-tolerant
 * — only present values are range-checked, matching the pass-through history of
 * the `lid` object.
 */
function validateLid(lid: unknown): string | null {
  if (!isObject(lid)) return 'lid must be an object';
  if (
    lid.attachment !== undefined &&
    !VALID_LID_ATTACHMENTS.includes(lid.attachment as (typeof VALID_LID_ATTACHMENTS)[number])
  ) {
    return `lid.attachment must be one of: ${VALID_LID_ATTACHMENTS.join(', ')}`;
  }
  if (
    lid.extraHeightMm !== undefined &&
    (!isNumber(lid.extraHeightMm) || !inRange(lid.extraHeightMm, 0, 100))
  ) {
    return 'lid.extraHeightMm must be 0-100';
  }
  // Range only, not the stop list: `migrateClickRailCoverage` snaps a stored
  // value to the nearest supported option on load, so an off-stop number is
  // legal input. What it cannot absorb is a value outside the range, which
  // `railPlacements` turns into a rail longer than its own wall.
  if (
    lid.clickRailCoverage !== undefined &&
    (!isNumber(lid.clickRailCoverage) || !inRange(lid.clickRailCoverage, 0, 100))
  ) {
    return 'lid.clickRailCoverage must be 0-100';
  }
  if (
    lid.topThicknessMm !== undefined &&
    (!isNumber(lid.topThicknessMm) || !inRange(lid.topThicknessMm, 0.8, 5))
  ) {
    return 'lid.topThicknessMm must be 0.8-5';
  }
  if (lid.relieveInterior !== undefined && typeof lid.relieveInterior !== 'boolean') {
    return 'lid.relieveInterior must be a boolean';
  }
  if (lid.retentionMagnet !== undefined) {
    const magnetErr = validateRetentionMagnet(lid.retentionMagnet, 'lid.retentionMagnet');
    if (magnetErr) return magnetErr;
  }
  if (lid.tray !== undefined) {
    const tr = lid.tray;
    if (!isObject(tr)) return 'lid.tray must be an object';
    if (tr.enabled !== undefined && !isBoolean(tr.enabled))
      return 'lid.tray.enabled must be boolean';
    if (isNumber(tr.depthMm) && !inRange(tr.depthMm, 1, 30)) return 'lid.tray.depthMm must be 1-30';
    if (isNumber(tr.wallMm) && !inRange(tr.wallMm, 1, 10)) return 'lid.tray.wallMm must be 1-10';
  }
  if (lid.grip !== undefined) {
    const gripErr = validateLidGrip(lid.grip, lid);
    if (gripErr) return gripErr;
  }
  if (lid.cutouts !== undefined) {
    const cutoutsErr = validateLidCutouts(lid.cutouts);
    if (cutoutsErr) return cutoutsErr;
  }
  return null;
}

/**
 * Through-cuts in the lid's plate. The same {@link validateCutouts} the interior
 * array takes, plus the two limits the lid host imposes:
 *
 * - A length cap. Every shape is a boolean op against the plate, and unlike the
 *   interior array (bounded in practice by the cavity it has to fit in) nothing
 *   about a lid limits how many a payload can carry. Mirrors `MAX_LID_CUTOUTS`.
 * - No `shape: 'mesh'`. A mesh imprint is subtracted after tessellation, in the
 *   BIN's mesh frame, so no lid solid could describe one — and a STEP export
 *   refuses imprinted parts for exactly that reason. `migrateParams` drops these
 *   on load; refusing them here keeps a crafted payload from reaching a code path
 *   that would silently ignore it.
 */
function validateLidCutouts(value: unknown): string | null {
  if (!Array.isArray(value)) return 'lid.cutouts must be an array';
  if (value.length > CONSTRAINTS.MAX_LID_CUTOUTS) {
    return `lid.cutouts must have at most ${CONSTRAINTS.MAX_LID_CUTOUTS} entries`;
  }
  const err = validateCutouts(value);
  if (err) return err.replace(/^cutouts/, 'lid.cutouts');
  for (let i = 0; i < value.length; i++) {
    const c: unknown = value[i];
    if (isObject(c) && c.shape === 'mesh') {
      return `lid.cutouts[${i}] cannot use shape 'mesh'`;
    }
  }
  return null;
}

/**
 * Grip relief. Mirrors `LidGripConfig` in
 * `src/features/bin-designer/types/lid.ts`.
 *
 * The depth and span clamps deliberately live only on the client: they resolve
 * against the design's own tray/magnet geometry and produce a SAFE result for
 * any input, so there is nothing here for a crafted payload to smuggle past.
 * What the server does enforce is the shape of the field, the coverage and
 * height bounds, and the one combination that has no valid geometry.
 */
function validateLidGrip(grip: unknown, lid: Record<string, unknown>): string | null {
  if (!isObject(grip)) return 'lid.grip must be an object';

  for (const key of Object.keys(grip)) {
    if (!ALLOWED_LID_GRIP_KEYS.has(key)) return `lid.grip has unknown key: ${key}`;
  }
  if (
    grip.mode !== undefined &&
    !VALID_LID_GRIP_MODES.includes(grip.mode as (typeof VALID_LID_GRIP_MODES)[number])
  ) {
    return `lid.grip.mode must be one of: ${VALID_LID_GRIP_MODES.join(', ')}`;
  }
  if (
    grip.coverage !== undefined &&
    (!isNumber(grip.coverage) || !inRange(grip.coverage, 10, 100))
  ) {
    return 'lid.grip.coverage must be 10-100';
  }
  // `null` is the auto height (the mode's own request), and is what every
  // design carries until a user sets one, so it has to survive the round trip
  // as a value rather than being rejected as a non-number.
  if (
    grip.heightMm !== undefined &&
    grip.heightMm !== null &&
    (!isNumber(grip.heightMm) || !inRange(grip.heightMm, 0.8, 10))
  ) {
    return 'lid.grip.heightMm must be null or 0.8-10';
  }
  if (grip.binDip !== undefined && !isBoolean(grip.binDip)) {
    return 'lid.grip.binDip must be boolean';
  }
  if (grip.sides !== undefined) {
    if (!isObject(grip.sides)) return 'lid.grip.sides must be an object';
    for (const key of Object.keys(grip.sides)) {
      if (!ALLOWED_LID_GRIP_SIDE_KEYS.has(key)) {
        return `lid.grip.sides has unknown key: ${key}`;
      }
      if (!isBoolean(grip.sides[key])) return `lid.grip.sides.${key} must be boolean`;
    }
  }
  // A reveal steps the lid's outer face in, and that face is what a bin
  // stacked on the lid registers against. Every other mode leaves it alone.
  if (grip.mode === 'reveal' && (lid.stackableTop === true || lid.separateStackPlate === true)) {
    return 'lid.grip.mode "reveal" cannot combine with a stackable top';
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
function validateTextDefaults(value: unknown, label = 'textDefaults'): string | null {
  if (!isObject(value)) return `${label} must be an object`;

  for (const key of Object.keys(value)) {
    if (!ALLOWED_TEXT_DEFAULTS_KEYS.has(key)) {
      return `${label} has unknown key: ${key}`;
    }
  }

  if (
    value.font !== undefined &&
    !VALID_TEXT_FONTS.includes(value.font as (typeof VALID_TEXT_FONTS)[number])
  ) {
    return `${label}.font must be one of: ${VALID_TEXT_FONTS.join(', ')}`;
  }
  if (
    value.mode !== undefined &&
    !VALID_TEXT_MODES.includes(value.mode as (typeof VALID_TEXT_MODES)[number])
  ) {
    return `${label}.mode must be one of: ${VALID_TEXT_MODES.join(', ')}`;
  }
  if (value.depth !== undefined && (!isNumber(value.depth) || !inRange(value.depth, 0, 10))) {
    return `${label}.depth must be 0-10`;
  }
  if (value.margin !== undefined && (!isNumber(value.margin) || !inRange(value.margin, 0, 50))) {
    return `${label}.margin must be 0-50`;
  }
  if (
    value.minFontSize !== undefined &&
    (!isNumber(value.minFontSize) || !inRange(value.minFontSize, 0.5, 100))
  ) {
    return `${label}.minFontSize must be 0.5-100`;
  }
  if (
    value.maxFontSize !== undefined &&
    (!isNumber(value.maxFontSize) || !inRange(value.maxFontSize, 0.5, 200))
  ) {
    return `${label}.maxFontSize must be 0.5-200`;
  }
  return null;
}

/**
 * Per-instance text style override (cutout labels, label tabs): the same field
 * caps as `textDefaults` plus `fontSizeOverride`, bounded so a crafted share
 * can't smuggle a size that crashes the BREP worker. `label` prefixes each
 * error with the offending path; the shared fields delegate to
 * `validateTextDefaults`, which also rejects any unknown key.
 */
function validateTextStyleOverride(value: unknown, label: string): string | null {
  if (!isObject(value)) return `${label} must be an object`;

  const { fontSizeOverride, ...shared } = value;
  const sharedErr = validateTextDefaults(shared, label);
  if (sharedErr) return sharedErr;

  if (
    fontSizeOverride !== undefined &&
    (!isNumber(fontSizeOverride) || !inRange(fontSizeOverride, 0.5, 200))
  ) {
    return `${label}.fontSizeOverride must be 0.5-200`;
  }
  return null;
}

const ALLOWED_SURFACE_TEXT_KEYS = new Set(['lidText', 'walls', 'wallAlign', 'style']);
const VALID_WALL_TEXT_SIDES = ['front', 'back', 'left', 'right'] as const;
const VALID_WALL_TEXT_ALIGNS = ['top', 'center', 'bottom'] as const;

/**
 * Exterior-surface text: a lid-top string plus per-wall strings
 * and a shared vertical alignment. Strings share the client's
 * `TEXT_MAX_LENGTH = 50` cap (mirrored numerically, like `compartmentTexts`);
 * the style override reuses the `textDefaults` field caps so a crafted share
 * can't smuggle a depth/size that crashes the BREP worker.
 */
function validateSurfaceText(value: unknown): string | null {
  if (!isObject(value)) return 'surfaceText must be an object';

  for (const key of Object.keys(value)) {
    if (!ALLOWED_SURFACE_TEXT_KEYS.has(key)) {
      return `surfaceText has unknown key: ${key}`;
    }
  }

  if (value.lidText !== undefined) {
    if (typeof value.lidText !== 'string') return 'surfaceText.lidText must be a string';
    if (value.lidText.length > 50) {
      return 'surfaceText.lidText must not exceed 50 characters';
    }
  }
  if (value.walls !== undefined) {
    if (!isObject(value.walls)) return 'surfaceText.walls must be an object';
    for (const key of Object.keys(value.walls)) {
      if (!(VALID_WALL_TEXT_SIDES as readonly string[]).includes(key)) {
        return `surfaceText.walls has unknown key: ${key}`;
      }
      const text = value.walls[key];
      if (typeof text !== 'string') return `surfaceText.walls.${key} must be a string`;
      if (text.length > 50) {
        return `surfaceText.walls.${key} must not exceed 50 characters`;
      }
    }
  }
  if (
    value.wallAlign !== undefined &&
    !(VALID_WALL_TEXT_ALIGNS as readonly string[]).includes(value.wallAlign as string)
  ) {
    return `surfaceText.wallAlign must be one of: ${VALID_WALL_TEXT_ALIGNS.join(', ')}`;
  }
  if (value.style !== undefined) {
    const styleErr = validateTextStyleOverride(value.style, 'surfaceText.style');
    if (styleErr) return styleErr;
  }
  return null;
}

/** Mirrors the client `TEXT_MAX_LENGTH`, as `compartmentTexts` does numerically. */
const LABEL_TEXT_MAX_LENGTH = 50;

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
    // Optional field; absent = back-edge anchor (legacy).
    if (label.edges !== undefined && !['back', 'front', 'both'].includes(label.edges as string)) {
      return 'label.edges must be "back", "front", or "both"';
    }
    // Optional field; absent = per-compartment tabs (legacy).
    if (label.span !== undefined && !isBoolean(label.span)) {
      return 'label.span must be boolean';
    }
    // Row captions for full-width tabs. Bounded like `compartmentTexts` so a
    // direct HTTP POST can't smuggle an unbounded array past the UI.
    if (label.rowTexts !== undefined) {
      if (!Array.isArray(label.rowTexts)) {
        return 'label.rowTexts must be an array';
      }
      if (label.rowTexts.length > CONSTRAINTS.MAX_COMPARTMENT_GRID) {
        return `label.rowTexts length must not exceed ${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
      }
      for (let i = 0; i < label.rowTexts.length; i++) {
        const t = label.rowTexts[i] as unknown;
        if (!isString(t)) {
          return `label.rowTexts[${i}] must be a string`;
        }
        if (t.length > LABEL_TEXT_MAX_LENGTH) {
          return `label.rowTexts[${i}] must not exceed ${LABEL_TEXT_MAX_LENGTH} characters`;
        }
      }
    }
    // Optional field; absent = 0 (tab abuts anchor wall).
    if (label.inset !== undefined) {
      if (
        !isNumber(label.inset) ||
        !inRange(label.inset, CONSTRAINTS.MIN_LABEL_TAB_INSET, CONSTRAINTS.MAX_LABEL_TAB_INSET)
      ) {
        return `label.inset must be ${CONSTRAINTS.MIN_LABEL_TAB_INSET}-${CONSTRAINTS.MAX_LABEL_TAB_INSET}`;
      }
    }
    if (label.textStyle !== undefined) {
      const styleErr = validateTextStyleOverride(label.textStyle, 'label.textStyle');
      if (styleErr) return styleErr;
    }
    // Optional swappable-label mode; absent = 'text' (legacy).
    if (
      label.mode !== undefined &&
      !VALID_LABEL_TAB_MODES.includes(label.mode as (typeof VALID_LABEL_TAB_MODES)[number])
    ) {
      return `label.mode must be one of: ${VALID_LABEL_TAB_MODES.join(', ')}`;
    }
    // Optional socket profile; absent = 'clickIn'.
    if (
      label.socketStyle !== undefined &&
      !VALID_LABEL_SOCKET_STYLES.includes(
        label.socketStyle as (typeof VALID_LABEL_SOCKET_STYLES)[number]
      )
    ) {
      return `label.socketStyle must be one of: ${VALID_LABEL_SOCKET_STYLES.join(', ')}`;
    }
    // Cross-field: socket-mode tabs must be deep enough to host the pocket.
    // Without this a crafted payload passes the generic depth range but the
    // builder silently drops every socket.
    if (
      label.mode === 'socket' &&
      isNumber(label.depth) &&
      label.depth < CONSTRAINTS.MIN_LABEL_SOCKET_TAB_DEPTH
    ) {
      return `label.depth must be at least ${CONSTRAINTS.MIN_LABEL_SOCKET_TAB_DEPTH} when label.mode is "socket"`;
    }
    // Optional signed fit offset for socket clearance calibration.
    if (label.plateFitOffset !== undefined) {
      if (
        !isNumber(label.plateFitOffset) ||
        !inRange(
          label.plateFitOffset,
          CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MIN,
          CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MAX
        )
      ) {
        return `label.plateFitOffset must be ${CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MIN}-${CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MAX}`;
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
  'topAccent',
]);
const ALLOWED_TOP_ACCENT_KEYS = new Set<string>(['enabled', 'heightMm', 'color']);
/** Generous upper bound (mm) — the client clamps to wall height; this only
 *  rejects absurd values a crafted share could smuggle past the size cap. */
const MAX_TOP_ACCENT_HEIGHT_MM = 1000;
const ALLOWED_LIP_CORNER_KEYS = new Set<string>(LIP_CORNERS);
const ALLOWED_LIP_GRID_KEYS = new Set<string>(['corners', 'bands', 'cells']);
const VALID_LIP_AXIS_COUNTS = new Set<number>([1, 2, 4]);
const LIP_CELL_KEY_RE = /^lip:(frontLeft|frontRight|backRight|backLeft):[0-3]$/;

/**
 * Validate the current quadrant×band lip grid shape `{ corners, bands, cells }`.
 * `cells` maps `lip:<corner>:<band>` ids to hex colors.
 */
function validateLipGrid(lip: Record<string, unknown>): string | null {
  for (const key of Object.keys(lip)) {
    if (!ALLOWED_LIP_GRID_KEYS.has(key)) return `featureColors.lip has unknown key: ${key}`;
  }
  for (const axis of ['corners', 'bands'] as const) {
    const v = lip[axis];
    if (v !== undefined && (!isNumber(v) || !VALID_LIP_AXIS_COUNTS.has(v))) {
      return `featureColors.lip.${axis} must be 1, 2, or 4`;
    }
  }
  const cells = lip.cells;
  if (cells !== undefined) {
    if (!isObject(cells)) return 'featureColors.lip.cells must be an object';
    for (const [id, color] of Object.entries(cells)) {
      if (!LIP_CELL_KEY_RE.test(id)) return `featureColors.lip.cells has unknown cell: ${id}`;
      if (!isValidColor(color)) return `featureColors.lip.cells.${id} must be a hex color`;
    }
  }
  return null;
}

/** Validate the top-accent band `{ enabled, heightMm, color }`. */
function validateTopAccent(value: unknown): string | null {
  if (!isObject(value)) return 'featureColors.topAccent must be an object';
  for (const key of Object.keys(value)) {
    if (!ALLOWED_TOP_ACCENT_KEYS.has(key)) {
      return `featureColors.topAccent has unknown key: ${key}`;
    }
  }
  if (value.enabled !== undefined && !isBoolean(value.enabled)) {
    return 'featureColors.topAccent.enabled must be boolean';
  }
  if (
    value.heightMm !== undefined &&
    (!isNumber(value.heightMm) || !inRange(value.heightMm, 0, MAX_TOP_ACCENT_HEIGHT_MM))
  ) {
    return `featureColors.topAccent.heightMm must be 0-${MAX_TOP_ACCENT_HEIGHT_MM}`;
  }
  if (value.color !== undefined && !isValidColor(value.color)) {
    return 'featureColors.topAccent.color must be a hex color';
  }
  return null;
}

/**
 * Accepts three lip shapes so older and newer clients both sync: the legacy
 * `lip: string`, the legacy 4-corner object, or the current quadrant×band
 * grid `{ corners, bands, cells }`. Rejects unknown keys at every level so a
 * crafted share can't smuggle attacker-controlled junk past the size cap.
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
      // New grid shape if it carries any grid key; otherwise legacy 4-corner.
      const isGrid = 'corners' in lip || 'bands' in lip || 'cells' in lip;
      if (isGrid) {
        const err = validateLipGrid(lip);
        if (err) return err;
      } else {
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
      }
    } else {
      return 'featureColors.lip must be a hex color, 4-corner object, or grid';
    }
  }

  if (value.topAccent !== undefined) {
    const err = validateTopAccent(value.topAccent);
    if (err) return err;
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
 * Cutouts are otherwise passed through untyped (their geometry is regenerated
 * client-side), but the shadow-board color fields flow into exported 3MF
 * material colors, so an untrusted `color` / `colorScope` must be rejected here.
 */
function validateCutouts(value: unknown): string | null {
  if (!Array.isArray(value)) return 'cutouts must be an array';
  for (let i = 0; i < value.length; i++) {
    const c: unknown = value[i];
    if (!isObject(c)) return `cutouts[${i}] must be an object`;
    // Hex-only (no legacy slot IDs): this is a new field with no migration path,
    // and the color flows straight into 3MF material colors.
    if (c.color !== undefined && !(typeof c.color === 'string' && HEX_COLOR_REGEX.test(c.color))) {
      return `cutouts[${i}].color must be a hex color`;
    }
    if (
      c.colorScope !== undefined &&
      !VALID_CUTOUT_COLOR_SCOPES.includes(
        c.colorScope as (typeof VALID_CUTOUT_COLOR_SCOPES)[number]
      )
    ) {
      return `cutouts[${i}].colorScope must be one of: ${VALID_CUTOUT_COLOR_SCOPES.join(', ')}`;
    }
    if (c.textStyle !== undefined) {
      const styleErr = validateTextStyleOverride(c.textStyle, `cutouts[${i}].textStyle`);
      if (styleErr) return styleErr;
    }
  }
  return null;
}

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;
// eslint-disable-next-line no-control-regex -- reject control chars in user-supplied asset names/ids
const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f]/;
const ALLOWED_MESH_ASSET_KEYS = new Set(['name', 'data', 'triangleCount', 'sizeMm', 'outlines']);

/**
 * Validate the mesh imprint asset map (STL imports). The mesh geometry itself
 * is regenerated client-side from the compressed data, but a crafted blob
 * could smuggle megabytes of junk or orphan references, so structure, caps,
 * and cutout cross-references are all enforced here.
 */
function validateMeshAssets(value: unknown, cutouts: unknown): string | null {
  const meshCutoutIds: { index: number; meshId: unknown }[] = [];
  if (Array.isArray(cutouts)) {
    for (let i = 0; i < cutouts.length; i++) {
      const c: unknown = cutouts[i];
      if (isObject(c) && c.shape === 'mesh') meshCutoutIds.push({ index: i, meshId: c.meshId });
    }
  }

  if (value === undefined) {
    return meshCutoutIds.length > 0
      ? `cutouts[${meshCutoutIds[0].index}] has shape 'mesh' but meshAssets is missing`
      : null;
  }
  if (!isObject(value)) return 'meshAssets must be an object';

  const entries = Object.entries(value);
  if (entries.length > CONSTRAINTS.MAX_MESH_ASSETS) {
    return `max ${CONSTRAINTS.MAX_MESH_ASSETS} mesh assets`;
  }
  for (const [id, assetRaw] of entries) {
    if (id.length === 0 || id.length > 64 || CONTROL_CHARS_REGEX.test(id)) {
      return 'meshAssets keys must be non-empty strings (max 64 chars)';
    }
    if (!isObject(assetRaw)) return `meshAssets.${id} must be an object`;
    for (const key of Object.keys(assetRaw)) {
      if (!ALLOWED_MESH_ASSET_KEYS.has(key)) return `meshAssets.${id} has unknown key: ${key}`;
    }
    const a = assetRaw;
    if (
      !isString(a.name) ||
      a.name.length === 0 ||
      a.name.length > CONSTRAINTS.MAX_MESH_NAME_LENGTH ||
      CONTROL_CHARS_REGEX.test(a.name)
    ) {
      return `meshAssets.${id}.name must be a clean string (max ${CONSTRAINTS.MAX_MESH_NAME_LENGTH} chars)`;
    }
    if (
      !isString(a.data) ||
      a.data.length === 0 ||
      a.data.length > CONSTRAINTS.MAX_MESH_DATA_LENGTH ||
      !BASE64_REGEX.test(a.data)
    ) {
      return `meshAssets.${id}.data must be base64 (max ${CONSTRAINTS.MAX_MESH_DATA_LENGTH} chars)`;
    }
    if (
      !isNumber(a.triangleCount) ||
      !Number.isInteger(a.triangleCount) ||
      !inRange(a.triangleCount, 1, CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES)
    ) {
      return `meshAssets.${id}.triangleCount must be an integer in [1, ${CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES}]`;
    }
    if (!isObject(a.sizeMm)) return `meshAssets.${id}.sizeMm must be an object`;
    for (const axis of ['x', 'y', 'z'] as const) {
      const v = a.sizeMm[axis];
      if (!isNumber(v) || v <= 0 || v > CONSTRAINTS.MAX_MESH_SIZE_MM) {
        return `meshAssets.${id}.sizeMm.${axis} must be in (0, ${CONSTRAINTS.MAX_MESH_SIZE_MM}]`;
      }
    }
    if (!Array.isArray(a.outlines) || a.outlines.length === 0) {
      return `meshAssets.${id}.outlines must be a non-empty array`;
    }
    let totalPoints = 0;
    for (const ring of a.outlines) {
      if (!Array.isArray(ring) || ring.length < 3) {
        return `meshAssets.${id}.outlines rings need at least 3 points`;
      }
      totalPoints += ring.length;
      for (const point of ring) {
        if (
          !isObject(point) ||
          !isNumber(point.x) ||
          !isNumber(point.y) ||
          Math.abs(point.x) > CONSTRAINTS.MAX_MESH_SIZE_MM ||
          Math.abs(point.y) > CONSTRAINTS.MAX_MESH_SIZE_MM
        ) {
          return `meshAssets.${id}.outlines points must be finite {x, y} within ±${CONSTRAINTS.MAX_MESH_SIZE_MM}mm`;
        }
      }
    }
    if (totalPoints > CONSTRAINTS.MAX_MESH_OUTLINE_POINTS) {
      return `meshAssets.${id}.outlines exceed ${CONSTRAINTS.MAX_MESH_OUTLINE_POINTS} total points`;
    }
  }

  for (const { index, meshId } of meshCutoutIds) {
    if (!isString(meshId) || !(meshId in value)) {
      return `cutouts[${index}].meshId must reference an entry in meshAssets`;
    }
  }

  // Reverse check: every stored asset must be referenced by a mesh cutout.
  // The client GCs assets when their last reference is deleted, so a legit
  // payload never carries orphans — but a crafted one could use them to claim
  // the raised mesh payload cap while shipping no mesh functionality at all.
  const referencedIds = new Set(meshCutoutIds.map((c) => c.meshId));
  for (const [id] of entries) {
    if (!referencedIds.has(id)) {
      return `meshAssets.${id} is not referenced by any mesh cutout`;
    }
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
