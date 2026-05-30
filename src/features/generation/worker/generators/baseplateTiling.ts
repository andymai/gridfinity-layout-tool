/**
 * Over-tile resolution for baseplates.
 *
 * Standard baseplates center an integer grid in the drawer and surround it with
 * a solid plastic padding margin. "Over-tile" mode instead fills that margin
 * with functional Gridfinity grid: the leftover space on each axis becomes a
 * single clipped (fractional) tile placed on the `fractionalEdge` anchor.
 *
 * Sliver rule: if a leftover would be smaller than {@link MIN_OVERTILE_TILE_MM}
 * — too small to print a usable pocket — that axis falls back to solid padding.
 *
 * The drawer span is unchanged either way (over-tile just redistributes the
 * padding into a tile), so the slab outline and offsets only ever depend on the
 * *effective* paddings this resolver returns.
 */

import type { BaseplateParams } from '@/shared/types/bin';
import { MIN_PRINTABLE_TILE_MM } from './generatorConstants';

/**
 * Smallest printable clipped tile, in mm. Below this the pocket walls get too
 * thin/short to be useful, so the axis keeps solid padding instead. Shares the
 * project-wide printable-tile floor so it can't drift from the bin foot rule.
 */
export const MIN_OVERTILE_TILE_MM = MIN_PRINTABLE_TILE_MM;

const EPS = 1e-9;

/** Resolved per-axis + per-side tiling used to drive the baseplate build. */
export interface BaseplateTiling {
  /** Grid units along X to decompose (fractional when the X axis is over-tiled). */
  readonly unitsX: number;
  /** Grid units along Y to decompose (fractional when the Y axis is over-tiled). */
  readonly unitsY: number;
  readonly padLeft: number;
  readonly padRight: number;
  readonly padFront: number;
  readonly padBack: number;
  /** True when either axis emits a clipped tile (drives `forEachCell` fractional mode). */
  readonly fractional: boolean;
  /** True when the X axis converted its padding into a clipped tile. */
  readonly overTiledX: boolean;
  /** True when the Y axis converted its padding into a clipped tile. */
  readonly overTiledY: boolean;
}

interface AxisTiling {
  readonly units: number;
  readonly padStart: number;
  readonly padEnd: number;
  readonly overTiled: boolean;
}

function resolveAxis(
  gridCount: number,
  padStart: number,
  padEnd: number,
  gridUnitMm: number,
  overTile: boolean,
  minTileMm: number
): AxisTiling {
  if (!overTile) {
    return { units: gridCount, padStart, padEnd, overTiled: false };
  }
  const spanMm = gridCount * gridUnitMm + padStart + padEnd;
  const units = spanMm / gridUnitMm;
  const fullTiles = Math.floor(units + EPS);
  const remainderMm = (units - fullTiles) * gridUnitMm;
  // A whole-unit leftover (remainder ~0, e.g. padding exactly = one grid unit)
  // tiles cleanly as full cells. Only a *fractional* leftover below the
  // printable threshold is an unprintable sliver → keep solid padding.
  if (remainderMm > EPS && remainderMm < minTileMm - EPS) {
    return { units: gridCount, padStart, padEnd, overTiled: false };
  }
  return { units, padStart: 0, padEnd: 0, overTiled: true };
}

/**
 * Resolve effective per-axis tiling for a baseplate. With over-tile off (or for
 * an axis whose leftover is a sliver) this is the identity: integer grid + the
 * given paddings.
 */
export function resolveBaseplateTiling(params: BaseplateParams): BaseplateTiling {
  const overTile = params.overTile ?? false;
  const x = resolveAxis(
    params.width,
    params.paddingLeft,
    params.paddingRight,
    params.gridUnitMm,
    overTile,
    MIN_OVERTILE_TILE_MM
  );
  const y = resolveAxis(
    params.depth,
    params.paddingFront,
    params.paddingBack,
    params.gridUnitMm,
    overTile,
    MIN_OVERTILE_TILE_MM
  );
  return {
    unitsX: x.units,
    unitsY: y.units,
    padLeft: x.padStart,
    padRight: x.padEnd,
    padFront: y.padStart,
    padBack: y.padEnd,
    fractional: x.overTiled || y.overTiled,
    overTiledX: x.overTiled,
    overTiledY: y.overTiled,
  };
}

/** Minimum fractional cell size in grid units, for `forEachCell`/`decomposeCells`. */
export function minFractionUnits(gridUnitMm: number): number {
  return MIN_OVERTILE_TILE_MM / gridUnitMm;
}
