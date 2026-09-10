/** The kumiko cutter for a flat wall slab. */

import { drawRoundedRectangle, rotate, translate, cutAll, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';

import type { KumikoLattice, KumikoSegment } from './patterns';
import { sketch } from './meshUtils';
import type { FlatSlab } from './kumikoPerimeter';
import {
  AXIS_EPSILON,
  SLAB_OVERLAP,
  maxStrutWidth,
  clipSegmentToURangePeriodic,
  extendSegment,
  strokeSegment,
  fillingPiecesForRange,
  strokeFootprint,
  partitionDisjoint,
} from './kumikoSegments';
import type { BoxedTool } from './kumikoSegments';

export function buildFlatSlabCutter(
  slab: FlatSlab,
  lattice: KumikoLattice,
  bandZ0: number,
  bandHeight: number,
  cutDepth: number,
  patternCenterZ: number,
  perimeter: number,
  windowA: number,
  windowB: number
): Shape3D | null {
  const w = lattice.strutWidth;
  const uA = windowA;
  const uB = windowB;
  const uCenter = (slab.u0 + slab.u1) / 2;
  const zCenter = bandZ0 + bandHeight / 2;
  const halfDepth = cutDepth / 2;
  // Struts pierce the slab in depth so no strut face is coplanar with it.
  const strutDepth = cutDepth + 2;

  // Struts partitioned by lattice family: tools within a family are parallel
  // and disjoint, so each family cut has zero tool-tool intersection work.
  const families: Shape3D[][] = [[], [], []];
  const familyOf = (seg: KumikoSegment): number => {
    const du = seg.b[0] - seg.a[0];
    const dz = seg.b[1] - seg.a[1];
    if (Math.abs(du) < AXIS_EPSILON) return 0;
    return dz > 0 === du > 0 ? 1 : 2;
  };
  let strutCount = 0;
  for (const seg of lattice.segments) {
    for (const clipped of clipSegmentToURangePeriodic(seg, uA - w, uB + w, perimeter)) {
      // z is band-local in the lattice; shift to absolute before centering.
      const absolute: KumikoSegment = {
        a: [clipped.a[0], clipped.a[1] + bandZ0],
        b: [clipped.b[0], clipped.b[1] + bandZ0],
      };
      const drawing = strokeSegment(extendSegment(absolute, w / 2), w, uCenter, zCenter);
      const prism = sketch(drawing, 'XY').extrude(strutDepth);
      families[familyOf(clipped)].push(translate(prism, [0, 0, -strutDepth / 2]));
      prism.delete();
      strutCount++;
    }
  }
  // Filling pieces ride as individual prisms, bucketed by `partitionDisjoint`
  // below. Prebuilt per-vertex stamp solids were tried and measured WORSE:
  // neighboring stamps overlap, and overlapping multi-prism tools cost more in
  // the cutAll than the extra prism count saves.
  const fillings: BoxedTool[] = [];
  const maxW = maxStrutWidth(lattice);
  for (const piece of fillingPiecesForRange(lattice, uA - maxW, uB + maxW, perimeter)) {
    const pw = piece.width ?? w;
    const absolute: KumikoSegment = {
      a: [piece.a[0], piece.a[1] + bandZ0],
      b: [piece.b[0], piece.b[1] + bandZ0],
      ...(piece.width === undefined ? {} : { width: piece.width }),
    };
    const extended = extendSegment(absolute, pw / 2);
    const drawing = strokeSegment(extended, w, uCenter, zCenter);
    const prism = sketch(drawing, 'XY').extrude(strutDepth);
    fillings.push({
      solid: translate(prism, [0, 0, -strutDepth / 2]),
      box: strokeFootprint(extended, w),
    });
    prism.delete();
  }

  if (strutCount === 0 && fillings.length === 0) return null;

  const chunkDrawing = drawRoundedRectangle(uB - uA, bandHeight, 0).translate(
    (uA + uB) / 2 - uCenter,
    0
  );
  const slabPrism = sketch(chunkDrawing, 'XY').extrude(cutDepth);
  let region = translate(slabPrism, [0, 0, -halfDepth]);
  slabPrism.delete();

  for (const family of [...families, ...partitionDisjoint(fillings)]) {
    if (family.length === 0) continue;
    const carved = unwrap(cutAll(region, family, { trackEvolution: false }));
    region.delete();
    for (const s of family) s.delete();
    region = carved;
  }

  const stood = rotate(region, 90, { axis: [1, 0, 0] });
  region.delete();
  let placed = stood;
  if (slab.wallAngleDeg !== 0) {
    const rotated = rotate(placed, slab.wallAngleDeg, { axis: [0, 0, 1] });
    placed.delete();
    placed = rotated;
  }
  const positioned = translate(placed, [slab.anchorX, slab.anchorY, patternCenterZ]);
  placed.delete();
  return positioned;
}

/**
 * Deterministic u-windows for one flat wall. Filled patterns chunk into
 * ~3-column windows so each intra-chunk boolean and each final-cut tool stays
 * small — tool cost in one OCCT op grows super-linearly, so bounded windows
 * keep dense patterns near-linear. The bare grid stays whole-wall (chunking
 * measured slower there: seam overlap outweighs the small tool count).
 */
export function flatWindows(slab: FlatSlab, lattice: KumikoLattice): Array<[number, number]> {
  const uA = slab.u0 - SLAB_OVERLAP;
  const uB = slab.u1 + SLAB_OVERLAP;
  if (lattice.fillingTemplate.length === 0) return [[uA, uB]];
  const target = 3 * lattice.columnPitch;
  const chunks = Math.max(1, Math.round((uB - uA) / target));
  const chunkW = (uB - uA) / chunks;
  const windows: Array<[number, number]> = [];
  for (let i = 0; i < chunks; i++) {
    windows.push([
      uA + i * chunkW - (i > 0 ? SLAB_OVERLAP : 0),
      uA + (i + 1) * chunkW + (i < chunks - 1 ? SLAB_OVERLAP : 0),
    ]);
  }
  return windows;
}
