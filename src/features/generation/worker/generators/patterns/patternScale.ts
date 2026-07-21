/**
 * Shared scale model for wall patterns.
 *
 * A single normalized `scale` in [0, 1] drives every pattern's element size.
 * The mapping is MULTIPLICATIVE around each pattern's size-adaptive base:
 *
 *   size = adaptiveBase(binHeight) × factor(scale)
 *
 * `factor(0.5) === 1`, so the neutral default reproduces each pattern's legacy
 * size exactly (honeycomb output — and its geometry snapshots — stay identical
 * at rest). The slider then scales symmetrically: finer to the left, bolder to
 * the right.
 *
 * Pure-math module — no brepjs imports.
 */

/** Solid web thickness between adjacent elements (mm). Fixed by design so the
 *  structural backbone never thins to fragile lace as elements scale. */
export const PATTERN_WEB_THICKNESS = 0.8;

/** Clamp an untrusted scale to [0, 1]; NaN falls back to neutral, ±Infinity to the bounds. */
export function clampScale(scale: number): number {
  if (Number.isNaN(scale)) return 0.5;
  return Math.min(1, Math.max(0, scale));
}

/**
 * Map normalized scale to a multiplicative size factor.
 *   scale 0   → 0.6× (finest)
 *   scale 0.5 → 1.0× (neutral — matches legacy size)
 *   scale 1   → 1.4× (boldest)
 */
export function scaleFactor(scale: number): number {
  return 0.6 + 0.8 * clampScale(scale);
}

/**
 * Minimum element circumradius (mm), scaled up on taller bins so a fine scale
 * on a large wall can't explode the element count past the preview timeout.
 * `binHeight` is in grid height-units.
 */
export function elementRadiusFloor(binHeight: number): number {
  if (binHeight >= 6) return 2.0;
  if (binHeight >= 4) return 1.5;
  return 1.0;
}

/**
 * Resolve a scaled element size from an adaptive base, applying the size-aware
 * floor. Shared by every stamp calculator.
 */
export function resolveElementRadius(base: number, binHeight: number, scale: number): number {
  return Math.max(base * scaleFactor(scale), elementRadiusFloor(binHeight));
}
