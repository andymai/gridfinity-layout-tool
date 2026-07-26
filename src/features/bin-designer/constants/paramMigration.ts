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
  CutoutConfig,
  DividerPieceConfig,
  HandleConfig,
  SlotConfig,
  WallPatternConfig,
  FloorPatternConfig,
  Cutout,
  HandleCutoutShape,
  WallCutout,
  WallConfig,
  WallCutoutShape,
} from '../types';
import { DEFAULT_PATTERN_SCALE } from '../types';
import type { FeatureColorConfig, LipAxisCount, TopAccentConfig } from '../types/featureColors';
import { makeUniformLipCells, LIP_CELL_ZONES } from '../types/featureColors';
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
} from '../types/lid';
import type {
  LidClickRails,
  LidAttachment,
  LidConfig,
  LidMagnetConfig,
  LidTrayConfig,
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
  WALL_TEXT_ALIGNS,
  WALL_TEXT_SIDES,
} from '../types/text';
import type { TextStyleDefaults } from '../types/text';
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
  front?: number | Partial<WallCutout>;
  back?: number | Partial<WallCutout>;
  left?: number | Partial<WallCutout>;
  right?: number | Partial<WallCutout>;
  interior?: Partial<WallCutout>;
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
        return inferEnabled({
          ...defaults.front,
          ...val,
        });
      }
      return defaults.front;
    };
    const front = toWallCutout(raw.front);
    const back = toWallCutout(raw.back);
    const left = toWallCutout(raw.left);
    const right = toWallCutout(raw.right);
    const interior = raw.interior
      ? inferEnabled({
          ...defaults.interior,
          ...raw.interior,
        })
      : defaults.interior;
    const anySideEnabled =
      front.enabled || back.enabled || left.enabled || right.enabled || interior.enabled;
    return {
      enabled: anySideEnabled,
      shape: defaults.shape,
      width: defaults.width,
      depth: defaults.depth,
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
      return inferEnabled(merged);
    }
    return merged;
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
 * `attachment`; pre-#2694 designs predate the field, so derive it from the
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
    // Whole number of edge magnets per long edge (#2844). Legacy-absent →
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
  topAccent?: { enabled?: unknown; heightMm?: unknown; color?: unknown };
}

/** Coerce a persisted top-accent value (any era) into a full config, backfilling
 *  from the default when a field is missing or the wrong type. */
function migrateTopAccent(
  raw: LegacyFeatureColorInput['topAccent'],
  body: string,
  maxHeightMm: number
): TopAccentConfig {
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
    // rolled-back single picker already produced; discussion #1654).
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
  const topAccent = migrateTopAccent(raw.topAccent, body, maxTopAccentMm);

  // Pre-`enabled` design counts as multi-color if body or any zone diverges
  // from the default — zone editors only existed behind the old Labs flag, so
  // any customized color implies multi-color intent.
  const bodyLower = body.toLowerCase();
  const isCustom = (c: string): boolean => c.toLowerCase() !== bodyLower;
  const hasCustomColor =
    bodyLower !== DEFAULT_FEATURE_COLOR_CONFIG.body.toLowerCase() ||
    [labelTab, base, scoop, dividers, text, lid].some(isCustom) ||
    LIP_CELL_ZONES.some((id) => isCustom(lip.cells[id] ?? body)) ||
    (topAccent.enabled && isCustom(topAccent.color));

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
    topAccent,
  };
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

/** Input type for migrateParams — current params plus known legacy fields. */
type MigrateParamsInput = Partial<BinParams> & LegacyFields;

/**
 * Migrate a single cutout's legacy fields to current shape.
 *
 * Idempotent: re-running on an already-migrated cutout leaves W/D untouched.
 * Only copies legacy scoopRadius into both axes when neither axis is set.
 */
function migrateCutout(cutout: Cutout & LegacyCutoutFields): Cutout {
  const { scoopRadius, ...rest } = cutout;
  if (
    scoopRadius !== undefined &&
    rest.scoopRadiusW === undefined &&
    rest.scoopRadiusD === undefined
  ) {
    return { ...rest, scoopRadiusW: scoopRadius, scoopRadiusD: scoopRadius };
  }
  return rest;
}

/**
 * Normalize a persisted `surfaceText` value. Clamps the string to
 * `TEXT_MAX_LENGTH` and collapses empty/junk objects to `undefined` so
 * pre-feature designs (and designs whose text was cleared) serialize
 * byte-identically to before the field existed. The style override passes
 * through shape-checked only — field ranges are the share/sync validator's
 * job, matching how `label.textStyle` is handled.
 */
const MIGRATE_TEXT_FONTS: readonly TextFontFamily[] = [
  'atkinson',
  'jetbrains-mono',
  'allerta-stencil',
];
const MIGRATE_TEXT_MODES: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'];

/**
 * Sanitize a persisted surface-text style override field-by-field: unknown
 * keys drop, enums must match, numbers must be finite and in the same ranges
 * the share/sync validator enforces (`api/lib/designerValidation.ts`
 * `validateTextDefaults`). Locally persisted or imported designs bypass that
 * server mirror, and a malformed depth/size here would flow straight into the
 * BREP worker via `resolveLidInputs`.
 */
function migrateTextStyleOverride(raw: unknown): TextStyleOverride | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
  const depth = num(value.depth, 0, 10);
  const margin = num(value.margin, 0, 50);
  const minFontSize = num(value.minFontSize, 0.5, 100);
  const maxFontSize = num(value.maxFontSize, 0.5, 200);
  const fontSizeOverride = num(value.fontSizeOverride, 0.5, 200);
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
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

function migrateSurfaceText(raw: unknown): SurfaceTextConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { lidText, walls, wallAlign, style } = raw as {
    lidText?: unknown;
    walls?: unknown;
    wallAlign?: unknown;
    style?: unknown;
  };
  // Trimmed on write (store setters) — trim again here so the worker (which
  // trims before generating) and persisted state can't disagree.
  const text = typeof lidText === 'string' ? lidText.slice(0, TEXT_MAX_LENGTH).trim() : undefined;
  const hasText = text !== undefined && text !== '';

  // Per-wall strings: keep only known sides with non-empty values, clamped
  // and trimmed like the lid text.
  const migratedWalls: Partial<Record<WallTextSide, string>> = {};
  if (typeof walls === 'object' && walls !== null) {
    for (const side of WALL_TEXT_SIDES) {
      const value = (walls as Record<string, unknown>)[side];
      if (typeof value === 'string' && value.trim() !== '') {
        migratedWalls[side] = value.slice(0, TEXT_MAX_LENGTH).trim();
      }
    }
  }
  const hasWalls = Object.keys(migratedWalls).length > 0;

  // Alignment only means something while wall text exists; 'center' is the
  // implicit default, so it's dropped rather than persisted.
  const align =
    hasWalls &&
    typeof wallAlign === 'string' &&
    (WALL_TEXT_ALIGNS as readonly string[]).includes(wallAlign) &&
    wallAlign !== 'center'
      ? (wallAlign as WallTextVerticalAlign)
      : undefined;

  const migratedStyle = migrateTextStyleOverride(style);
  if (!hasText && !hasWalls && migratedStyle === undefined) return undefined;
  return {
    ...(hasText ? { lidText: text } : {}),
    ...(hasWalls ? { walls: migratedWalls } : {}),
    ...(align !== undefined ? { wallAlign: align } : {}),
    ...(migratedStyle !== undefined ? { style: migratedStyle } : {}),
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
    compartmentsConfig = { ...DEFAULT_BIN_PARAMS.compartments, ...params.compartments };
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
  const baseConfig = { ...DEFAULT_BIN_PARAMS.base, ...(params.base ?? {}) };
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
  // Fresh object each time — avoid returning shared DEFAULT_WALL_PATTERN_CONFIG reference
  let wallPatternConfig: WallPatternConfig = {
    enabled: false,
    pattern: 'honeycomb',
    scale: DEFAULT_PATTERN_SCALE,
    dividers: false,
  };
  if (params.wallPattern !== undefined) {
    wallPatternConfig = { ...wallPatternConfig, ...params.wallPattern };
  } else if (params.eco !== undefined) {
    const honeycombWall = params.eco.honeycombWall;
    if (honeycombWall) {
      wallPatternConfig = {
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
  {
    const rawScale = wallPatternConfig.scale;
    wallPatternConfig = {
      ...wallPatternConfig,
      pattern: VALID_WALL_PATTERNS.has(wallPatternConfig.pattern)
        ? wallPatternConfig.pattern
        : 'honeycomb',
      scale:
        typeof rawScale === 'number' && Number.isFinite(rawScale)
          ? Math.min(1, Math.max(0, rawScale))
          : DEFAULT_PATTERN_SCALE,
      dividers: wallPatternConfig.dividers === true,
    };
  }

  // Floor pattern (#2816) — absent on every design saved before the feature.
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
  const cutoutConfig: CutoutConfig = {
    ...DEFAULT_CUTOUT_CONFIG,
    ...((params.cutoutConfig as Partial<CutoutConfig> | undefined) ?? {}),
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
    ...rest
  } = params as Record<string, unknown>;

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
  const migratedCutouts = (params.cutouts ?? DEFAULT_BIN_PARAMS.cutouts)
    .map((c) => migrateCutout(c as Cutout & LegacyCutoutFields))
    .filter(
      (c) =>
        c.shape !== 'mesh' ||
        (c.meshId !== undefined && params.meshAssets?.[c.meshId] !== undefined)
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
    handles: handlesConfig,
    slotConfig,
    dividerPieces,
    inserts: params.inserts ?? DEFAULT_BIN_PARAMS.inserts,
    cutouts: migratedCutouts,
    ...(migratedMeshAssets && Object.keys(migratedMeshAssets).length > 0
      ? { meshAssets: migratedMeshAssets }
      : { meshAssets: undefined }),
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
        // Retention mode (#2694). Legacy designs infer it from their rails.
        attachment: migrateAttachment(rawAttachment, clickRails),
        // Clamp the mm cavity boost so a corrupt design can't blow up the lid.
        extraHeightMm: migrateExtraHeightMm(rawExtraHeight),
        // Pre-#2761 designs have no floor-plate knob — they fall back to the
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
