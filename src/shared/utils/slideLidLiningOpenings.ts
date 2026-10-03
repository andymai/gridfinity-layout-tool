/**
 * Where a thin wall's lining stops short of a wall opening.
 *
 * The lining is a closed ring fused after the wall cutouts, handle holes and
 * open sides are cut, so left whole it fills in every window it crosses. On the
 * two channel walls the shelf bar spans the same window anyway, and
 * `slideChannelInterrupted` says so. On the entry and far walls nothing else
 * bridges the window and nothing warns, so the lining is cut back there.
 */

import type { LidCompatibilitySide } from '@/shared/types/bin';
import type { LipGap } from '@/shared/utils/lipGapPlan';
import type {
  SlideLidGeometry,
  SlideLidLiningOpening,
  SlideLidWallLining,
} from '@/shared/utils/slideLidPlan';

/** How far (mm) the cut runs past the lining's faces, so it leaves no skin. */
const CUT_OVERRUN_MM = 0.5;

/**
 * How far (mm) the band is widened when asking which openings reach it. The
 * band and the openings are measured through different dimension helpers, and
 * erring wide only clears lining beside an opening that just misses the band.
 */
const BAND_MARGIN_MM = 0.5;

const OUTWARD: Record<LidCompatibilitySide, readonly [number, number]> = {
  back: [0, 1],
  front: [0, -1],
  right: [1, 0],
  left: [-1, 0],
};

/** The lining's height, chamfer included, as depths below the wall top. */
export function liningBand(
  geometry: SlideLidGeometry,
  lining: SlideLidWallLining
): { readonly topDepthMm: number; readonly bottomDepthMm: number } {
  const run = lining.channelInsetMm - lining.cavityInsetMm;
  return {
    topDepthMm: geometry.plateTopBelowWallTopMm - lining.zMax - BAND_MARGIN_MM,
    bottomDepthMm: geometry.plateTopBelowWallTopMm - lining.zMin + run + BAND_MARGIN_MM,
  };
}

/** `geometry` with its lining cut back from every opening on the entry or far wall. */
export function withLiningOpenings(
  geometry: SlideLidGeometry,
  gaps: readonly LipGap[]
): SlideLidGeometry {
  const lining = geometry.wallLining;
  if (!lining) return geometry;
  const openings = gaps.flatMap((gap) => {
    const opening = liningOpening(geometry.rotationDeg, lining, gap);
    return opening ? [opening] : [];
  });
  if (openings.length === 0) return geometry;
  return { ...geometry, wallLining: { ...lining, openings } };
}

function liningOpening(
  rotationDeg: number,
  lining: SlideLidWallLining,
  gap: LipGap
): SlideLidLiningOpening | null {
  const [nx] = toCanonical(OUTWARD[gap.side], -rotationDeg);
  if (nx === 0) return null;
  const tangent: readonly [number, number] =
    gap.side === 'front' || gap.side === 'back' ? [1, 0] : [0, 1];
  const [, ty] = toCanonical(tangent, -rotationDeg);
  const outer = (nx * lining.bodyLengthMm) / 2;
  const inner = outer - nx * lining.channelInsetMm;
  return {
    xMin: Math.min(outer, inner) - CUT_OVERRUN_MM,
    xMax: Math.max(outer, inner) + CUT_OVERRUN_MM,
    yMin: Math.min(gap.lo * ty, gap.hi * ty),
    yMax: Math.max(gap.lo * ty, gap.hi * ty),
  };
}

/** Rotate a bin-frame axis by a quarter-turn multiple; components stay 0 or ±1. */
function toCanonical([x, y]: readonly [number, number], deg: number): readonly [number, number] {
  const r = (deg * Math.PI) / 180;
  return [
    Math.round(x * Math.cos(r) - y * Math.sin(r)) || 0,
    Math.round(x * Math.sin(r) + y * Math.cos(r)) || 0,
  ];
}
