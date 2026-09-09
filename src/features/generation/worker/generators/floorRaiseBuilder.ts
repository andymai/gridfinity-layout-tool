/**
 * Raised compartment floors: a solid slab under a compartment that lifts its
 * floor toward the rim, so a short item in a deep bin sits where a hand can
 * reach it while its neighbours keep the full depth.
 *
 * Built as one box per cell of the compartment, grown a fraction into the
 * walls and dividers around it and into the floor below, so every fuse
 * overlaps real volume rather than meeting on a face; a compartment of any
 * outline is then its cells fused together. A compartment with a tilted
 * divider is skipped: its cavity is a trapezoid the cell boxes would cross.
 */

import { box, clone, fuseAll, unwrap, withScope } from 'brepjs';
import type { DisposalScope, Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import {
  MAX_COMPARTMENT_FLOOR_RAISE_MM,
  MIN_RAISED_CAVITY_MM,
  compartmentHasTiltedEdge,
  isNestingBase,
} from '@/shared/types/bin';
import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, compactKey, quantize, stableSerialize } from './cacheKeyUtils';

/** Growth (mm) into the surrounding walls, dividers and floor. */
const FUSE_OVERLAP_MM = 0.2;

/**
 * Each compartment's raise, clamped so {@link MIN_RAISED_CAVITY_MM} of pocket
 * survives above it. Compartments with no raise, or a tilted edge, are absent.
 */
export function resolveFloorRaises(
  params: BinParams,
  floorZ: number,
  interiorHeight: number
): Map<number, number> {
  const out = new Map<number, number>();
  const raises = params.compartments.floorRaises;
  if (!raises) return out;
  const ceiling = Math.min(
    MAX_COMPARTMENT_FLOOR_RAISE_MM,
    interiorHeight - floorZ - MIN_RAISED_CAVITY_MM
  );
  if (ceiling <= 0) return out;
  const ids = new Set(params.compartments.cells);
  raises.forEach((raise, id) => {
    if (typeof raise !== 'number' || !Number.isFinite(raise) || raise <= 0) return;
    if (!ids.has(id) || compartmentHasTiltedEdge(params.compartments, id)) return;
    out.set(id, Math.min(raise, ceiling));
  });
  return out;
}

export function hasAnyFloorRaise(params: BinParams): boolean {
  return (params.compartments.floorRaises ?? []).some((r) => typeof r === 'number' && r > 0);
}

/**
 * Every raised slab fused into one solid, in cavity-centred coordinates with
 * the box bottom at Z=0. Caller owns the result.
 */
export function buildFloorRaises(
  params: BinParams,
  innerW: number,
  innerD: number,
  floorZ: number,
  interiorHeight: number
): Shape3D | null {
  const raises = resolveFloorRaises(params, floorZ, interiorHeight);
  if (raises.size === 0) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const { cols, rows, cells, thickness } = params.compartments;
    const cellW = innerW / cols;
    const cellD = innerD / rows;
    const half = thickness / 2;
    const idAt = (col: number, row: number): number => cells[row * cols + col];
    const z0 = floorZ - Math.min(FUSE_OVERLAP_MM, floorZ / 2);
    const slabs: Shape3D[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = idAt(col, row);
        const raise = raises.get(id);
        if (raise === undefined) continue;
        // Half a divider in where a different compartment is next door, then
        // out by the overlap on every side.
        const x0 =
          -innerW / 2 +
          col * cellW +
          (col > 0 && idAt(col - 1, row) !== id ? half : 0) -
          FUSE_OVERLAP_MM;
        const x1 =
          -innerW / 2 +
          (col + 1) * cellW -
          (col < cols - 1 && idAt(col + 1, row) !== id ? half : 0) +
          FUSE_OVERLAP_MM;
        const y0 =
          -innerD / 2 +
          row * cellD +
          (row > 0 && idAt(col, row - 1) !== id ? half : 0) -
          FUSE_OVERLAP_MM;
        const y1 =
          -innerD / 2 +
          (row + 1) * cellD -
          (row < rows - 1 && idAt(col, row + 1) !== id ? half : 0) +
          FUSE_OVERLAP_MM;
        const height = floorZ + raise - z0;
        slabs.push(
          scope.register(
            box(x1 - x0, y1 - y0, height, {
              at: [(x0 + x1) / 2, (y0 + y1) / 2, z0 + height / 2],
            })
          )
        );
      }
    }
    if (slabs.length === 0) return null;
    const fused =
      slabs.length === 1 ? slabs[0] : scope.register(unwrap(fuseAll(slabs as ValidSolid[])));
    return unwrap(clone(fused));
  });
}

export const floorRaiseFeature: FeatureBuilder = {
  name: 'floorRaises',
  tag: FeatureTag.BASE,
  target: 'fuse',
  // Needs a floor to stand on and compartments to stand in: the open-floor
  // lite mode and the Nesting body both replace the floor this is measured
  // from, and slotted or solid interiors have no compartment grid.
  shouldBuild: (ctx) =>
    ctx.params.style === 'standard' &&
    !ctx.dimensions.solid &&
    !ctx.dimensions.isSlotted &&
    !ctx.dimensions.liteFloorOpen &&
    !isNestingBase(ctx.params.base) &&
    hasAnyFloorRaise(ctx.params),
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v1',
        dim.shellKey,
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.floorThickness),
        quantize(dim.interiorHeight),
        quantize(params.compartments.thickness),
        params.compartments.cols,
        params.compartments.rows,
        params.compartments.cells.join(','),
        stableSerialize(params.compartments.floorRaises ?? []),
        stableSerialize(params.compartments.dividerOverrides ?? [])
      )
    );
  },
  build: (ctx) => {
    const slab = buildFloorRaises(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.floorThickness,
      ctx.dimensions.interiorHeight
    );
    return slab ? [slab] : null;
  },
};
