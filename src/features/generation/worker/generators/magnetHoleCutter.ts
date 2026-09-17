/**
 * The one magnet-hole negative every producer drills with, so the bin socket,
 * lightweight pads, detachable feet, lid top, lid bosses and the baseplate
 * cannot describe different holes for the same magnet spec.
 *
 * The cutter's bore spans z in [0, height] on the Z axis at the origin; the
 * caller positions it exactly as it positioned the plain cylinder. `mouth`
 * names the end the magnet enters from: the chamfer frustum opens there and
 * overshoots the end by a hair so its rim is never coplanar with the face it
 * cuts, which also keeps a caller's own coplanar margin working unchanged.
 */

import { cone, cylinder, drawPointsInterpolation, fuse, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { MagnetHoleStyle } from '@/shared/generation/magnetHoleStyle';
import {
  MAGNET_CHAMFER_MM,
  MAGNET_CRUSH_RIB_COUNT,
  magnetBoreRadiusAt,
  magnetBoreSegments,
} from '@/shared/generation/magnetHoleStyle';

const CHAMFER_OVERSHOOT_MM = 0.05;
const PLAIN_RING_SEGMENTS = 32;

export interface MagnetHoleCutterOptions {
  readonly radius: number;
  readonly height: number;
  readonly style: MagnetHoleStyle;
  /**
   * Which end of the bore is the mouth, and how far inside that end the
   * mouth plane sits (a caller's coplanar margin). Default: bottom, flush.
   */
  readonly mouth?: { readonly end: 'bottom' | 'top'; readonly inset?: number };
}

/**
 * The wave as ONE open spline through a ring of points that returns to its
 * start: a single face per hole, which the booleans handle about as fast as
 * a cylinder. A periodic spline would have no seam at all, but the kernel's
 * booleans misclassify its periodic surface; per-rib pen arcs are seamless
 * too, at sixteen faces per hole and triple the tessellation. So the seam
 * stays, placed at the wave's inflection point: the true curvature is zero
 * there, which is exactly the natural end condition of the interpolation, so
 * the join is tangent-continuous to within the fit and no rib is pointed.
 */
function ribbedBore(radius: number, height: number, style: MagnetHoleStyle): Shape3D {
  const segments = magnetBoreSegments(style, PLAIN_RING_SEGMENTS);
  const phase = Math.PI / (2 * MAGNET_CRUSH_RIB_COUNT);
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = phase + ((i % segments) / segments) * Math.PI * 2;
    const r = magnetBoreRadiusAt(theta, radius, style);
    points.push([r * Math.cos(theta), r * Math.sin(theta)]);
  }
  return drawPointsInterpolation(points).sketchOnPlane('XY', 0).extrude(height);
}

export function buildMagnetHoleCutter(opts: MagnetHoleCutterOptions): Shape3D {
  const { radius, height, style } = opts;
  const end = opts.mouth?.end ?? 'bottom';
  const inset = opts.mouth?.inset ?? 0;

  const bore: Shape3D = style.crushRibs
    ? ribbedBore(radius, height, style)
    : cylinder(radius, height);
  if (!style.chamfer) return bore;

  // Frustum from the overshot end to `chamfer` below the mouth plane. Its
  // radius grows by exactly its length (45 degrees), so it meets the bore at
  // the bore radius and crosses the mouth plane one chamfer wider.
  const reach = inset + MAGNET_CHAMFER_MM + CHAMFER_OVERSHOOT_MM;
  const endRadius = radius + reach;
  const chamfer =
    end === 'bottom'
      ? cone(endRadius, radius, reach, { at: [0, 0, -CHAMFER_OVERSHOOT_MM] })
      : cone(radius, endRadius, reach, { at: [0, 0, height - inset - MAGNET_CHAMFER_MM] });
  try {
    return unwrap(fuse(bore, chamfer));
  } finally {
    bore.delete();
    chamfer.delete();
  }
}
