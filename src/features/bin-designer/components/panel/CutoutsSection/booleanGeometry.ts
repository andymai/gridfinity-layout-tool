/**
 * 2D pathfinder boolean ops on cutout shapes for the editor preview.
 *
 * Mirrors the worker's `combineGroupSolids` semantics in 2D space so the
 * editor can render the same result the BREP pipeline will produce, without
 * waiting for a worker round-trip. The worker remains authoritative — this
 * module is purely visual.
 *
 * Coordinate system: mm, Y-up, origin at the bin interior's bottom-left
 * corner (same frame as `Cutout.x` / `Cutout.y` and `PathPoint.x` /
 * `PathPoint.y`). Polygon-clipping doesn't care about winding for boolean
 * ops on simple polygons, but we keep CCW outer rings + CW holes so the
 * three.js `Shape` consumer can interpret holes correctly.
 */

import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import type { Cutout, GroupOp } from '@/features/bin-designer/types';
import { DEFAULT_GROUP_OP } from '@/features/bin-designer/types';
import { cutoutOutlineRing } from '@/shared/utils/cutoutOutline';

/**
 * Convert a cutout to a polygon-clipping `Polygon` (single outer ring,
 * no holes). Returns `null` for cutouts that are too degenerate to outline.
 * The ring itself comes from `@/shared/utils/cutoutOutline`, which the worker
 * and the lip-gap plan sample too, so a group's preview and its open-side
 * channels measure the same shape.
 */
export function cutoutToPolygon(c: Cutout): Polygon | null {
  const ring = cutoutOutlineRing(c);
  return ring ? [ring] : null;
}

/**
 * Apply the pathfinder boolean op across a group's members.
 *
 *  - `union` fuses every member.
 *  - `subtract` carves the union of all but the top z-indexed member out
 *    using that top member as the cutter (Illustrator "Minus Front").
 *  - `intersect` keeps only the region common to every member.
 *  - `exclude` returns XOR (union minus intersection).
 *
 * Returns `null` when the result is empty (e.g. Intersect with no overlap)
 * so callers can show a "no result" hint instead of silently rendering
 * nothing. Members that fail to outline are skipped, never block the op.
 */
export function applyGroupOp(
  members: readonly Cutout[],
  op: GroupOp = DEFAULT_GROUP_OP
): MultiPolygon | null {
  const polygons = members
    .map((c) => ({ cutout: c, polygon: cutoutToPolygon(c) }))
    .filter((e): e is { cutout: Cutout; polygon: Polygon } => e.polygon !== null);

  if (polygons.length === 0) return null;
  if (polygons.length === 1) return [polygons[0].polygon];

  const allPolys = polygons.map((e) => e.polygon);
  const [first, ...rest] = allPolys;

  switch (op) {
    case 'union': {
      const result = polygonClipping.union(first, ...rest);
      return result.length > 0 ? result : null;
    }
    case 'intersect': {
      const result = polygonClipping.intersection(first, ...rest);
      return result.length > 0 ? result : null;
    }
    case 'exclude': {
      // The worker computes Exclude as `union − intersection` ("in some but
      // not all"). For 2 members that matches `xor` (symmetric difference)
      // exactly, but for 3+ members it diverges: a region present in two
      // members but not the third is part of `union − intersection` yet
      // disappears under `xor` (which keeps only odd-count regions).
      // Mirror the worker so the 2D preview agrees with the exported mesh.
      const unionResult = polygonClipping.union(first, ...rest);
      const intersectionResult = polygonClipping.intersection(first, ...rest);
      if (intersectionResult.length === 0) {
        return unionResult.length > 0 ? unionResult : null;
      }
      const result = polygonClipping.difference(unionResult, intersectionResult);
      return result.length > 0 ? result : null;
    }
    case 'subtract': {
      // Top z-index is the cutter; everything else is the base. Stable tie
      // break on array order so swapping two equal-z members doesn't flip the
      // result. Matches the worker's `combineGroupSolids` ordering.
      const indexed = polygons.map((e, i) => ({ ...e, i }));
      indexed.sort((a, b) => {
        const za = a.cutout.zIndex ?? 0;
        const zb = b.cutout.zIndex ?? 0;
        if (za !== zb) return zb - za;
        return b.i - a.i;
      });
      const cutter = indexed[0].polygon;
      const basePolys = indexed.slice(1).map((e) => e.polygon);
      if (basePolys.length === 0) return null;
      const base =
        basePolys.length === 1
          ? basePolys[0]
          : polygonClipping.union(basePolys[0], ...basePolys.slice(1));
      const result = polygonClipping.difference(base, cutter);
      return result.length > 0 ? result : null;
    }
  }
}

export type { MultiPolygon, Polygon, Ring };
