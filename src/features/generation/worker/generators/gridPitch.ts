/**
 * Anisotropic grid-pitch helpers.
 *
 * A Gridfinity grid is square by default (one `gridUnitMm`, e.g. 42mm, in both
 * axes). The bin designer can opt into a *non-square* grid — a different pitch
 * per axis (e.g. 42×22) — to fill a drawer that isn't an exact multiple of
 * 42mm. Only the cell *pitch* stretches; round features (corner radii,
 * magnet/screw holes, wall thickness, lip cross-section) stay isotropic.
 *
 * The generators historically threaded a single scalar `gridUnitMm` for both
 * axes. To stay backward-compatible, every builder that needs the pitch now
 * accepts a {@link GridUnitInput} — either the legacy scalar (⇒ square) or an
 * explicit {@link GridPitch}. Normalize at the top of each function with
 * {@link resolvePitch}, then use `.x` for width/columns and `.y` for
 * depth/rows. A scalar argument reproduces the pre-anisotropy behaviour
 * byte-for-byte.
 */

import { SIZE } from './generatorConstants';

/** Per-axis grid cell pitch in mm: `x` scales width/columns, `y` scales depth/rows. */
export interface GridPitch {
  readonly x: number;
  readonly y: number;
}

/** A grid unit given as either a square scalar (mm) or an explicit per-axis pitch. */
export type GridUnitInput = number | GridPitch;

/**
 * Normalize a scalar-or-pitch into an explicit `{x, y}`. A `number` (or
 * `undefined`) yields a square pitch, so legacy scalar call sites are
 * unaffected.
 */
export function resolvePitch(input: GridUnitInput | undefined, fallback: number = SIZE): GridPitch {
  if (input === undefined) return { x: fallback, y: fallback };
  return typeof input === 'number' ? { x: input, y: input } : { x: input.x, y: input.y };
}

/** True when the pitch differs between axes (non-square grid). */
export function isAnisotropicPitch(input: GridUnitInput | undefined): boolean {
  const p = resolvePitch(input);
  return p.x !== p.y;
}

/**
 * Resolve a bin's grid pitch from its params: `gridUnitMm` is the X pitch and
 * `gridUnitMmY ?? gridUnitMm` is the Y pitch. Mirrors the `?? SIZE` fallback
 * the generators use for designs serialized before `gridUnitMm` existed.
 */
export function pitchFromParams(params: {
  readonly gridUnitMm?: number;
  readonly gridUnitMmY?: number;
}): GridPitch {
  const x = params.gridUnitMm ?? SIZE;
  const y = params.gridUnitMmY ?? x;
  return { x, y };
}

/**
 * Cache-key segments for the Y pitch: empty for a square grid (so square keys
 * stay byte-identical to the pre-anisotropy format), otherwise a single
 * `gy:<quantized>` segment. Spread into a {@link buildCacheKey} arg list right
 * after the X pitch, mirroring the `frac:` segment convention.
 */
export function pitchKeySegments(
  pitch: GridPitch,
  quantize: (n: number) => number | string
): string[] {
  return pitch.x === pitch.y ? [] : [`gy:${quantize(pitch.y)}`];
}
