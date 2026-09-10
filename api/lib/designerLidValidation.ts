/** Lid validation for shared bin designs: attachment, hinge, slide, grip, lid cutouts, retention magnet, tray bottom. */

import { isNumber, inRange, isBoolean, isObject } from './validationUtils.js';
import { CONSTRAINTS } from './designerValidationConstants.js';
import { validateCutouts } from './designerCutoutValidation.js';

// Mirrors `LidAttachment` in `src/features/bin-designer/types/lid.ts`.
const VALID_LID_ATTACHMENTS = ['friction', 'clickRails', 'magnetic'] as const;

/**
 * `lid.attachment` takes one more value than `base.trayBottom.attachment` does.
 *
 * A tray bottom is lid mating geometry on a bin's UNDERSIDE — a shell that
 * wraps another bin's stacking lip. `'slide'` describes a plate captive in a
 * channel, which is not a thing an underside can be, so the two lists are
 * deliberately separate rather than one list the tray path also widens.
 */
export const VALID_LID_ATTACHMENTS_TOP = [...VALID_LID_ATTACHMENTS, 'slide', 'hinge'] as const;

export const VALID_LID_SLIDE_PLACEMENTS = ['recessed', 'flush'] as const;

export const VALID_LID_SLIDE_PULLS = ['none', 'notch', 'tab', 'catch'] as const;

/** Wall sides `lid.slide.entrySide` may name. Mirrors `LID_RAIL_SIDES`. */
export const VALID_LID_RAIL_SIDES = ['front', 'back', 'left', 'right'] as const;

const ALLOWED_LID_SLIDE_KEYS = new Set(['placement', 'entrySide', 'clearanceMm', 'pull', 'detent']);

/** Mirrors `LidHingeCatch` in the same module. */
export const VALID_LID_HINGE_CATCHES = ['none', 'detent', 'magnets'] as const;

const ALLOWED_LID_HINGE_KEYS = new Set(['side', 'catchMode', 'fitClearanceMm']);

// Mirrors `LidGripMode` / `LidGripConfig` / `LidGripSides` in the same
// module.
export const VALID_LID_GRIP_MODES = ['none', 'chamfer', 'reveal', 'scallop'] as const;

const ALLOWED_LID_GRIP_KEYS = new Set(['mode', 'sides', 'coverage', 'heightMm', 'binDip']);

const ALLOWED_LID_GRIP_SIDE_KEYS = new Set(['front', 'back', 'left', 'right']);

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
 * Validate `base.trayBottom`. Mirrors `TrayBottomConfig` in
 * `src/features/bin-designer/types/base.ts`. Every field except the optional `floorAtBed` is required: unlike
 * `lid`, this object has no legacy payloads to tolerate — `migrateParams` only
 * ever writes it whole.
 */
export function validateTrayBottom(trayBottom: unknown): string | null {
  if (!isObject(trayBottom)) return 'base.trayBottom must be an object';
  if (trayBottom.floorAtBed !== undefined && !isBoolean(trayBottom.floorAtBed)) {
    return 'base.trayBottom.floorAtBed must be boolean';
  }
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
 * Validate the lid sub-object's geometry-driving fields. The worker
 * feeds `retentionMagnet.*` and `tray.*` straight into BREP, so a crafted
 * share could otherwise smuggle a runaway pocket/recess depth. Bounds mirror
 * `src/features/bin-designer/types/lid.ts`. All fields optional/legacy-tolerant
 * — only present values are range-checked, matching the pass-through history of
 * the `lid` object.
 */
export function validateLid(lid: unknown): string | null {
  if (!isObject(lid)) return 'lid must be an object';
  if (
    lid.attachment !== undefined &&
    !VALID_LID_ATTACHMENTS_TOP.includes(
      lid.attachment as (typeof VALID_LID_ATTACHMENTS_TOP)[number]
    )
  ) {
    return `lid.attachment must be one of: ${VALID_LID_ATTACHMENTS_TOP.join(', ')}`;
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
    (!isNumber(lid.topThicknessMm) || !inRange(lid.topThicknessMm, 0.8, 10))
  ) {
    return 'lid.topThicknessMm must be 0.8-10';
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
  if (lid.slide !== undefined) {
    const slideErr = validateLidSlide(lid.slide);
    if (slideErr) return slideErr;
  }
  if (lid.hinge !== undefined) {
    const hingeErr = validateLidHinge(lid.hinge);
    if (hingeErr) return hingeErr;
  }
  if (lid.cutouts !== undefined) {
    const cutoutsErr = validateLidCutouts(lid.cutouts);
    if (cutoutsErr) return cutoutsErr;
  }
  return null;
}

/**
 * Hinged-lid config. Mirrors `LidHingeConfig` in
 * `src/features/bin-designer/types/lid.ts`.
 *
 * Validated whenever it is PRESENT, not only when the attachment is `'hinge'`:
 * switching modes preserves the config, so a design can legitimately carry a
 * hinge it is not currently using — exactly as it can carry a click-rail
 * selection a wall cutout has disabled.
 *
 * The knuckle layout is deliberately absent from this list because it is
 * derived, not stored (`@/shared/utils/hingeLidPlan`). A count arriving from a
 * payload would be a second, unvalidatable opinion about geometry the server
 * cannot check.
 */
function validateLidHinge(hinge: unknown): string | null {
  if (!isObject(hinge)) return 'lid.hinge must be an object';

  for (const key of Object.keys(hinge)) {
    if (!ALLOWED_LID_HINGE_KEYS.has(key)) return `lid.hinge has unknown key: ${key}`;
  }
  if (
    hinge.side !== undefined &&
    !VALID_LID_RAIL_SIDES.includes(hinge.side as (typeof VALID_LID_RAIL_SIDES)[number])
  ) {
    return `lid.hinge.side must be one of: ${VALID_LID_RAIL_SIDES.join(', ')}`;
  }
  if (
    hinge.catchMode !== undefined &&
    !VALID_LID_HINGE_CATCHES.includes(hinge.catchMode as (typeof VALID_LID_HINGE_CATCHES)[number])
  ) {
    return `lid.hinge.catchMode must be one of: ${VALID_LID_HINGE_CATCHES.join(', ')}`;
  }
  // Range only, not a stop list: the client clamps a stored value into range on
  // load, so an off-step number is legal input. What it cannot absorb is a
  // value outside the range, or a non-number reaching the geometry.
  if (
    hinge.fitClearanceMm !== undefined &&
    (!isNumber(hinge.fitClearanceMm) || !inRange(hinge.fitClearanceMm, 0.15, 0.4))
  ) {
    return 'lid.hinge.fitClearanceMm must be 0.15-0.4';
  }
  return null;
}

/**
 * Sliding-lid config. Mirrors `LidSlideConfig` in
 * `src/features/bin-designer/types/lid.ts`.
 *
 * Only the shape and the one numeric range are enforced here. Everything else
 * the joint depends on — the bearing overlap, the wedge, the travel envelope —
 * is DERIVED by `resolveSlideLidPlan` from measurements the payload does not
 * carry, and that resolver refuses rather than clamps, so there is nothing for
 * a crafted payload to smuggle past. The clearance is the exception: it feeds
 * straight into the geometry, and an out-of-range value would produce a channel
 * that either welds shut or has no bearing at all.
 *
 * The rim placement's incompatibility with a stacking lip is NOT enforced here.
 * It is a compatibility blocker, not an invalid document: a design can carry
 * both while the user decides, exactly as one can carry a click-rail selection
 * that a wall cutout currently disables.
 */
function validateLidSlide(slide: unknown): string | null {
  if (!isObject(slide)) return 'lid.slide must be an object';

  for (const key of Object.keys(slide)) {
    if (!ALLOWED_LID_SLIDE_KEYS.has(key)) return `lid.slide has unknown key: ${key}`;
  }
  if (
    slide.placement !== undefined &&
    !VALID_LID_SLIDE_PLACEMENTS.includes(
      slide.placement as (typeof VALID_LID_SLIDE_PLACEMENTS)[number]
    )
  ) {
    return `lid.slide.placement must be one of: ${VALID_LID_SLIDE_PLACEMENTS.join(', ')}`;
  }
  if (
    slide.entrySide !== undefined &&
    !VALID_LID_RAIL_SIDES.includes(slide.entrySide as (typeof VALID_LID_RAIL_SIDES)[number])
  ) {
    return `lid.slide.entrySide must be one of: ${VALID_LID_RAIL_SIDES.join(', ')}`;
  }
  if (
    slide.pull !== undefined &&
    !VALID_LID_SLIDE_PULLS.includes(slide.pull as (typeof VALID_LID_SLIDE_PULLS)[number])
  ) {
    return `lid.slide.pull must be one of: ${VALID_LID_SLIDE_PULLS.join(', ')}`;
  }
  if (
    slide.clearanceMm !== undefined &&
    (!isNumber(slide.clearanceMm) || !inRange(slide.clearanceMm, 0.1, 0.6))
  ) {
    return 'lid.slide.clearanceMm must be 0.1-0.6';
  }
  if (slide.detent !== undefined && !isBoolean(slide.detent)) {
    return 'lid.slide.detent must be boolean';
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
