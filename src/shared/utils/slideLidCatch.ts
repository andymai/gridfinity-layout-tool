/**
 * The stacking lip's cross-section, for a sliding lid's finger catch to carry.
 *
 * Pure, like `slideLidPlan`, which is its only caller.
 */

import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { LIP_TIP_FLAT_MM, LIP_TIP_MM } from '@/features/bin-designer/types/base';
import type { LipTipStyle } from '@/features/bin-designer/types/base';

const LIP_TAPER_WIDTH = GRIDFINITY_SPEC.LIP_SMALL_TAPER + GRIDFINITY_SPEC.LIP_BIG_TAPER;

/**
 * The stacking lip's inner outline, as `[inset from the outer face, z]` with
 * its base plane at `baseZ`: from the peak, which takes the finish
 * `finishLipPeak` gives the bin's own lip, down the big taper, the vertical
 * and the small taper, to the top of the support. Mirrors `buildTopShapeLoft`'s
 * inner sections.
 */
export function lipSection(baseZ: number, tip: LipTipStyle): (readonly [number, number])[] {
  const { LIP_SMALL_TAPER, LIP_VERTICAL_PART, LIP_BIG_TAPER, LIP_SUPPORT_DROP } = GRIDFINITY_SPEC;
  const peakZ = baseZ + LIP_SMALL_TAPER + LIP_VERTICAL_PART + LIP_BIG_TAPER;
  return [
    ...lipPeak(peakZ, tip),
    [LIP_BIG_TAPER, baseZ + LIP_SMALL_TAPER + LIP_VERTICAL_PART],
    [LIP_BIG_TAPER, baseZ + LIP_SMALL_TAPER],
    [LIP_TAPER_WIDTH, baseZ],
    [LIP_TAPER_WIDTH, baseZ - LIP_SUPPORT_DROP],
  ];
}

/**
 * The peak, where the vertical outer face (inset 0) meets the 45° inner taper,
 * from the outer face round to the taper. A fillet of `LIP_TIP_MM` between
 * faces 45° apart is tangent `r / tan(22.5°)` from the corner on each.
 */
function lipPeak(peakZ: number, tip: LipTipStyle): (readonly [number, number])[] {
  switch (tip) {
    case 'sharp':
      return [[0, peakZ]];
    case 'flat':
      return [
        [0, peakZ - LIP_TIP_FLAT_MM],
        [LIP_TIP_FLAT_MM, peakZ - LIP_TIP_FLAT_MM],
      ];
    case 'chamfer': {
      const run = LIP_TIP_MM / Math.SQRT2;
      return [
        [0, peakZ - LIP_TIP_MM],
        [run, peakZ - run],
      ];
    }
    case 'round': {
      const r = LIP_TIP_MM;
      const tangent = r / Math.tan(Math.PI / 8);
      const cx = r;
      const cz = peakZ - tangent;
      const points: (readonly [number, number])[] = [];
      const steps = 8;
      // From the outer face's normal (pointing out, −u) to the taper's (up and in).
      for (let i = 0; i <= steps; i++) {
        const a = Math.PI - ((i / steps) * (Math.PI * 3)) / 4;
        points.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
      }
      return points;
    }
  }
}

/**
 * A finger catch's section, as `[inset from the outer face, z]`: the lip, with
 * its 45° support run on down and out until it meets a bar `depth` thick, and
 * that bar down to `bottomZ` in the plate.
 *
 * Running the support on is what keeps the part printable: stopped anywhere,
 * the jut's underside is a flat ledge over air. It drops below the bin's
 * retainers on a thin wall, where the bin's lip cut takes them away.
 */
export function catchSection(
  lipBaseZ: number,
  depth: number,
  bottomZ: number,
  tip: LipTipStyle
): (readonly [number, number])[] {
  // Short of the support's top, which a bar as deep as the lip would reach,
  // leaving a repeated point that the kernel rejects as a wire.
  const bar = Math.min(depth, LIP_TAPER_WIDTH - 0.05);
  return [
    ...lipSection(lipBaseZ, tip),
    [bar, supportZ(lipBaseZ, bar)],
    [bar, bottomZ],
    [0, bottomZ],
  ];
}

/**
 * Where the lip's support face, run on at 45°, sits at `inset`. It passes
 * through the lip's inboard bottom corner, `LIP_TAPER_WIDTH` in and
 * `LIP_SUPPORT_DROP` below the base.
 */
function supportZ(lipBaseZ: number, inset: number): number {
  return lipBaseZ - GRIDFINITY_SPEC.LIP_SUPPORT_DROP - (LIP_TAPER_WIDTH - inset);
}
