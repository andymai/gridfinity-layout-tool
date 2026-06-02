/**
 * Backward-compat migration for the `walls` parameter.
 *
 * The wall config has been through two storage formats: an early one where
 * each side was a bare number (cutout depth) and the current one where each
 * side is a {@link WallCutout} object. This isolates that branching so
 * `migrateParams` stays readable. Dependencies (`defaults`, `disabledCutout`)
 * are passed in rather than imported so this module never has to reach back
 * into `defaults.ts`.
 */

import type { WallConfig, WallCutout, WallCutoutShape } from '../types';

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
