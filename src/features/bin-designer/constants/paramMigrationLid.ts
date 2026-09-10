/** Migration of persisted lid settings: attachment, retention magnet, tray, grip, hinge, slide, tray bottom. */

import type { TrayBottomConfig } from '../types/base';
import { DEFAULT_TRAY_BOTTOM } from '../types/base';
import {
  DEFAULT_LID_CONFIG,
  LID_ATTACHMENTS,
  LID_MAGNET_DIAMETER_MIN_MM,
  LID_MAGNET_DIAMETER_MAX_MM,
  LID_MAGNET_DEPTH_MIN_MM,
  LID_MAGNET_DEPTH_MAX_MM,
  LID_MAGNET_EDGE_COUNT_MIN,
  LID_MAGNET_EDGE_COUNT_MAX,
  LID_TRAY_DEPTH_MIN_MM,
  LID_TRAY_DEPTH_MAX_MM,
  LID_TRAY_WALL_MIN_MM,
  LID_TRAY_WALL_MAX_MM,
  LID_GRIP_MODES,
  LID_GRIP_COVERAGE_MIN,
  LID_GRIP_COVERAGE_MAX,
  LID_GRIP_HEIGHT_MIN_MM,
  LID_GRIP_HEIGHT_MAX_MM,
  LID_RAIL_SIDES,
  DEFAULT_LID_SLIDE_CONFIG,
  DEFAULT_LID_HINGE_CONFIG,
  LID_HINGE_CATCHES,
  LID_HINGE_FIT_MIN_MM,
  LID_HINGE_FIT_MAX_MM,
  isDefaultLidHinge,
  isDefaultLidSlide,
  LID_SLIDE_PLACEMENTS,
  LID_SLIDE_PULLS,
  LID_SLIDE_CLEARANCE_MIN_MM,
  LID_SLIDE_CLEARANCE_MAX_MM,
} from '../types/lid';
import type {
  LidClickRails,
  LidAttachment,
  LidMagnetConfig,
  LidTrayConfig,
  LidGripConfig,
  LidGripMode,
  LidRailSide,
  LidSlideConfig,
  LidHingeConfig,
  LidHingeCatch,
  LidSlidePlacement,
  LidSlidePull,
} from '../types/lid';
import { clampNumber } from './paramMigrationHelpers';

/**
 * Resolve the lid retention mode. New designs store an explicit
 * `attachment`; older designs predate the field, so derive it from the
 * migrated per-side rails — any wall carrying a rail means the design relied
 * on click retention (`'clickRails'`), otherwise it was friction-fit
 * (`'friction'`). Never auto-derives `'magnetic'`: magnets require the new
 * corner-boss geometry a legacy design never had.
 */
export function migrateAttachment(raw: unknown, migratedRails: LidClickRails): LidAttachment {
  if (typeof raw === 'string' && (LID_ATTACHMENTS as readonly string[]).includes(raw)) {
    return raw as LidAttachment;
  }
  const anyRail =
    migratedRails.front || migratedRails.back || migratedRails.left || migratedRails.right;
  return anyRail ? 'clickRails' : 'friction';
}

/**
 * Clamp the dedicated lid-retention magnet dims. Legacy-absent → factory
 * default; out-of-range → clamped so a hand-edited share can't feed a magnet
 * larger than the corner boss can house into the worker.
 */
export function migrateRetentionMagnet(raw: unknown): LidMagnetConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<LidMagnetConfig>;
  return {
    diameter: clampNumber(
      obj.diameter,
      LID_MAGNET_DIAMETER_MIN_MM,
      LID_MAGNET_DIAMETER_MAX_MM,
      DEFAULT_LID_CONFIG.retentionMagnet.diameter
    ),
    depth: clampNumber(
      obj.depth,
      LID_MAGNET_DEPTH_MIN_MM,
      LID_MAGNET_DEPTH_MAX_MM,
      DEFAULT_LID_CONFIG.retentionMagnet.depth
    ),
    // Whole number of edge magnets per long edge. Legacy-absent →
    // default (0, the four-corner lid); out-of-range hand edits get clamped and
    // rounded so the worker never receives a fractional or oversized count.
    edgeMagnets: Math.round(
      clampNumber(
        obj.edgeMagnets,
        LID_MAGNET_EDGE_COUNT_MIN,
        LID_MAGNET_EDGE_COUNT_MAX,
        DEFAULT_LID_CONFIG.retentionMagnet.edgeMagnets
      )
    ),
  };
}

/** Clamp the tray recess config; legacy-absent → factory default (disabled). */
export function migrateTray(raw: unknown): LidTrayConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<LidTrayConfig>;
  return {
    enabled: obj.enabled === true,
    depthMm: clampNumber(
      obj.depthMm,
      LID_TRAY_DEPTH_MIN_MM,
      LID_TRAY_DEPTH_MAX_MM,
      DEFAULT_LID_CONFIG.tray.depthMm
    ),
    wallMm: clampNumber(
      obj.wallMm,
      LID_TRAY_WALL_MIN_MM,
      LID_TRAY_WALL_MAX_MM,
      DEFAULT_LID_CONFIG.tray.wallMm
    ),
  };
}

/**
 * Clamp the grip-relief config; legacy-absent → factory default (mode `none`),
 * so a design saved regenerates byte-identically.
 */
export function migrateGrip(raw: unknown): LidGripConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_LID_CONFIG.grip;
  const obj = raw as Partial<LidGripConfig>;
  const rawSides = (obj.sides && typeof obj.sides === 'object' ? obj.sides : {}) as Partial<
    Record<LidRailSide, unknown>
  >;
  // Absent sides fall back to the default arrangement; an explicit `false`
  // survives, so a user who turned every side off keeps it off.
  const sides: Record<LidRailSide, boolean> = { ...DEFAULT_LID_CONFIG.grip.sides };
  for (const side of LID_RAIL_SIDES) {
    const value = rawSides[side];
    if (typeof value === 'boolean') sides[side] = value;
  }
  return {
    mode: LID_GRIP_MODES.includes(obj.mode as LidGripMode)
      ? (obj.mode as LidGripMode)
      : DEFAULT_LID_CONFIG.grip.mode,
    sides,
    coverage: clampNumber(
      obj.coverage,
      LID_GRIP_COVERAGE_MIN,
      LID_GRIP_COVERAGE_MAX,
      DEFAULT_LID_CONFIG.grip.coverage
    ),
    // A number is a height the user chose. Anything else (absent on a design
    // saved before the knob existed, or out of range) means auto, the mode's
    // own request.
    heightMm:
      typeof obj.heightMm === 'number' && Number.isFinite(obj.heightMm)
        ? clampNumber(
            obj.heightMm,
            LID_GRIP_HEIGHT_MIN_MM,
            LID_GRIP_HEIGHT_MAX_MM,
            LID_GRIP_HEIGHT_MIN_MM
          )
        : null,
    binDip: obj.binDip === true,
  };
}

/**
 * Hinged-lid config, clamped and collapsed.
 *
 * Same contract as {@link migrateSlide}, for the same reasons: absent on every
 * design that has never used a hinge, so a value the defaults would supply
 * anyway is dropped rather than stored. `communityParamsFingerprint` hashes the
 * whole params object and keys the moderation tombstone (CLAUDE.md gotcha
 * #13a), so a field that were always present would re-hash every design already
 * published and stop old takedowns matching a re-publish.
 *
 * The knuckle layout is deliberately not migrated because it is not stored —
 * `@/shared/utils/hingeLidPlan` derives it from the wall every time. There is
 * nothing here for a hand-edited payload to drive.
 */
export function migrateHinge(raw: unknown): LidHingeConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Partial<LidHingeConfig>;
  const migrated: LidHingeConfig = {
    side: LID_RAIL_SIDES.includes(obj.side as LidRailSide)
      ? (obj.side as LidRailSide)
      : DEFAULT_LID_HINGE_CONFIG.side,
    catchMode: LID_HINGE_CATCHES.includes(obj.catchMode as LidHingeCatch)
      ? (obj.catchMode as LidHingeCatch)
      : DEFAULT_LID_HINGE_CONFIG.catchMode,
    fitClearanceMm: clampNumber(
      obj.fitClearanceMm,
      LID_HINGE_FIT_MIN_MM,
      LID_HINGE_FIT_MAX_MM,
      DEFAULT_LID_HINGE_CONFIG.fitClearanceMm
    ),
  };
  return isDefaultLidHinge(migrated) ? undefined : migrated;
}

export function migrateSlide(raw: unknown): LidSlideConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Partial<LidSlideConfig>;
  const migrated: LidSlideConfig = {
    placement: LID_SLIDE_PLACEMENTS.includes(obj.placement as LidSlidePlacement)
      ? (obj.placement as LidSlidePlacement)
      : DEFAULT_LID_SLIDE_CONFIG.placement,
    entrySide: LID_RAIL_SIDES.includes(obj.entrySide as LidRailSide)
      ? (obj.entrySide as LidRailSide)
      : DEFAULT_LID_SLIDE_CONFIG.entrySide,
    clearanceMm: clampNumber(
      obj.clearanceMm,
      LID_SLIDE_CLEARANCE_MIN_MM,
      LID_SLIDE_CLEARANCE_MAX_MM,
      DEFAULT_LID_SLIDE_CONFIG.clearanceMm
    ),
    pull: LID_SLIDE_PULLS.includes(obj.pull as LidSlidePull)
      ? (obj.pull as LidSlidePull)
      : DEFAULT_LID_SLIDE_CONFIG.pull,
    // Only an explicit `false` turns the detent off, so a payload that omits
    // the key keeps the lid that stays shut.
    detent: obj.detent !== false,
  };
  // Collapsed back to absent when it says nothing a default would not, so a
  // design that has never used a sliding lid keeps the params fingerprint it
  // was published with. See `LidConfig.slide`.
  return isDefaultLidSlide(migrated) ? undefined : migrated;
}

/**
 * Merged a level deeper than the rest of `base` because `clickRails` and
 * `retentionMagnet` are objects: a top-level spread alone would let a payload
 * carrying only `{ clickRails: { front: true } }` drop the other three sides.
 */
export function migrateTrayBottom(stored: Partial<TrayBottomConfig> | undefined): TrayBottomConfig {
  const { floorAtBed, ...rest } = stored ?? {};
  return {
    ...DEFAULT_TRAY_BOTTOM,
    ...rest,
    ...(floorAtBed === true ? { floorAtBed: true } : {}),
    clickRails: { ...DEFAULT_TRAY_BOTTOM.clickRails, ...stored?.clickRails },
    retentionMagnet: { ...DEFAULT_TRAY_BOTTOM.retentionMagnet, ...stored?.retentionMagnet },
  };
}
