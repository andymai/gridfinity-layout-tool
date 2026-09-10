/** Migration of persisted wall settings: legacy wall configs, click rails, extra wall height. */

import type { WallCutout, WallConfig, WallCutoutShape } from '../types';
import { DEFAULT_LID_CONFIG, LID_CLICK_RAIL_COVERAGE_OPTIONS } from '../types/lid';
import type { LidClickRails } from '../types/lid';
import { MAX_CUTOUT_CORNER_RADIUS } from '@/shared/utils/wallCutoutPosition';
import { DESIGNER_CONSTRAINTS } from './gridfinity';

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
export function migrateClickRails(raw: unknown): LidClickRails {
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
export function migrateClickRailCoverage(raw: unknown): number {
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
 * Legacy wallPattern config where `dividers`/`sides` may hold a stray
 * non-boolean/non-object value from an older or hand-crafted save — the
 * migration below (`wallPatternConfig.dividers === true`, the `sides`
 * clamp) coerces whatever lands here back to a valid shape.
 */
export interface LegacyWallPatternConfig {
  enabled?: boolean;
  pattern?: string;
  scale?: number;
  webThickness?: unknown;
  dividers?: unknown;
  sides?: unknown;
}

/**
 * Clamp a persisted top-level `extraWallHeightMm` (the exterior-wall collar)
 * into its valid range. Non-numeric or legacy-absent values default to 0 (no
 * collar); out-of-range values are clamped so a corrupt/hand-edited design
 * can't feed a runaway wall height into the box + lip geometry.
 */
export function migrateExtraWallHeightMm(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.min(
    DESIGNER_CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT,
    Math.max(DESIGNER_CONSTRAINTS.MIN_EXTRA_WALL_HEIGHT, raw)
  );
}
