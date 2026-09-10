/** Strut segment arithmetic shared by the flat and corner kumiko slab cutters: clipping, extension, stroking, filling and footprint partitioning. */

import { drawRoundedRectangle } from 'brepjs';
import type { Drawing, Shape3D } from 'brepjs';

import type { KumikoLattice, KumikoSegment } from './patterns';

/** Below this delta (mm) a corner strut is treated as vertical / horizontal. */
export const AXIS_EPSILON = 0.15;

export const RAD_TO_DEG = 180 / Math.PI;

/**
 * Max angular span (radians) a corner strut may cover as a straight chord box
 * before splitting: keeps the flat-vs-arc sagitta below ~0.15mm at bin corner
 * radii — under print resolution.
 */
export const CHORD_MAX_PHI = 0.55;

/** Overlap of flat slabs past the corner tangent planes (boolean robustness). */
export const SLAB_OVERLAP = 0.05;

/** Largest stroke width used by the lattice (grid struts or filling pieces). */
export function maxStrutWidth(lattice: KumikoLattice): number {
  let max = lattice.strutWidth;
  for (const seg of lattice.fillingTemplate) {
    if (seg.width !== undefined && seg.width > max) max = seg.width;
  }
  return max;
}

/** Axis-aligned footprint of a stroked segment in the slab's (u, z) plane. */
export interface FootprintBox {
  readonly u0: number;
  readonly u1: number;
  readonly z0: number;
  readonly z1: number;
}

/** Clip a segment's centerline to a u interval; null when fully outside. */
export function clipSegmentToURange(
  seg: KumikoSegment,
  u0: number,
  u1: number
): KumikoSegment | null {
  const [ua, za] = seg.a;
  const [ub, zb] = seg.b;
  const lo = Math.min(ua, ub);
  const hi = Math.max(ua, ub);
  if (hi <= u0 || lo >= u1) return null;
  if (lo >= u0 && hi <= u1) return seg;
  const du = ub - ua;
  if (Math.abs(du) < 1e-9) return seg;
  const tFor = (u: number): number => (u - ua) / du;
  let t0 = 0;
  let t1 = 1;
  const tAt0 = tFor(du > 0 ? u0 : u1);
  const tAt1 = tFor(du > 0 ? u1 : u0);
  t0 = Math.max(t0, tAt0);
  t1 = Math.min(t1, tAt1);
  if (t1 <= t0) return null;
  return {
    a: [ua + t0 * du, za + t0 * (zb - za)],
    b: [ua + t1 * du, za + t1 * (zb - za)],
    ...(seg.width === undefined ? {} : { width: seg.width }),
  };
}

/**
 * Clip a segment to a u interval treating u as periodic: the segment is also
 * tested shifted by ±period so slabs adjacent to the u = 0 seam still see
 * struts emitted on the far side of the wrap. Without this, the last corner's
 * wedge cuts the cap ends off every strut that crosses the seam.
 */
export function clipSegmentToURangePeriodic(
  seg: KumikoSegment,
  u0: number,
  u1: number,
  period: number
): KumikoSegment[] {
  const pieces: KumikoSegment[] = [];
  for (const shift of [-period, 0, period]) {
    const shifted: KumikoSegment =
      shift === 0
        ? seg
        : {
            a: [seg.a[0] + shift, seg.a[1]],
            b: [seg.b[0] + shift, seg.b[1]],
            ...(seg.width === undefined ? {} : { width: seg.width }),
          };
    const clipped = clipSegmentToURange(shifted, u0, u1);
    if (clipped) pieces.push(clipped);
  }
  return pieces;
}

/**
 * True when a clipped piece's centerline lives entirely in the clip margin
 * outside [u0, u1]. Non-vertical margin pieces are redundant on corners: the
 * neighboring piece of the same lattice line covers the slab-side footprint
 * with its own body + square cap, and each margin piece would otherwise
 * become a near-degenerate helix sweep (measured 5× cost on the seam corner,
 * which sees every diagonal's wrapped duplicate). Vertical pieces are exempt:
 * a column exactly on the slab boundary genuinely pokes into the wedge and
 * revolves cheaply.
 */
export function isRedundantMarginPiece(piece: KumikoSegment, u0: number, u1: number): boolean {
  const lo = Math.min(piece.a[0], piece.b[0]);
  const hi = Math.max(piece.a[0], piece.b[0]);
  if (hi - lo < AXIS_EPSILON) return false;
  return hi <= u0 + 1e-6 || lo >= u1 - 1e-6;
}

/** Extend both segment endpoints along its direction (square end caps). */
export function extendSegment(seg: KumikoSegment, by: number): KumikoSegment {
  const [ua, za] = seg.a;
  const [ub, zb] = seg.b;
  const len = Math.hypot(ub - ua, zb - za);
  if (len < 1e-9) return seg;
  const dx = ((ub - ua) / len) * by;
  const dz = ((zb - za) / len) * by;
  return {
    a: [ua - dx, za - dz],
    b: [ub + dx, zb + dz],
    ...(seg.width === undefined ? {} : { width: seg.width }),
  };
}

/** Stroke a segment into a Drawing rectangle in slab-local (a, y) coords. */
export function strokeSegment(
  seg: KumikoSegment,
  defaultWidth: number,
  uCenter: number,
  zCenter: number
): Drawing {
  const width = seg.width ?? defaultWidth;
  const [ua, za] = seg.a;
  const [ub, zb] = seg.b;
  const len = Math.hypot(ub - ua, zb - za);
  const angleDeg = Math.atan2(zb - za, ub - ua) * RAD_TO_DEG;
  return drawRoundedRectangle(len + width, width, 0)
    .rotate(angleDeg, [0, 0])
    .translate((ua + ub) / 2 - uCenter, (za + zb) / 2 - zCenter);
}

/** Bounding radius of the filling template around a vertex (mm). */
function fillingReach(lattice: KumikoLattice): number {
  let reach = 0;
  for (const seg of lattice.fillingTemplate) {
    const half = (seg.width ?? lattice.strutWidth) / 2;
    for (const [x, z] of [seg.a, seg.b]) {
      reach = Math.max(reach, Math.hypot(x, z) + half);
    }
  }
  return reach;
}

/**
 * Filling pieces for slabs that can't stamp a prefabricated solid (corners):
 * template segments offset to every vertex whose stamp can reach [u0, u1],
 * including ±period wrap copies.
 */
export function fillingPiecesForRange(
  lattice: KumikoLattice,
  u0: number,
  u1: number,
  period: number
): KumikoSegment[] {
  const reach = fillingReach(lattice);
  const pieces: KumikoSegment[] = [];
  for (const vertex of lattice.vertices) {
    for (const shift of [-period, 0, period]) {
      const u = vertex.u + shift;
      if (u < u0 - reach || u > u1 + reach) continue;
      for (const seg of lattice.fillingTemplate) {
        pieces.push({
          a: [u + seg.a[0], vertex.z + seg.a[1]],
          b: [u + seg.b[0], vertex.z + seg.b[1]],
          ...(seg.width === undefined ? {} : { width: seg.width }),
        });
      }
    }
  }
  return pieces;
}

/**
 * AABB of the rectangle `strokeSegment` draws for `seg` — length |ab| + width,
 * height width, rotated to the segment's direction.
 *
 * Deliberately conservative for a rotated segment: the box around a diagonal
 * thin rectangle is much larger than the rectangle. That over-reports overlap,
 * which is safe here (a bucket stays disjoint) but is why this is only used to
 * partition filling pieces — the struts are already split by direction, and
 * boxing a diagonal family would split it far past the point where the
 * per-`cutAll` overhead outweighs the saved intersection work.
 */
export function strokeFootprint(seg: KumikoSegment, defaultWidth: number): FootprintBox {
  const width = seg.width ?? defaultWidth;
  const [ua, za] = seg.a;
  const [ub, zb] = seg.b;
  const du = ub - ua;
  const dz = zb - za;
  const len = Math.hypot(du, dz);
  const cos = len === 0 ? 1 : Math.abs(du) / len;
  const sin = len === 0 ? 0 : Math.abs(dz) / len;
  const halfU = ((len + width) * cos + width * sin) / 2;
  const halfZ = ((len + width) * sin + width * cos) / 2;
  return {
    u0: (ua + ub) / 2 - halfU,
    u1: (ua + ub) / 2 + halfU,
    z0: (za + zb) / 2 - halfZ,
    z1: (za + zb) / 2 + halfZ,
  };
}

function boxesOverlap(a: FootprintBox, b: FootprintBox): boolean {
  return a.u0 < b.u1 && b.u0 < a.u1 && a.z0 < b.z1 && b.z0 < a.z1;
}

/** A cut tool paired with its footprint. One array, not two, so a tool can
 *  never drift out of step with the box that describes it. */
export interface BoxedTool {
  readonly solid: Shape3D;
  readonly box: FootprintBox;
}

/**
 * Split tools into buckets whose footprints are pairwise disjoint.
 *
 * `cutAll` pays for tool-TOOL intersections on top of tool-vs-region, and that
 * pairwise cost grows super-linearly in the bucket — which is exactly why the
 * struts are partitioned by direction above. Filling pieces radiate from a
 * lattice vertex and are extended to weld into their neighbours, so they have
 * no direction to group by and every piece overlaps the next; cutting all of
 * them in one op was ~93% of a kumiko bin's generation time.
 *
 * Greedy first-fit. A piece only reaches its immediate neighbours, so this
 * settles at a handful of buckets (6 of 14 for asanoha) — and bigger disjoint
 * buckets beat smaller overlapping ones, since each `cutAll` also carries a
 * fixed cost that punishes over-splitting.
 */
export function partitionDisjoint(tools: readonly BoxedTool[]): Shape3D[][] {
  const buckets: Shape3D[][] = [];
  const bucketBoxes: FootprintBox[][] = [];
  for (const { solid, box } of tools) {
    const free = bucketBoxes.findIndex((taken) => !taken.some((o) => boxesOverlap(o, box)));
    if (free === -1) {
      buckets.push([solid]);
      bucketBoxes.push([box]);
    } else {
      buckets[free].push(solid);
      bucketBoxes[free].push(box);
    }
  }
  return buckets;
}
