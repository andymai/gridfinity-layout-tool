/**
 * Backward-compat migration for persisted bin designs.
 *
 * Everything that coerces an older saved shape into the current `BinParams`
 * lives here — wall/lid/color/param migration plus the style-defaults
 * extraction that mirrors it. `defaults.ts` stays pure data; this module
 * imports those defaults to backfill, never the other way around.
 */

import type {
  BinParams,
  CompartmentConfig,
  StashedCompartment,
  CutoutConfig,
  DividerPieceConfig,
  HandleConfig,
  SlotConfig,
  WallPatternConfig,
  WallPatternSides,
  WallPatternType,
  FloorPatternConfig,
  Cutout,
  HandleCutoutShape,
  WallCutout,
  WallConfig,
  WallCutoutShape,
  KnifeRestConfig,
  KnifeSpec,
} from '../types';
import type { CutoutArrayConfig } from '../types';
import {
  CUTOUT_FILL_REFERENCES,
  DEFAULT_PATTERN_SCALE,
  MAX_ARRAY_INSTANCES,
  MAX_CUTOUT_GROUP_NAMES,
  MAX_GROUP_NAME_LENGTH,
  MAX_PARENT_GROUPS,
} from '../types';
import { referencedGroupIds, sameChain } from '../utils/cutoutHierarchy';
import { groupRepeatConfig } from '@/shared/utils/cutoutArray';
import {
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
  KNIFE_REST_MAX_GAP_MM,
  KNIFE_REST_MIN_DEPTH_U,
  KNIFE_REST_MAX_DEPTH_U,
  KNIFE_REST_MIN_GROOVE_DEPTH_MM,
  KNIFE_REST_MAX_GROOVE_DEPTH_MM,
} from '../types';
import type { AccentBandConfig, FeatureColorConfig, LipAxisCount } from '../types/featureColors';
import { makeUniformLipCells, LIP_CELL_ZONES } from '../types/featureColors';
import type { SlideConfig, SlideRailMount } from '../types/slide';
import { DEFAULT_SLIDE_CONFIG, SLIDE_RAIL_MOUNTS } from '../types/slide';
import type { BaseConfig, TrayBottomConfig } from '../types/base';
import {
  DEFAULT_TRAY_BOTTOM,
  DEFAULT_DETACHABLE_PIN_DIAMETER_MM,
  DETACHABLE_PIN_DIAMETERS_MM,
} from '../types/base';
import {
  DEFAULT_LID_CONFIG,
  LID_CLICK_RAIL_COVERAGE_OPTIONS,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_MAX_MM,
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
  LID_TOP_THICKNESS_MIN_MM,
  LID_TOP_THICKNESS_MAX_MM,
  MAX_LID_CUTOUTS,
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
  LidConfig,
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
import type {
  SurfaceTextConfig,
  TextFontFamily,
  TextMode,
  TextStyleOverride,
  WallTextSide,
  WallTextVerticalAlign,
} from '../types/text';
import {
  DEFAULT_TEXT_STYLE_DEFAULTS,
  TEXT_MAX_LENGTH,
  TEXT_ANCHORS,
  TEXT_CASES,
  TEXT_CUT_PROFILES,
  TEXT_FONT_FAMILIES,
  WALL_ALIGN_TO_ANCHOR,
  normalizeTextInput,
  WALL_TEXT_ALIGNS,
  WALL_TEXT_SIDES,
} from '../types/text';
import type { TextStyleDefaults } from '../types/text';
import { MAX_CUTOUT_CORNER_RADIUS } from '@/shared/utils/wallCutoutPosition';
import { MAX_CUTOUT_TOP_OFFSET_MM } from '../utils/cutoutFill';
import { isUsableFootprintMask } from '../utils/compartments';
import { DESIGNER_CONSTRAINTS } from './gridfinity';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_CUTOUT_CONFIG,
  DEFAULT_DIVIDER_PIECE_CONFIG,
  DEFAULT_HANDLE_CONFIG,
  DEFAULT_SLOT_CONFIG,
  DEFAULT_SPLIT_CONNECTOR_CONFIG,
  DEFAULT_FEATURE_COLOR_CONFIG,
  DISABLED_WALL_CUTOUT,
  VALID_WALL_PATTERNS,
  VALID_FLOOR_PATTERNS,
  DEFAULT_FLOOR_PATTERN_CONFIG,
  VALID_HANDLE_SHAPES,
} from './defaults';

/** Legacy wall config where sides could be numbers instead of WallCutout objects. */
export interface LegacyWallConfig {
  enabled?: boolean;
  shape?: WallCutoutShape;
  width?: number;
  depth?: number;
  cornerRadiusTop?: unknown;
  cornerRadiusBottom?: unknown;
  front?: number | Partial<WallCutout>;
  back?: number | Partial<WallCutout>;
  left?: number | Partial<WallCutout>;
  right?: number | Partial<WallCutout>;
  interior?: Partial<WallCutout>;
}

/**
 * Coerce a stored corner radius to `number | null`.
 *
 * Null is not "missing" here, it is the value that means defer — so anything
 * uninterpretable has to land on null rather than on a number, or a crafted
 * save silently pins a radius the design never asked for.
 */
function cornerRadius(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(MAX_CUTOUT_CORNER_RADIUS, value));
}

/**
 * Normalize a persisted `walls` value to the current {@link WallConfig} shape.
 *
 * @param rawWalls - The stored value (current object form, legacy number form, or undefined)
 * @param defaults - The default wall config to fall back to / backfill from
 * @param disabledCutout - A zeroed, disabled cutout used when expanding legacy numbers
 */
export function migrateWalls(
  rawWalls: WallConfig | LegacyWallConfig | undefined,
  defaults: WallConfig,
  disabledCutout: WallCutout
): WallConfig {
  if (rawWalls === undefined) return defaults;
  const raw = rawWalls as LegacyWallConfig;

  // Helper: infer enabled from non-zero values
  const inferEnabled = (cutout: WallCutout): WallCutout => ({
    ...cutout,
    enabled: cutout.enabled || cutout.width > 0 || cutout.depth > 0,
  });

  // Bound whatever radii are present without introducing the keys: an absent
  // field already means "defer", so backfilling it would rewrite every saved
  // design (and every example's dedupe fingerprint) to say what it already said.
  const cornerFields = (source: {
    readonly cornerRadiusTop?: unknown;
    readonly cornerRadiusBottom?: unknown;
  }): Partial<WallCutout> => {
    const out: { cornerRadiusTop?: number | null; cornerRadiusBottom?: number | null } = {};
    if ('cornerRadiusTop' in source) out.cornerRadiusTop = cornerRadius(source.cornerRadiusTop);
    if ('cornerRadiusBottom' in source) {
      out.cornerRadiusBottom = cornerRadius(source.cornerRadiusBottom);
    }
    return out;
  };

  const withCorners = (cutout: WallCutout): WallCutout => ({ ...cutout, ...cornerFields(cutout) });

  const globalCorners = cornerFields(raw);

  // Detect legacy format: values are numbers instead of WallCutout objects
  if (
    typeof raw.front === 'number' ||
    typeof raw.back === 'number' ||
    typeof raw.left === 'number' ||
    typeof raw.right === 'number'
  ) {
    const toWallCutout = (val: number | Partial<WallCutout> | undefined): WallCutout => {
      if (typeof val === 'number') {
        return {
          ...disabledCutout,
          enabled: val > 0,
          width: val,
          depth: val > 0 ? 100 : 0,
        };
      }
      if (val && typeof val === 'object' && 'width' in val) {
        return withCorners(
          inferEnabled({
            ...defaults.front,
            ...val,
          })
        );
      }
      return defaults.front;
    };
    const front = toWallCutout(raw.front);
    const back = toWallCutout(raw.back);
    const left = toWallCutout(raw.left);
    const right = toWallCutout(raw.right);
    const interior = raw.interior
      ? withCorners(
          inferEnabled({
            ...defaults.interior,
            ...raw.interior,
          })
        )
      : defaults.interior;
    const anySideEnabled =
      front.enabled || back.enabled || left.enabled || right.enabled || interior.enabled;
    return {
      enabled: anySideEnabled,
      shape: defaults.shape,
      width: defaults.width,
      depth: defaults.depth,
      ...globalCorners,
      front,
      back,
      left,
      right,
      interior,
    };
  }

  // New/current format: merge each side with defaults
  const mergeSide = (
    defaultSide: WallCutout,
    rawSide: Partial<WallCutout> | undefined
  ): WallCutout => {
    const merged = { ...defaultSide, ...rawSide };
    // Backfill enabled for old saves that lack the field
    if (rawSide && !('enabled' in rawSide)) {
      return withCorners(inferEnabled(merged));
    }
    return withCorners(merged);
  };
  const asCutout = (
    v: number | Partial<WallCutout> | undefined
  ): Partial<WallCutout> | undefined => (typeof v === 'number' ? undefined : v);
  const front = mergeSide(defaults.front, asCutout(raw.front));
  const back = mergeSide(defaults.back, asCutout(raw.back));
  const left = mergeSide(defaults.left, asCutout(raw.left));
  const right = mergeSide(defaults.right, asCutout(raw.right));
  const interior = mergeSide(defaults.interior, raw.interior);

  // Backfill top-level enabled/width/depth for old saves missing these fields
  const hasGlobalEnabled = 'enabled' in raw && typeof raw.enabled === 'boolean';
  const anySideEnabled =
    front.enabled || back.enabled || left.enabled || right.enabled || interior.enabled;
  const VALID_SHAPES: readonly WallCutoutShape[] = ['u-shape', 'scoop', 'funnel'];
  return {
    enabled: hasGlobalEnabled ? raw.enabled === true : anySideEnabled,
    shape: raw.shape && VALID_SHAPES.includes(raw.shape) ? raw.shape : defaults.shape,
    width: typeof raw.width === 'number' ? raw.width : defaults.width,
    depth: typeof raw.depth === 'number' ? raw.depth : defaults.depth,
    ...globalCorners,
    front,
    back,
    left,
    right,
    interior,
  };
}

/**
 * Expand a legacy `clickRails: boolean` into the per-side object shape.
 * Pre-v4.50 designs stored a single boolean; the new model is one flag
 * per wall. `true` → all four sides on; `false` → all four off; an
 * object is passed through (with missing sides backfilled from the
 * default).
 */
function migrateClickRails(raw: unknown): LidClickRails {
  if (raw === true) return { front: true, back: true, left: true, right: true };
  if (raw === false) return { front: false, back: false, left: false, right: false };
  if (raw && typeof raw === 'object') {
    return { ...DEFAULT_LID_CONFIG.clickRails, ...(raw as Partial<LidClickRails>) };
  }
  return DEFAULT_LID_CONFIG.clickRails;
}

/**
 * Snap a persisted `clickRailCoverage` to the nearest supported option.
 * Out-of-range or non-numeric values fall back to the default. Worker
 * geometry breaks if this slips through (rails 2× the wall length etc.).
 */
function migrateClickRailCoverage(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_LID_CONFIG.clickRailCoverage;
  }
  if (LID_CLICK_RAIL_COVERAGE_OPTIONS.includes(raw)) return raw;
  let nearest = LID_CLICK_RAIL_COVERAGE_OPTIONS[0];
  let bestDiff = Math.abs(raw - nearest);
  for (const option of LID_CLICK_RAIL_COVERAGE_OPTIONS) {
    const diff = Math.abs(raw - option);
    if (diff < bestDiff) {
      bestDiff = diff;
      nearest = option;
    }
  }
  return nearest;
}

/**
 * Clamp a persisted `extraHeightMm` into its valid range. Non-numeric or
 * legacy-absent values default to 0 (the standard lid); out-of-range values
 * are clamped so a corrupt/hand-edited design can't feed a runaway height
 * into the lid cavity geometry.
 */
function migrateExtraHeightMm(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_LID_CONFIG.extraHeightMm;
  }
  return Math.min(LID_EXTRA_HEIGHT_MAX_MM, Math.max(LID_EXTRA_HEIGHT_MIN_MM, raw));
}

/**
 * Resolve the lid retention mode. New designs store an explicit
 * `attachment`; older designs predate the field, so derive it from the
 * migrated per-side rails — any wall carrying a rail means the design relied
 * on click retention (`'clickRails'`), otherwise it was friction-fit
 * (`'friction'`). Never auto-derives `'magnetic'`: magnets require the new
 * corner-boss geometry a legacy design never had.
 */
function migrateAttachment(raw: unknown, migratedRails: LidClickRails): LidAttachment {
  if (typeof raw === 'string' && (LID_ATTACHMENTS as readonly string[]).includes(raw)) {
    return raw as LidAttachment;
  }
  const anyRail =
    migratedRails.front || migratedRails.back || migratedRails.left || migratedRails.right;
  return anyRail ? 'clickRails' : 'friction';
}

/** Clamp a number into [min, max], falling back to `fallback` when non-finite. */
function clampNumber(raw: unknown, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

/**
 * Clamp the dedicated lid-retention magnet dims. Legacy-absent → factory
 * default; out-of-range → clamped so a hand-edited share can't feed a magnet
 * larger than the corner boss can house into the worker.
 */
function migrateRetentionMagnet(raw: unknown): LidMagnetConfig {
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
function migrateTray(raw: unknown): LidTrayConfig {
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
function migrateGrip(raw: unknown): LidGripConfig {
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
 * Clamp the sliding-lid config.
 *
 * Every design saved before the mode existed falls back to
 * {@link DEFAULT_LID_SLIDE_CONFIG} wholesale, which is safe in a way the other
 * lid sub-objects are not: no such design can carry `attachment: 'slide'`, so
 * nothing reads these values and no published geometry moves. That is also why
 * the defaults here are chosen for a good first experience rather than for
 * byte-identity — there is nothing to be identical to.
 */
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
function migrateHinge(raw: unknown): LidHingeConfig | undefined {
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

function migrateSlide(raw: unknown): LidSlideConfig | undefined {
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
 * Clamp a persisted top-level `extraWallHeightMm` (the exterior-wall collar)
 * into its valid range. Non-numeric or legacy-absent values default to 0 (no
 * collar); out-of-range values are clamped so a corrupt/hand-edited design
 * can't feed a runaway wall height into the box + lip geometry.
 */
function migrateExtraWallHeightMm(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.min(
    DESIGNER_CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT,
    Math.max(DESIGNER_CONSTRAINTS.MIN_EXTRA_WALL_HEIGHT, raw)
  );
}

/** Map legacy FilamentSlotId values (from pre-v4.30 designs) to hex colors for migration */
const LEGACY_SLOT_COLORS: Record<string, string> = {
  slot1: '#d4d8dc',
  slot2: '#3b82f6',
  slot3: '#22c55e',
  slot4: '#ef4444',
};

/** Old per-corner lip object (pre quadrant×band grid). */
interface LegacyLipCorners {
  frontLeft?: string;
  frontRight?: string;
  backRight?: string;
  backLeft?: string;
}

/** New quadrant×band lip grid (current shape, possibly partial on reload). */
interface GridLipInput {
  corners?: number;
  bands?: number;
  cells?: { [cellId: string]: string };
}

interface LegacyFeatureColorInput {
  enabled?: boolean;
  body?: string;
  /** Legacy single-color string, legacy 4-corner object, or the new grid. */
  lip?: string | LegacyLipCorners | GridLipInput;
  labelTab?: string;
  base?: string;
  scoop?: string;
  dividers?: string;
  text?: string;
  lid?: string;
  lidLip?: string | LegacyLipCorners | GridLipInput;
  topAccent?: { enabled?: unknown; heightMm?: unknown; color?: unknown };
  bottomAccent?: { enabled?: unknown; heightMm?: unknown; color?: unknown };
}

/** Coerce a persisted accent band (any era) into a full config, backfilling
 *  from the default when a field is missing or the wrong type. */
function migrateAccentBand(
  raw: LegacyFeatureColorInput['topAccent'],
  body: string,
  maxHeightMm: number
): AccentBandConfig {
  const fallback = DEFAULT_FEATURE_COLOR_CONFIG.topAccent;
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, heightMm: Math.min(fallback.heightMm, maxHeightMm), color: body };
  }
  const rawHeight =
    typeof raw.heightMm === 'number' && Number.isFinite(raw.heightMm) && raw.heightMm >= 0
      ? raw.heightMm
      : fallback.heightMm;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : false,
    // Clamp to this design's wall-height bound so a persisted band taller than
    // the bin (saved tall, then shrunk) can't recolor the whole bin on load —
    // mirrors the UI slider cap.
    heightMm: Math.min(rawHeight, maxHeightMm),
    color: typeof raw.color === 'string' ? resolveColor(raw.color, body) : body,
  };
}

function resolveColor(raw: string | undefined, fallback: string): string {
  if (raw === undefined) return fallback;
  return LEGACY_SLOT_COLORS[raw] ?? raw;
}

/** Clamp an arbitrary number to the nearest allowed lip axis count {1,2,4}. */
function clampAxisCount(n: number | undefined): LipAxisCount {
  if (n === 2) return 2;
  if (n === 4) return 4;
  return 1;
}

function isGridLip(lip: LegacyLipCorners | GridLipInput): lip is GridLipInput {
  return 'cells' in lip || 'corners' in lip || 'bands' in lip;
}

/**
 * Resolve the lip grid from any of the three eras. Always returns the full
 * 16-cell grid so callers never see a partial config.
 */
function migrateLip(raw: LegacyFeatureColorInput['lip'], body: string): FeatureColorConfig['lip'] {
  // Era 1: single hex string → uniform 1×1.
  if (typeof raw === 'string') {
    return { corners: 1, bands: 1, cells: makeUniformLipCells(resolveColor(raw, body)) };
  }
  if (raw && typeof raw === 'object') {
    // Era 3: already the grid shape → backfill missing cells from body, clamp counts.
    if (isGridLip(raw)) {
      const cells = makeUniformLipCells(body);
      if (raw.cells) {
        for (const id of LIP_CELL_ZONES) {
          if (typeof raw.cells[id] === 'string') cells[id] = raw.cells[id];
        }
      }
      return { corners: clampAxisCount(raw.corners), bands: clampAxisCount(raw.bands), cells };
    }
    // Era 2: legacy 4-corner object. The per-corner editor was rolled back to a
    // single mirrored picker, so mismatched corners were unreachable from the
    // UI; canonicalize to frontLeft → a uniform 1×1 grid (the visible look the
    // rolled-back single picker already produced; discussion).
    const fl = raw.frontLeft ?? body;
    return { corners: 1, bands: 1, cells: makeUniformLipCells(fl) };
  }
  // Missing → uniform body, 1×1.
  return { corners: 1, bands: 1, cells: makeUniformLipCells(body) };
}

/**
 * Migrate featureColors. Handles three eras of saved designs:
 * - Pre-v4.30: slot IDs like 'slot1' → mapped to hex via LEGACY_SLOT_COLORS.
 * - v4.30..pre-corner-lip: `lip` is a single hex string; all four corners inherit it.
 * - New zones (base / scoop / dividers) missing → inherit body so render is unchanged.
 *
 * `enabled` is back-filled on first load — any pre-existing design with any color
 * customization is treated as opted-in so the user's colored designs keep their look.
 */
function migrateFeatureColors(
  raw: LegacyFeatureColorInput | undefined,
  maxTopAccentMm: number
): FeatureColorConfig {
  if (!raw) return DEFAULT_FEATURE_COLOR_CONFIG;

  const body = resolveColor(raw.body, DEFAULT_FEATURE_COLOR_CONFIG.body);
  const labelTab = resolveColor(raw.labelTab, body);

  const lip = migrateLip(raw.lip, body);

  const base = resolveColor(raw.base, body);
  const scoop = resolveColor(raw.scoop, body);
  const dividers = resolveColor(raw.dividers, body);
  // Text defaults to the label-tab color so single-color designs see no shift
  // when this field is added by migration.
  const text = resolveColor(raw.text, labelTab);
  const lid = resolveColor(raw.lid, body);
  // Backfilled from the LID colour, not from `body`: a design saved before the
  // lid had a lip grid rendered its whole lid one colour, and inheriting `body`
  // instead would visibly repaint that lid's top on first load. Emitted ONLY
  // when it actually diverges from `lid`, so a design that never touched the lid
  // lip keeps its exact params fingerprint (see `FeatureColorConfig.lidLip`).
  const lidLipRaw = raw.lidLip === undefined ? undefined : migrateLip(raw.lidLip, lid);
  const lidLip =
    lidLipRaw !== undefined &&
    LIP_CELL_ZONES.some((id) => (lidLipRaw.cells[id] ?? lid).toLowerCase() !== lid.toLowerCase())
      ? lidLipRaw
      : undefined;
  const topAccent = migrateAccentBand(raw.topAccent, body, maxTopAccentMm);
  // Emitted ONLY when the design actually carries one, so a design that never
  // touched the bottom band keeps its exact params fingerprint (see
  // `FeatureColorConfig.bottomAccent`).
  const bottomAccent =
    raw.bottomAccent === undefined
      ? undefined
      : migrateAccentBand(raw.bottomAccent, body, maxTopAccentMm);

  // Pre-`enabled` design counts as multi-color if body or any zone diverges
  // from the default — zone editors only existed behind the old Labs flag, so
  // any customized color implies multi-color intent.
  const bodyLower = body.toLowerCase();
  const isCustom = (c: string): boolean => c.toLowerCase() !== bodyLower;
  const hasCustomColor =
    bodyLower !== DEFAULT_FEATURE_COLOR_CONFIG.body.toLowerCase() ||
    [labelTab, base, scoop, dividers, text, lid].some(isCustom) ||
    LIP_CELL_ZONES.some((id) => isCustom(lip.cells[id] ?? body)) ||
    lidLip !== undefined ||
    (topAccent.enabled && isCustom(topAccent.color)) ||
    (bottomAccent?.enabled === true && isCustom(bottomAccent.color));

  return {
    enabled: raw.enabled ?? hasCustomColor,
    body,
    lip,
    labelTab,
    base,
    scoop,
    dividers,
    text,
    lid,
    // Spread so the key is absent, not `undefined` — a literal `undefined`
    // still serialises differently from an omitted key in some hashers.
    ...(lidLip ? { lidLip } : {}),
    topAccent,
    ...(bottomAccent ? { bottomAccent } : {}),
  };
}

/**
 * Legacy wallPattern config where `dividers`/`sides` may hold a stray
 * non-boolean/non-object value from an older or hand-crafted save — the
 * migration below (`wallPatternConfig.dividers === true`, the `sides`
 * clamp) coerces whatever lands here back to a valid shape.
 */
interface LegacyWallPatternConfig {
  enabled?: boolean;
  pattern?: string;
  scale?: number;
  dividers?: unknown;
  sides?: unknown;
}

/** Legacy fields that may appear in saved designs from older versions. */
interface LegacyFields {
  dividers?: { x: number; y: number; thickness: number };
  eco?: {
    honeycombWall?: {
      enabled?: boolean;
      mode?: string;
    };
  };
  walls?: WallConfig | LegacyWallConfig;
}

/** Legacy cutout fields from older versions, accepted by migrateCutout. */
interface LegacyCutoutFields {
  /** Pre-split scoop radius (mm). Migrated to scoopRadiusW + scoopRadiusD. */
  scoopRadius?: number;
}

/**
 * A knife spec as it may arrive from a pre-split file: one round
 * `handleDiameterMm` and no width/height yet.
 */
type LegacyKnifeSpec = Omit<KnifeSpec, 'handleWidthMm' | 'handleHeightMm'> & {
  handleWidthMm?: number;
  handleHeightMm?: number;
  handleDiameterMm?: number;
};

/**
 * Split a legacy round `handleDiameterMm` into the width/height pair. A knife
 * already carrying both comes back by reference so a current design keeps its
 * fingerprint; an absent knife (the common case) is left untouched.
 */
function migrateKnifeSpec(knife: KnifeSpec | undefined): KnifeSpec | undefined {
  if (knife === undefined) return knife;
  const legacy = knife as LegacyKnifeSpec;
  if (legacy.handleDiameterMm === undefined) return knife;
  const { handleDiameterMm, ...rest } = legacy;
  return {
    ...rest,
    handleWidthMm: rest.handleWidthMm ?? handleDiameterMm,
    handleHeightMm: rest.handleHeightMm ?? handleDiameterMm,
  };
}

/**
 * Input type for migrateParams — current params plus known legacy fields.
 *
 * `wallPattern` and `featureColors` are re-declared (via `Omit`, not a plain
 * intersection) against their permissive legacy shapes: `Partial<BinParams>`
 * alone would force every field to already match the CURRENT strict config,
 * which defeats the point of a migration input.
 */
type MigrateParamsInput = Omit<Partial<BinParams>, 'wallPattern' | 'featureColors'> &
  LegacyFields & {
    wallPattern?: WallPatternConfig | LegacyWallPatternConfig;
    featureColors?: FeatureColorConfig | LegacyFeatureColorInput;
  };

/**
 * Normalize a persisted ancestry chain.
 *
 * The store maintains these invariants by construction, but a hand-authored or
 * crafted file reaches here without ever having passed through it: non-string
 * entries, a group repeated at two depths (which would make the tree a cycle to
 * anything walking it), and a chain deeper than the editor can show all have to
 * be flattened out before the rest of the app trusts the field.
 *
 * Returns `undefined` for the absent/empty case so a design that never nested
 * serializes exactly as it did before the field existed.
 */
function migrateParentGroups(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const entry of raw as unknown[]) {
    if (typeof entry !== 'string' || entry === '' || seen.has(entry)) continue;
    seen.add(entry);
    chain.push(entry);
    if (chain.length === MAX_PARENT_GROUPS) break;
  }
  return chain.length > 0 ? chain : undefined;
}

/**
 * Set a cutout's ancestry, dropping the field entirely for a top-level one so a
 * design that never nests serializes as it did before the field existed.
 *
 * An unchanged cutout comes back by reference, which is what lets the callers
 * leave an already-consistent design's fingerprint alone.
 */
function withParentGroups(cutout: Cutout, parents: readonly string[]): Cutout {
  if (parents.length === 0) {
    if (cutout.parentGroups === undefined) return cutout;
    const { parentGroups: _drop, ...rest } = cutout;
    return rest;
  }
  if (sameChain(parents, cutout.parentGroups ?? [])) return cutout;
  return { ...cutout, parentGroups: [...parents] };
}

/**
 * Migrate a single cutout's legacy fields to current shape.
 *
 * Idempotent: re-running on an already-migrated cutout leaves W/D untouched.
 * Only copies legacy scoopRadius into both axes when neither axis is set.
 */
function migrateCutout(cutout: Cutout & LegacyCutoutFields): Cutout {
  const { scoopRadius, ...rest } = cutout;
  const knife = migrateKnifeSpec(rest.knife);
  const withKnife = knife === rest.knife ? rest : { ...rest, knife };
  const array = migrateCutoutArray(withKnife.array);
  const withArray = array === withKnife.array ? withKnife : { ...withKnife, array };
  const withParents = withParentGroups(
    withArray,
    migrateParentGroups(withArray.parentGroups) ?? []
  );
  return migrateScoopRadius(withParents, scoopRadius);
}

function migrateScoopRadius(cutout: Cutout, scoopRadius: number | undefined): Cutout {
  if (
    scoopRadius !== undefined &&
    cutout.scoopRadiusW === undefined &&
    cutout.scoopRadiusD === undefined
  ) {
    return { ...cutout, scoopRadiusW: scoopRadius, scoopRadiusD: scoopRadius };
  }
  return cutout;
}

/**
 * Reconcile group ancestry across a cutout array.
 *
 * Two things the store cannot produce but a file can:
 *
 *  - Members of one boolean group claiming DIFFERENT ancestors. The tree is
 *    denormalized across members, so a disagreement has no honest reading; the
 *    first member in array order settles it, the same tiebreak `cutoutBuilder`
 *    already uses to pick a group's op.
 *  - A group used as both a boolean group and a container. That would let a
 *    subgroup change which shapes an op fuses, so the container reading loses
 *    and the id is stripped from every ancestry chain that names it.
 *
 * Untouched cutouts come back by reference, so a design that was already
 * consistent keeps its fingerprint.
 */
function normalizeGroupChains(cutouts: readonly Cutout[]): Cutout[] {
  const booleanIds = new Set<string>();
  for (const c of cutouts) {
    if (c.groupId !== null) booleanIds.add(c.groupId);
  }
  const asContainers = (chain: readonly string[] | undefined): readonly string[] =>
    (chain ?? []).filter((id) => !booleanIds.has(id));

  const canonical = new Map<string, readonly string[]>();
  for (const c of cutouts) {
    if (c.groupId === null || canonical.has(c.groupId)) continue;
    canonical.set(c.groupId, asContainers(c.parentGroups));
  }

  return cutouts.map((c) =>
    withParentGroups(
      c,
      c.groupId === null ? asContainers(c.parentGroups) : (canonical.get(c.groupId) ?? [])
    )
  );
}

/**
 * Keep the names of groups the design still has, the same way mesh assets are
 * swept: the field survives on `...rest`, so without this a deleted assembly's
 * name rides along in every later save and shifts the design's
 * `communityParamsFingerprint`.
 *
 * Clamped, not just filtered: the server rejects an over-long name or an
 * oversized map, so a hand-authored file has to be refused HERE too — the
 * alternative is a design that edits fine locally and fails at publish.
 */
function migrateCutoutGroupNames(
  raw: unknown,
  referenced: ReadonlySet<string>
): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const kept = Object.entries(raw)
    .filter(([id, name]) => referenced.has(id) && typeof name === 'string')
    .map(([id, name]) => [id, (name as string).trim().slice(0, MAX_GROUP_NAME_LENGTH)] as const)
    // Trimmed BEFORE the empty test: the editor reads a whitespace-only name as
    // unnamed, so keeping one leaves an inert entry that still shifts the
    // design's fingerprint.
    .filter(([, name]) => name !== '')
    .slice(0, MAX_CUTOUT_GROUP_NAMES);
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/**
 * Give every member of a group the repeat its group runs.
 *
 * Repeating a loose cutout and THEN grouping it used to leave the config on
 * that member alone. The worker has always cut every copy of such a group, so
 * the config is spread across the members here rather than dropped, and the
 * editor then draws the same copies the export cuts.
 *
 * A group whose members disagree is left exactly as it is: `groupRepeatConfig`
 * declines to repeat it, and rewriting one member's pattern onto the others
 * would move cuts in a design nothing in this app produced.
 *
 * Returns the input by reference when nothing needed changing, so a design that
 * was already consistent serializes byte-identically.
 */
function shareGroupArrays(cutouts: readonly Cutout[]): Cutout[] {
  const byGroup = new Map<string, Cutout[]>();
  for (const cutout of cutouts) {
    if (cutout.groupId === null) continue;
    const members = byGroup.get(cutout.groupId);
    if (members) members.push(cutout);
    else byGroup.set(cutout.groupId, [cutout]);
  }
  const shared = new Map<string, CutoutArrayConfig>();
  for (const [groupId, members] of byGroup) {
    if (members.every((m) => m.array !== undefined)) continue;
    const config = groupRepeatConfig(members);
    if (config) shared.set(groupId, config);
  }
  if (shared.size === 0) return [...cutouts];
  return cutouts.map((c) => {
    if (c.groupId === null || c.array !== undefined) return c;
    const config = shared.get(c.groupId);
    return config ? { ...c, array: config } : c;
  });
}

/**
 * Normalize a repeat's per-copy label list. The share/sync validator rejects an
 * oversized one, but a hand-authored JSON imported locally never reaches it, so
 * the caps are applied here too: at most one label per copy the repeat can
 * expand to, each one line long.
 *
 * Returns the input by reference when nothing needed changing, so a design that
 * predates the list serializes byte-identically and its fingerprint holds.
 */
function migrateCutoutArray(array: CutoutArrayConfig | undefined): CutoutArrayConfig | undefined {
  if (!array) return array;
  const raw: unknown = array.labels;
  if (raw === undefined) return array;
  if (!Array.isArray(raw)) {
    const { labels: _drop, ...rest } = array;
    return rest;
  }
  const labels = raw
    .slice(0, MAX_ARRAY_INSTANCES)
    .map((entry: unknown) => (typeof entry === 'string' ? entry.slice(0, TEXT_MAX_LENGTH) : ''));
  const unchanged =
    labels.length === raw.length && labels.every((entry, i) => entry === (raw as unknown[])[i]);
  return unchanged ? array : { ...array, labels };
}

/**
 * Normalize `lid.cutouts`.
 *
 * Lid cutouts are the same {@link Cutout} the interior uses and take the same
 * per-shape migration, with two host-imposed differences:
 *
 * - `shape: 'mesh'` is dropped. A mesh imprint is subtracted AFTER tessellation
 *   and in the bin's mesh frame, so no lid solid could ever describe one — which
 *   is also why STEP export refuses imprinted bins outright (CLAUDE.md gotcha
 *   #20). Dropping is the honest outcome; the alternative is a second imprint
 *   path that cannot be exported.
 * - The array is capped at {@link MAX_LID_CUTOUTS}, so a crafted share cannot
 *   hand the boolean engine an unbounded shape list. Truncation matches the
 *   client action's refusal rather than silently keeping the tail.
 *
 * Returns `undefined` rather than `[]` for the absent/empty case, so a design with
 * no lid cutouts serializes exactly as it did before the field existed.
 */
function migrateLidCutouts(raw: unknown): Cutout[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = normalizeGroupChains(raw.map((c) => migrateCutout(c as Cutout & LegacyCutoutFields)))
    .filter((c) => c.shape !== 'mesh')
    .slice(0, MAX_LID_CUTOUTS);
  // Absent, not empty: see the field's own note. An array that migrated down to
  // nothing (all-mesh, say) must collapse too, or it would shift the fingerprint
  // of a design that ends up carrying no lid cutouts at all.
  return out.length > 0 ? out : undefined;
}

/**
 * Normalize a persisted `surfaceText` value. Clamps the string to
 * `TEXT_MAX_LENGTH` and collapses empty/junk objects to `undefined` so
 * pre-feature designs (and designs whose text was cleared) serialize
 * byte-identically to before the field existed. The style override passes
 * through shape-checked only — field ranges are the share/sync validator's
 * job, matching how `label.textStyle` is handled.
 */
const MIGRATE_TEXT_FONTS: readonly TextFontFamily[] = TEXT_FONT_FAMILIES;
const MIGRATE_TEXT_MODES: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'];

/**
 * Sanitize a persisted surface-text style override field-by-field: unknown
 * keys drop, enums must match, numbers must be finite and in the same ranges
 * the share/sync validator enforces (`api/lib/designerValidation.ts`
 * `validateTextDefaults`). Locally persisted or imported designs bypass that
 * server mirror, and a malformed depth/size here would flow straight into the
 * BREP worker via `resolveLidInputs`.
 */
function isObj(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null;
}

function migrateTextStyleOverride(raw: unknown): TextStyleOverride | undefined {
  if (!isObj(raw)) return undefined;
  const value = raw;
  const num = (v: unknown, min: number, max: number): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
  const depth = num(value.depth, 0, 10);
  const margin = num(value.margin, 0, 50);
  const minFontSize = num(value.minFontSize, 0.5, 100);
  const maxFontSize = num(value.maxFontSize, 0.5, 200);
  const fontSizeOverride = num(value.fontSizeOverride, 0.5, 200);
  const enumField = <T extends string>(raw: unknown, allowed: readonly T[]): T | undefined =>
    allowed.includes(raw as T) ? (raw as T) : undefined;
  const boolField = (raw: unknown): boolean | undefined =>
    typeof raw === 'boolean' ? raw : undefined;

  const anchor = enumField(value.anchor, TEXT_ANCHORS);
  const sizeMode = enumField(value.sizeMode, ['auto', 'fixed'] as const);
  const textCase = enumField(value.textCase, TEXT_CASES);
  const cutProfile = enumField(value.cutProfile, TEXT_CUT_PROFILES);
  const fixedSize = num(value.fixedSize, 0.5, 200);
  const tracking = num(value.tracking, -0.5, 2);
  const lineScale = num(value.lineScale, 0.1, 2);
  const lineGap = num(value.lineGap, 0, 4);
  const draftAngleDeg = num(value.draftAngleDeg, 0, 45);
  const snapToScale = boolField(value.snapToScale);
  const uniformAcrossWalls = boolField(value.uniformAcrossWalls);
  const autoTracking = boolField(value.autoTracking);
  // An offset only survives with BOTH axes finite: a half-migrated `{x: 3}`
  // would leave `offset.y` undefined and NaN out every baseline it touches.
  const offsetX = isObj(value.offset) ? num(value.offset.x, -500, 500) : undefined;
  const offsetY = isObj(value.offset) ? num(value.offset.y, -500, 500) : undefined;
  const offset =
    offsetX !== undefined && offsetY !== undefined ? { x: offsetX, y: offsetY } : undefined;

  const out: TextStyleOverride = {
    ...(MIGRATE_TEXT_FONTS.includes(value.font as TextFontFamily)
      ? { font: value.font as TextFontFamily }
      : {}),
    ...(MIGRATE_TEXT_MODES.includes(value.mode as TextMode)
      ? { mode: value.mode as TextMode }
      : {}),
    ...(depth !== undefined ? { depth } : {}),
    ...(margin !== undefined ? { margin } : {}),
    ...(minFontSize !== undefined ? { minFontSize } : {}),
    ...(maxFontSize !== undefined ? { maxFontSize } : {}),
    ...(fontSizeOverride !== undefined ? { fontSizeOverride } : {}),
    ...(anchor !== undefined ? { anchor } : {}),
    ...(offset !== undefined ? { offset } : {}),
    ...(sizeMode !== undefined ? { sizeMode } : {}),
    ...(fixedSize !== undefined ? { fixedSize } : {}),
    ...(snapToScale !== undefined ? { snapToScale } : {}),
    ...(uniformAcrossWalls !== undefined ? { uniformAcrossWalls } : {}),
    ...(tracking !== undefined ? { tracking } : {}),
    ...(autoTracking !== undefined ? { autoTracking } : {}),
    ...(textCase !== undefined ? { textCase } : {}),
    ...(lineScale !== undefined ? { lineScale } : {}),
    ...(lineGap !== undefined ? { lineGap } : {}),
    ...(cutProfile !== undefined ? { cutProfile } : {}),
    ...(draftAngleDeg !== undefined ? { draftAngleDeg } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Normalize a persisted `knifeRest`. Invalid shapes drop to `undefined`
 * (pre-feature designs stay byte-identical); numeric fields are clamped to the
 * editor bounds so a hand-edited share can't drive runaway rest geometry.
 * Fields at their defaults are dropped rather than persisted.
 */
function migrateKnifeRest(raw: unknown): KnifeRestConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.enabled !== 'boolean') return undefined;
  const style = value.style === 'integrated' ? ('integrated' as const) : undefined;
  const gapMm =
    value.gapMm !== undefined
      ? clampNumber(value.gapMm, 0, KNIFE_REST_MAX_GAP_MM, KNIFE_REST_DEFAULT_GAP_MM)
      : undefined;
  const depthU =
    value.depthU !== undefined
      ? Math.round(
          clampNumber(value.depthU, KNIFE_REST_MIN_DEPTH_U, KNIFE_REST_MAX_DEPTH_U, 1) * 2
        ) / 2
      : undefined;
  const grooveDepthMm =
    value.grooveDepthMm !== undefined
      ? clampNumber(
          value.grooveDepthMm,
          KNIFE_REST_MIN_GROOVE_DEPTH_MM,
          KNIFE_REST_MAX_GROOVE_DEPTH_MM,
          KNIFE_REST_GROOVE_DEPTH_MM
        )
      : undefined;
  const color = typeof value.color === 'string' ? value.color : undefined;
  return {
    enabled: value.enabled,
    ...(style !== undefined ? { style } : {}),
    ...(gapMm !== undefined ? { gapMm } : {}),
    ...(depthU !== undefined ? { depthU } : {}),
    ...(grooveDepthMm !== undefined ? { grooveDepthMm } : {}),
    ...(color !== undefined ? { color } : {}),
  };
}

function migrateSurfaceText(raw: unknown): SurfaceTextConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { lidText, walls, wallAlign, style, lidStyle, wallStyles } = raw as {
    lidText?: unknown;
    walls?: unknown;
    wallAlign?: unknown;
    style?: unknown;
    lidStyle?: unknown;
    wallStyles?: unknown;
  };
  // Trimmed on write (store setters) — trim again here so the worker (which
  // trims before generating) and persisted state can't disagree.
  const text = typeof lidText === 'string' ? normalizeTextInput(lidText).trim() : undefined;
  const hasText = text !== undefined && text !== '';

  // Per-wall strings: keep only known sides with non-empty values, clamped
  // and trimmed like the lid text.
  const migratedWalls: Partial<Record<WallTextSide, string>> = {};
  if (typeof walls === 'object' && walls !== null) {
    for (const side of WALL_TEXT_SIDES) {
      const value = (walls as Record<string, unknown>)[side];
      if (typeof value === 'string' && value.trim() !== '') {
        migratedWalls[side] = normalizeTextInput(value).trim();
      }
    }
  }
  const hasWalls = Object.keys(migratedWalls).length > 0;

  // The legacy one-knob alignment folds into the style's anchor and the key is
  // dropped. Horizontal was always centred back then, so the three values map
  // exactly onto three of the nine anchors and nothing about an existing design
  // moves. An anchor already on the style wins: it can only have been written
  // by the newer control, which supersedes the knob.
  // Only where wall text survives: the knob was meaningless without it, so a
  // design that had none must still collapse to absent rather than gaining a
  // style key it never had.
  const legacyAnchor =
    hasWalls &&
    typeof wallAlign === 'string' &&
    (WALL_TEXT_ALIGNS as readonly string[]).includes(wallAlign)
      ? WALL_ALIGN_TO_ANCHOR[wallAlign as WallTextVerticalAlign]
      : undefined;

  const baseStyle = migrateTextStyleOverride(style);
  const migratedStyle =
    legacyAnchor !== undefined && legacyAnchor !== 'center' && baseStyle?.anchor === undefined
      ? { ...baseStyle, anchor: legacyAnchor }
      : baseStyle;

  const migratedLidStyle = migrateTextStyleOverride(lidStyle);
  const migratedWallStyles: Partial<Record<WallTextSide, TextStyleOverride>> = {};
  if (isObj(wallStyles)) {
    for (const side of WALL_TEXT_SIDES) {
      const migrated = migrateTextStyleOverride(wallStyles[side]);
      if (migrated !== undefined) migratedWallStyles[side] = migrated;
    }
  }
  const hasWallStyles = Object.keys(migratedWallStyles).length > 0;

  if (
    !hasText &&
    !hasWalls &&
    migratedStyle === undefined &&
    migratedLidStyle === undefined &&
    !hasWallStyles
  ) {
    return undefined;
  }
  return {
    ...(hasText ? { lidText: text } : {}),
    ...(hasWalls ? { walls: migratedWalls } : {}),
    ...(migratedStyle !== undefined ? { style: migratedStyle } : {}),
    ...(migratedLidStyle !== undefined ? { lidStyle: migratedLidStyle } : {}),
    ...(hasWallStyles ? { wallStyles: migratedWallStyles } : {}),
  };
}

/**
 * A stash entry's footprint mask, or undefined for a plain rectangle. Anything
 * the server would reject — wrong length, non-boolean, empty, all-filled, or
 * split into two islands — is dropped rather than repaired, landing the entry on
 * the rectangle the field's absence already means. Dropping beats leaving the
 * mask in place: `drawFootprint` refuses a disconnected footprint, so a kept one
 * would show a shelf chip that silently declines to place.
 */
function cleanFootprintMask(mask: unknown, w: number, h: number): boolean[] | undefined {
  if (!Array.isArray(mask)) return undefined;
  const cells: unknown[] = mask;
  if (cells.some((cell) => typeof cell !== 'boolean')) return undefined;
  const booleans = cells as boolean[];
  return isUsableFootprintMask(booleans, w, h) ? booleans : undefined;
}

/**
 * Sanitize the Bento workspace fields on load, mirroring the server bounds:
 * stash entries need integer cell footprints within the grid ceiling and a
 * clamped label; `drawnUnitCells` may only mark IDs that are 1×1 in `cells`,
 * and `backgroundIds` only IDs that exist, and only in merged-leftover mode. All collapse to absent when empty —
 * an always-present default would shift `communityParamsFingerprint` for every
 * existing design (see `base.tile`).
 */
function migrateBentoCompartmentFields(config: CompartmentConfig): CompartmentConfig {
  const { stash, drawnUnitCells, backgroundIds, mergeBackground, ...rest } = config;

  // Persisted payloads are untrusted — validate as unknown despite the type.
  const rawStash: readonly unknown[] = Array.isArray(stash) ? stash : [];
  const cleanStash = rawStash
    .filter((entry): entry is StashedCompartment => {
      if (typeof entry !== 'object' || entry === null) return false;
      const e = entry as Record<string, unknown>;
      return (
        typeof e.w === 'number' &&
        Number.isInteger(e.w) &&
        typeof e.h === 'number' &&
        Number.isInteger(e.h) &&
        e.w >= 1 &&
        e.h >= 1 &&
        e.w <= DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID &&
        e.h <= DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
      );
    })
    .slice(0, DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES)
    .map(({ w, h, cells, label }) => {
      const clamped = typeof label === 'string' ? label.slice(0, TEXT_MAX_LENGTH) : '';
      const mask = cleanFootprintMask(cells, w, h);
      return {
        w,
        h,
        ...(mask ? { cells: mask } : {}),
        ...(clamped.length > 0 ? { label: clamped } : {}),
      };
    });

  const counts = new Map<number, number>();
  for (const id of config.cells) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const cleanDrawn = [
    ...new Set(
      (Array.isArray(drawnUnitCells) ? drawnUnitCells : []).filter(
        (id): id is number => Number.isInteger(id) && counts.get(id) === 1
      )
    ),
  ].sort((a, b) => a - b);

  // Markers outlive their mode only as a way to demote a drawn compartment to
  // background behind the user's back, so they go with it.
  const cleanBackground =
    mergeBackground === true
      ? [
          ...new Set(
            (Array.isArray(backgroundIds) ? backgroundIds : []).filter(
              (id): id is number => Number.isInteger(id) && counts.has(id)
            )
          ),
        ].sort((a, b) => a - b)
      : [];

  return {
    ...rest,
    ...(mergeBackground === true ? { mergeBackground: true } : {}),
    ...(cleanStash.length > 0 ? { stash: cleanStash } : {}),
    ...(cleanDrawn.length > 0 ? { drawnUnitCells: cleanDrawn } : {}),
    ...(cleanBackground.length > 0 ? { backgroundIds: cleanBackground } : {}),
  };
}

/**
 * Merged a level deeper than the rest of `base` because `clickRails` and
 * `retentionMagnet` are objects: a top-level spread alone would let a payload
 * carrying only `{ clickRails: { front: true } }` drop the other three sides.
 */
function migrateTrayBottom(stored: Partial<TrayBottomConfig> | undefined): TrayBottomConfig {
  return {
    ...DEFAULT_TRAY_BOTTOM,
    ...stored,
    clickRails: { ...DEFAULT_TRAY_BOTTOM.clickRails, ...stored?.clickRails },
    retentionMagnet: { ...DEFAULT_TRAY_BOTTOM.retentionMagnet, ...stored?.retentionMagnet },
  };
}

/**
 * Populate missing bin parameters with default values.
 * Handles backward compatibility for old designs:
 * - scoop was boolean in earlier versions
 * - dividers (DividerConfig) migrates to compartments (CompartmentConfig)
 *
 * @param params - Partial bin parameters to migrate; any fields not provided will be filled from `DEFAULT_BIN_PARAMS`.
 * @returns A complete `BinParams` object with unspecified fields taken from `DEFAULT_BIN_PARAMS`.
 */
export function migrateParams(params: MigrateParamsInput): BinParams {
  // Migrate old boolean scoop format to ScoopConfig
  let scoopConfig = DEFAULT_BIN_PARAMS.scoop;
  if (params.scoop !== undefined) {
    if (typeof params.scoop === 'boolean') {
      // Legacy format: boolean → ScoopConfig
      scoopConfig = { ...DEFAULT_BIN_PARAMS.scoop, enabled: params.scoop };
    } else {
      scoopConfig = { ...DEFAULT_BIN_PARAMS.scoop, ...params.scoop };
    }
    // Strip removed allRows field from old saved designs
    const { allRows: _, ...cleanScoop } = scoopConfig as typeof scoopConfig & { allRows?: unknown };
    scoopConfig = cleanScoop;
  }

  // Migrate old DividerConfig to CompartmentConfig
  let compartmentsConfig = DEFAULT_BIN_PARAMS.compartments;
  if (params.compartments !== undefined) {
    compartmentsConfig = migrateBentoCompartmentFields({
      ...DEFAULT_BIN_PARAMS.compartments,
      ...params.compartments,
    });
  } else if (params.dividers !== undefined) {
    // Legacy format: DividerConfig → CompartmentConfig
    const { x, y, thickness } = params.dividers;
    const cols = x + 1;
    const rows = y + 1;
    const cells: number[] = [];
    for (let i = 0; i < rows * cols; i++) {
      cells.push(i);
    }
    compartmentsConfig = { cols, rows, thickness, cells };
  }

  // Migrate old number-based WallConfig to WallCutout format
  const wallsConfig = migrateWalls(params.walls, DEFAULT_BIN_PARAMS.walls, DISABLED_WALL_CUTOUT);

  // Migrate legacy base.solid=true → style='solid'
  const mergedBase = { ...DEFAULT_BIN_PARAMS.base, ...(params.base ?? {}) };
  // Backfilled ONLY for a design that actually uses the lid base. `params` is
  // hashed wholesale by `communityParamsFingerprint`, so backfilling this
  // unconditionally would shift every existing design's fingerprint and break
  // the community duplicate guard against already-published records.
  // Absent, never `false` — a stored `false` would shift the fingerprint of a
  // design that has no tray just as an always-present default would.
  if (mergedBase.tile !== true) {
    delete (mergedBase as { tile?: boolean }).tile;
  }
  // A stored pin diameter from the 5mm era meets pin holes now cut at a fixed
  // 3mm, so the printed parts are unassemblable and the server validator
  // rejects the design outright on re-publish. Snap anything off the current
  // list to the default; absent stays absent, per the fingerprint note above.
  if (
    mergedBase.feetPinDiameter !== undefined &&
    !(DETACHABLE_PIN_DIAMETERS_MM as readonly number[]).includes(mergedBase.feetPinDiameter)
  ) {
    mergedBase.feetPinDiameter = DEFAULT_DETACHABLE_PIN_DIAMETER_MM;
  }
  const baseConfig: BaseConfig =
    mergedBase.style === 'lid'
      ? { ...mergedBase, trayBottom: migrateTrayBottom(mergedBase.trayBottom) }
      : mergedBase;
  let style = params.style ?? DEFAULT_BIN_PARAMS.style;
  if (baseConfig.solid && style !== 'solid') {
    style = 'solid';
  }

  // Backfill slot config and divider pieces
  const slotConfig: SlotConfig = {
    ...DEFAULT_SLOT_CONFIG,
    ...((params.slotConfig as Partial<SlotConfig> | undefined) ?? {}),
    x: {
      ...DEFAULT_SLOT_CONFIG.x,
      ...(params.slotConfig?.x as Partial<SlotConfig['x']> | undefined),
    },
    y: {
      ...DEFAULT_SLOT_CONFIG.y,
      ...(params.slotConfig?.y as Partial<SlotConfig['y']> | undefined),
    },
  };

  const dividerPieces: DividerPieceConfig = {
    ...DEFAULT_DIVIDER_PIECE_CONFIG,
    ...((params.dividerPieces as Partial<DividerPieceConfig> | undefined) ?? {}),
  };

  // Migrate wallPattern config, handling 3 cases:
  // Fresh object each time — avoid returning shared DEFAULT_WALL_PATTERN_CONFIG reference.
  // `wallPatternRaw` stays in the permissive legacy shape until the coercion
  // block below rebuilds a properly-typed `WallPatternConfig` from it — a
  // crafted/legacy save can carry any value in `dividers`/`sides`/`pattern`.
  let wallPatternRaw: WallPatternConfig | LegacyWallPatternConfig = {
    enabled: false,
    pattern: 'honeycomb',
    scale: DEFAULT_PATTERN_SCALE,
    dividers: false,
  };
  if (params.wallPattern !== undefined) {
    wallPatternRaw = { ...wallPatternRaw, ...params.wallPattern };
  } else if (params.eco !== undefined) {
    const honeycombWall = params.eco.honeycombWall;
    if (honeycombWall) {
      wallPatternRaw = {
        enabled:
          typeof honeycombWall.enabled === 'boolean'
            ? honeycombWall.enabled
            : typeof honeycombWall.mode === 'string'
              ? honeycombWall.mode !== 'none'
              : false,
        pattern: 'honeycomb',
        scale: DEFAULT_PATTERN_SCALE,
        dividers: false,
      };
    }
  }
  // Coerce an unknown/removed pattern back to a valid member, and clamp a
  // crafted or out-of-range scale into [0, 1] so persisted data stays honest.
  const rawScale = wallPatternRaw.scale;
  const rawPattern = wallPatternRaw.pattern;
  const rawSides = wallPatternRaw.sides as Partial<WallPatternSides> | undefined;
  const wallPatternConfig: WallPatternConfig = {
    enabled: wallPatternRaw.enabled ?? false,
    pattern:
      typeof rawPattern === 'string' && VALID_WALL_PATTERNS.has(rawPattern as WallPatternType)
        ? (rawPattern as WallPatternType)
        : 'honeycomb',
    scale:
      typeof rawScale === 'number' && Number.isFinite(rawScale)
        ? Math.min(1, Math.max(0, rawScale))
        : DEFAULT_PATTERN_SCALE,
    dividers: wallPatternRaw.dividers === true,
    // Absent on every design saved, which patterned all four
    // walls — so a missing side reads as ON, not off.
    sides: {
      left: rawSides?.left !== false,
      right: rawSides?.right !== false,
      front: rawSides?.front !== false,
      back: rawSides?.back !== false,
    },
  };

  // Floor pattern — absent on every design saved before the feature.
  // Same coercion contract as the wall pattern: unknown members fall back to
  // the default and a crafted scale is clamped into [0, 1].
  const floorPatternConfig: FloorPatternConfig = (() => {
    const raw: Partial<FloorPatternConfig> = params.floorPattern ?? {};
    const rawScale = raw.scale;
    return {
      enabled: raw.enabled === true,
      pattern:
        raw.pattern !== undefined && VALID_FLOOR_PATTERNS.has(raw.pattern)
          ? raw.pattern
          : DEFAULT_FLOOR_PATTERN_CONFIG.pattern,
      scale:
        typeof rawScale === 'number' && Number.isFinite(rawScale)
          ? Math.min(1, Math.max(0, rawScale))
          : DEFAULT_PATTERN_SCALE,
    };
  })();

  // Migrate cutoutConfig and handle legacy per-cutout topOffset
  const rawCutoutConfig = (params.cutoutConfig as Partial<CutoutConfig> | undefined) ?? {};
  const rawFillReference = rawCutoutConfig.fillReference;
  const cutoutConfig: CutoutConfig = {
    ...DEFAULT_CUTOUT_CONFIG,
    ...rawCutoutConfig,
    // Coerce an unknown reference back to the default, the same way the handle
    // shape below does. The declared type is a claim about trusted data, so the
    // runtime check still matters: every load path (share, sync, localStorage)
    // lands here, and this is where a value the type no longer allows stops.
    fillReference:
      rawFillReference !== undefined && CUTOUT_FILL_REFERENCES.includes(rawFillReference)
        ? rawFillReference
        : DEFAULT_CUTOUT_CONFIG.fillReference,
    // The server bounds this on publish, but nothing bounds a design already
    // in localStorage or arriving over sync, and those never touch that path.
    // A string reaches the generator as `wallHeight - topOffset` = NaN, which
    // drops every cutout silently, and breaks the slider on the way. Clamped
    // only against zero and a sane ceiling: the wall height is not known here,
    // and the control and `cutoutFillHeightMm` both clamp against the real one.
    topOffset: clampNumber(
      rawCutoutConfig.topOffset,
      0,
      MAX_CUTOUT_TOP_OFFSET_MM,
      DEFAULT_CUTOUT_CONFIG.topOffset
    ),
  };

  // Migrate handle config (v2: ledges → holes)
  // Strip legacy ledge fields (depth, filletRadius) to prevent storage pollution
  const rawHandles = (params.handles ?? {}) as Record<string, unknown>;
  const { depth: _legacyDepth, filletRadius: _legacyFillet, ...cleanHandles } = rawHandles;
  const handlesConfig: HandleConfig = {
    ...DEFAULT_HANDLE_CONFIG,
    ...(cleanHandles as Partial<HandleConfig>),
    // Coerce removed/unknown shapes (e.g. the retired 'u-shape') back to the
    // default so old saves don't carry a value the type no longer allows.
    shape: VALID_HANDLE_SHAPES.includes(cleanHandles.shape as HandleCutoutShape)
      ? (cleanHandles.shape as HandleCutoutShape)
      : DEFAULT_HANDLE_CONFIG.shape,
    front: { ...DEFAULT_HANDLE_CONFIG.front, ...((rawHandles.front as object | undefined) ?? {}) },
    back: { ...DEFAULT_HANDLE_CONFIG.back, ...((rawHandles.back as object | undefined) ?? {}) },
    left: { ...DEFAULT_HANDLE_CONFIG.left, ...((rawHandles.left as object | undefined) ?? {}) },
    right: { ...DEFAULT_HANDLE_CONFIG.right, ...((rawHandles.right as object | undefined) ?? {}) },
  };

  // Remove legacy and already-handled fields from spread
  const {
    dividers: _legacyDividers,
    eco: _legacyEco,
    handles: _handlesHandled,
    slide: _slideHandled,
    ...rest
  } = params as Record<string, unknown>;

  // Designs predating the sliding tray have no `slide` at all, and one saved
  // mid-feature may be missing individual fields; both re-complete from the
  // default rather than reaching the generator half-formed.
  const slideConfig: SlideConfig = {
    ...DEFAULT_SLIDE_CONFIG,
    ...((params.slide as Partial<SlideConfig> | undefined) ?? {}),
    railMount: SLIDE_RAIL_MOUNTS.includes(
      (params.slide as Partial<SlideConfig> | undefined)?.railMount as SlideRailMount
    )
      ? ((params.slide as Partial<SlideConfig>).railMount as SlideRailMount)
      : DEFAULT_SLIDE_CONFIG.railMount,
  };

  // Wall top (height units × mm/unit, plus any exterior-wall collar), matching
  // the top-accent slider cap in the Colors panel. Used to clamp a persisted
  // band on load. `Number.isFinite` guards reject NaN from crafted/corrupt data
  // (a bare `typeof === 'number'` lets NaN through and would poison the clamp).
  const finiteNum = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const heightUnits = finiteNum(params.height, DEFAULT_BIN_PARAMS.height);
  const heightUnitMm = finiteNum(params.heightUnitMm, DEFAULT_BIN_PARAMS.heightUnitMm);
  // Use the SAME normalized collar the returned params carry (clamped to
  // [MIN, MAX]) so the accent cap can't exceed the bin's real post-migration
  // wall top when a persisted collar is out of range.
  const wallHeightMm = Math.max(
    1,
    heightUnits * heightUnitMm + migrateExtraWallHeightMm(params.extraWallHeightMm)
  );

  // A mesh cutout without its asset can't generate anything — drop orphans
  // (crafted/corrupt designs) instead of erroring downstream; symmetrically,
  // drop assets no cutout references so they can't ride along via `...rest`
  // and bloat the design forever.
  const migratedCutouts = shareGroupArrays(
    normalizeGroupChains(
      (params.cutouts ?? DEFAULT_BIN_PARAMS.cutouts).map((c) =>
        migrateCutout(c as Cutout & LegacyCutoutFields)
      )
    )
  ).filter(
    (c) =>
      c.shape !== 'mesh' || (c.meshId !== undefined && params.meshAssets?.[c.meshId] !== undefined)
  );
  // Hoisted out of the `lid` block below so the group-name sweep can see BOTH
  // cutout arrays — one name map serves the bin and its lid.
  const migratedLidCutouts = migrateLidCutouts(
    (params.lid as { cutouts?: unknown } | undefined)?.cutouts
  );
  const referencedMeshIds = new Set(
    migratedCutouts.filter((c) => c.shape === 'mesh').map((c) => c.meshId)
  );
  const migratedMeshAssets = params.meshAssets
    ? Object.fromEntries(
        Object.entries(params.meshAssets).filter(([id]) => referencedMeshIds.has(id))
      )
    : undefined;

  return {
    ...DEFAULT_BIN_PARAMS,
    ...rest,
    style,
    base: baseConfig,
    compartments: compartmentsConfig,
    scoop: scoopConfig,
    label: { ...DEFAULT_BIN_PARAMS.label, ...(params.label ?? {}) },
    walls: wallsConfig,
    slide: slideConfig,
    handles: handlesConfig,
    slotConfig,
    dividerPieces,
    inserts: params.inserts ?? DEFAULT_BIN_PARAMS.inserts,
    cutouts: migratedCutouts,
    ...(migratedMeshAssets && Object.keys(migratedMeshAssets).length > 0
      ? { meshAssets: migratedMeshAssets }
      : { meshAssets: undefined }),
    cutoutGroupNames: migrateCutoutGroupNames(
      params.cutoutGroupNames,
      referencedGroupIds(migratedCutouts, migratedLidCutouts ?? [])
    ),
    cutoutConfig,
    wallPattern: wallPatternConfig,
    floorPattern: floorPatternConfig,
    featureColors: migrateFeatureColors(params.featureColors, wallHeightMm),
    lid: (() => {
      // Strip locked-down legacy fields (`fit`, `wallThickness`,
      // `topThickness`) from persisted designs — they're hardcoded in
      // `lidConstants.ts` now and re-spreading them would put unknown
      // properties back onto the typed config.
      const raw = (params.lid as Record<string, unknown> | undefined) ?? {};
      const {
        fit: _legacyFit,
        wallThickness: _legacyWall,
        topThickness: _legacyTop,
        attachment: rawAttachment,
        clickRails: rawClickRails,
        clickRailCoverage: rawCoverage,
        extraHeightMm: rawExtraHeight,
        topThicknessMm: rawTopThickness,
        retentionMagnet: rawRetentionMagnet,
        tray: rawTray,
        grip: rawGrip,
        relieveInterior: rawRelieveInterior,
        slide: rawSlide,
        hinge: rawHinge,
        cutouts: _rawLidCutouts,
        ...stored
      } = raw;
      // Rails migrate first — `attachment` derives from them for legacy
      // designs that predate the mode field.
      const clickRails = migrateClickRails(rawClickRails);
      return {
        ...DEFAULT_LID_CONFIG,
        ...(stored as Partial<LidConfig>),
        // `clickRails` evolved from boolean → per-side object. Always
        // route through the migrator so the field is the right shape
        // regardless of how it was persisted.
        clickRails,
        clickRailCoverage: migrateClickRailCoverage(rawCoverage),
        // Retention mode. Legacy designs infer it from their rails.
        attachment: migrateAttachment(rawAttachment, clickRails),
        // Clamp the mm cavity boost so a corrupt design can't blow up the lid.
        extraHeightMm: migrateExtraHeightMm(rawExtraHeight),
        // Older designs have no floor-plate knob — they fall back to the
        // 0.8mm baseline and so regenerate byte-identically.
        topThicknessMm: clampNumber(
          rawTopThickness,
          LID_TOP_THICKNESS_MIN_MM,
          LID_TOP_THICKNESS_MAX_MM,
          DEFAULT_LID_CONFIG.topThicknessMm
        ),
        // Dedicated magnet + tray configs — clamped so a hand-edited share
        // can't drive runaway pocket/recess geometry.
        retentionMagnet: migrateRetentionMagnet(rawRetentionMagnet),
        tray: migrateTray(rawTray),
        grip: migrateGrip(rawGrip),
        // Absent means the design predates the interior relief, and it
        // must keep the geometry it was published with. Only an explicit
        // `true` opts in, which is what a design created after the flag stores.
        // NOT left to the `DEFAULT_LID_CONFIG` spread above: that defaults it
        // on, which is right for a new design and wrong for every old one.
        relieveInterior: rawRelieveInterior === true,
        slide: migrateSlide(rawSlide),
        hinge: migrateHinge(rawHinge),
        // Spread `undefined` deliberately: the key is present-but-undefined here,
        // which `stableStringify` and `JSON.stringify` both drop.
        cutouts: migratedLidCutouts,
      };
    })(),
    ...(params.splitConnectors !== undefined
      ? { splitConnectors: { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, ...params.splitConnectors } }
      : {}),
    textDefaults: {
      ...DEFAULT_TEXT_STYLE_DEFAULTS,
      ...((params as { textDefaults?: Partial<TextStyleDefaults> }).textDefaults ?? {}),
    },
    // `...rest` carried the raw value through; this overrides it with the
    // normalized form (or strips it entirely when empty/invalid).
    surfaceText: migrateSurfaceText(params.surfaceText),
    // Same contract as surfaceText: normalized or stripped, never raw.
    knifeRest: migrateKnifeRest(params.knifeRest),
    // Clamp the exterior-wall collar so a corrupt design can't drive a runaway
    // box/lip height. `...rest` carried the raw value through; this overrides it.
    extraWallHeightMm: migrateExtraWallHeightMm(
      (rest as Record<string, unknown>).extraWallHeightMm
    ),
  };
}

/**
 * Per-design geometry keys that are NOT carried into a user's custom
 * "default for new bins". These describe a *specific* bin, not a reusable
 * style, so they reset to the factory baseline on every new design.
 *
 * Implemented as a denylist (rather than an allowlist of style keys) so
 * that future style parameters added to `BinParams` automatically flow
 * into saved user defaults without anyone remembering to update a list.
 *
 * `migrateParams()` backfills each of these from `DEFAULT_BIN_PARAMS` when a
 * stored partial is loaded, so stripping them is a safe reset-to-factory.
 */
export const STYLE_DEFAULT_OMIT_KEYS = [
  'cellMask',
  'compartments',
  'cutouts',
  // Surface text is a per-design label ("Cables"), not a reusable style —
  // carrying it into "default for new bins" would stamp one design's label
  // onto every subsequent design.
  'surfaceText',
  // Mesh imprint assets are per-design geometry AND large (100KB+ compressed
  // STL data) — carrying them into "default for new bins" would bloat every
  // subsequent design.
  'meshAssets',
  // A handle rest belongs to one block's knives, not to a reusable style.
  'knifeRest',
  'inserts',
  'handles',
  'walls',
  'overhang',
  // Per-design UI bookkeeping, not a reusable style: a manual edge choice on
  // one design must not carry into every new design and mute mismatch warnings.
  'fractionalEdgeManualX',
  'fractionalEdgeManualY',
] as const satisfies readonly (keyof BinParams)[];

/**
 * Extract the style/feature preferences from a full set of bin params,
 * dropping per-design geometry (see `STYLE_DEFAULT_OMIT_KEYS`). The result
 * is a partial suitable for persisting as the user's default for new bins;
 * `migrateParams()` re-completes it on load.
 */
export function extractStyleDefaults(params: BinParams): Partial<BinParams> {
  const omit = new Set<string>(STYLE_DEFAULT_OMIT_KEYS);
  return Object.fromEntries(Object.entries(params).filter(([key]) => !omit.has(key)));
}
