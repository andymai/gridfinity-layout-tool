/**
 * Kumiko wrapped-lattice wall pattern builder.
 *
 * Kumiko patterns are authored in unrolled (u, z) coordinates — u is arc
 * length along the OUTER wall perimeter (a closed loop), z is height within
 * the pattern band — and mapped back onto the bin as one continuous lattice
 * that bends around the rounded corners:
 *
 *   - Flat wall spans: 2D cut region (slab − stroked struts) extruded through
 *     the wall, placed with the stamp-pattern transform chain.
 *   - Corner arcs (exact kernels only): annular wedge minus strut solids —
 *     vertical struts as small-angle revolves, near-horizontal struts as thin
 *     partial revolves, rising diagonals swept along a helix (a straight
 *     line in unrolled space IS a helix on the corner cylinder), falling
 *     diagonals as chord-box chains (see the falling-diagonal branch).
 *
 * Mesh kernels (Manifold drafts) can't sweep along a helix, so the corner
 * cutters are skipped there: drafts show the phase-aligned flat panels with
 * solid corners, and the exact OCCT result replaces them. Exports always run
 * the exact path.
 *
 * PR-1 scope: rectangular bins only. Polygon (cellMask) footprints and
 * slotted bins render solid walls for kumiko patterns; the stamp patterns
 * still cover those — tracked as a follow-up.
 */

import {
  drawRoundedRectangle,
  revolve,
  rotate,
  translate,
  cutAll,
  unwrap,
  clone,
  polygon,
  solid,
  sketchHelix,
  getKernelCapabilities,
} from 'brepjs';
import { orientedFace, planarFace } from 'brepjs';
import type { Drawing, OrientedFace, PlanarFace, Shape3D } from 'brepjs';

type RevolveProfile = OrientedFace & PlanarFace;
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_PATTERN_SCALE } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { PipelineContext } from './pipeline/types';
import type { PerfCollector } from './pipeline/perfCollector';
import type { WallPatternDescriptor } from './wallPatterns';
import { getSlotFreeWalls, TOP_KEEP_OUT, BOTTOM_SOLID_SKIRT } from './wallPatterns';
import { resolveWallPatternSides } from '@/shared/utils/wallPatternSides';
import { getPatternCalculator, isWrappedLatticeCalculator, PATTERN_REGISTRY } from './patterns';
import type { KumikoLattice, KumikoSegment, WrappedLatticeCalculator } from './patterns';
import { BOX_CORNER_RADIUS, COPLANAR_OVERLAP } from './generatorConstants';
import { sketch } from './meshUtils';
import { buildCacheKey, quantize, compactKey } from './cacheKeyUtils';
import { checkCancelled } from './utils/abort';
import { getFeatureCache, setFeatureCache } from './shapeCache';
import { applyWallPatternClips } from './wallPatternClips';
import { computeWallClipContext, computeWallClips } from './wallPatternBuilder';
import { KUMIKO_WRAP_BASE_CACHE, KUMIKO_WRAP_CLIPPED_CACHE } from './wallPatternTypes';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';

/** Overlap of flat slabs past the corner tangent planes (boolean robustness). */
const SLAB_OVERLAP = 0.05;

/** Below this delta (mm) a corner strut is treated as vertical / horizontal. */
const AXIS_EPSILON = 0.15;

const RAD_TO_DEG = 180 / Math.PI;

type WallSide = 'front' | 'right' | 'back' | 'left';

export interface FlatSlab {
  readonly kind: 'flat';
  readonly side: WallSide;
  readonly u0: number;
  readonly u1: number;
  /** Rotation about Z mapping slab-local +x to the traversal direction. */
  readonly wallAngleDeg: number;
  /** Wall anchor: inner face midpoint (stamp-pattern convention). */
  readonly anchorX: number;
  readonly anchorY: number;
}

interface CornerSlab {
  readonly kind: 'corner';
  readonly u0: number;
  readonly u1: number;
  /** Corner axis position. */
  readonly cx: number;
  readonly cy: number;
  /** World angle of the corner's arc start (at u0), radians. */
  readonly thetaStart: number;
  /** The two walls this corner joins — drives clip-box routing. */
  readonly prevSide: WallSide;
  readonly nextSide: WallSide;
}

type PerimeterSlab = FlatSlab | CornerSlab;

interface PerimeterLayout {
  readonly perimeter: number;
  readonly slabs: readonly PerimeterSlab[];
  /** Outer corner radius (mm). */
  readonly cornerRadius: number;
}

/**
 * Walk the outer perimeter counterclockwise starting at the front-left corner
 * tangent point: front → FR corner → right → BR → back → BL → left → FL.
 */
function computePerimeterLayout(
  outerW: number,
  outerD: number,
  innerW: number,
  innerD: number,
  cornerRadius: number
): PerimeterLayout {
  const r = cornerRadius;
  const flatW = outerW - 2 * r;
  const flatD = outerD - 2 * r;
  const arc = (Math.PI / 2) * r;

  const slabs: PerimeterSlab[] = [];
  let u = 0;
  const flat = (side: WallSide, len: number, angle: number, ax: number, ay: number): void => {
    slabs.push({
      kind: 'flat',
      side,
      u0: u,
      u1: u + len,
      wallAngleDeg: angle,
      anchorX: ax,
      anchorY: ay,
    });
    u += len;
  };
  const corner = (
    cx: number,
    cy: number,
    thetaStart: number,
    prevSide: WallSide,
    nextSide: WallSide
  ): void => {
    slabs.push({ kind: 'corner', u0: u, u1: u + arc, cx, cy, thetaStart, prevSide, nextSide });
    u += arc;
  };

  flat('front', flatW, 0, 0, -innerD / 2);
  corner(outerW / 2 - r, -outerD / 2 + r, -Math.PI / 2, 'front', 'right');
  flat('right', flatD, 90, innerW / 2, 0);
  corner(outerW / 2 - r, outerD / 2 - r, 0, 'right', 'back');
  flat('back', flatW, 180, 0, innerD / 2);
  corner(-outerW / 2 + r, outerD / 2 - r, Math.PI / 2, 'back', 'left');
  flat('left', flatD, 270, -innerW / 2, 0);
  corner(-outerW / 2 + r, -outerD / 2 + r, Math.PI, 'left', 'front');

  return { perimeter: u, slabs, cornerRadius: r };
}

/**
 * Perimeter the wrapped lattice is quantized against for this bin, or null
 * when the footprint is too small to carry a corner arc.
 *
 * Divider panels resolve their lattice against this SAME perimeter so
 * their triangles come out the exact size the outer walls resolved to —
 * `quantizeColumns` depends only on perimeter and target cell size, so only
 * the band height differs between a wall and a divider.
 */
export function resolveKumikoPerimeter(
  innerW: number,
  innerD: number,
  wallThickness: number
): number | null {
  const outerW = innerW + 2 * wallThickness;
  const outerD = innerD + 2 * wallThickness;
  const cornerRadius = Math.min(BOX_CORNER_RADIUS, Math.min(outerW, outerD) / 2 - 0.1);
  if (cornerRadius <= 0.2) return null;
  return computePerimeterLayout(outerW, outerD, innerW, innerD, cornerRadius).perimeter;
}

/** Clip a segment's centerline to a u interval; null when fully outside. */
function clipSegmentToURange(seg: KumikoSegment, u0: number, u1: number): KumikoSegment | null {
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
function clipSegmentToURangePeriodic(
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
function isRedundantMarginPiece(piece: KumikoSegment, u0: number, u1: number): boolean {
  const lo = Math.min(piece.a[0], piece.b[0]);
  const hi = Math.max(piece.a[0], piece.b[0]);
  if (hi - lo < AXIS_EPSILON) return false;
  return hi <= u0 + 1e-6 || lo >= u1 - 1e-6;
}

/** Extend both segment endpoints along its direction (square end caps). */
function extendSegment(seg: KumikoSegment, by: number): KumikoSegment {
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
function strokeSegment(
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

/** Largest stroke width used by the lattice (grid struts or filling pieces). */
function maxStrutWidth(lattice: KumikoLattice): number {
  let max = lattice.strutWidth;
  for (const seg of lattice.fillingTemplate) {
    if (seg.width !== undefined && seg.width > max) max = seg.width;
  }
  return max;
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
function fillingPiecesForRange(
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
 * Build one flat wall slab's cutter: slab box minus fused strut prisms,
 * placed with the stamp transform chain.
 *
 * The subtraction happens in 3D (OCCT) rather than via Drawing 2D booleans:
 * lattice struts share vertices, and the resulting exact vertex-on-edge
 * coincidences reliably break the JS blueprint boolean path
 * (POINT_NOT_ON_CURVE). OCCT's fuzzy-tolerance booleans absorb them.
 *
 * Returns null when the slab has no struts at all — an empty lattice must
 * degrade to solid walls, not cut the whole wall away.
 */
/**
 * Build one flat wall slab's cutter: slab box minus strut prisms, placed with
 * the stamp transform chain.
 *
 * The subtraction happens in 3D (OCCT) rather than via Drawing 2D booleans:
 * lattice struts share vertices, and the resulting exact vertex-on-edge
 * coincidences reliably break the JS blueprint boolean path
 * (POINT_NOT_ON_CURVE). OCCT's fuzzy-tolerance booleans absorb them.
 *
 * Returns null when the slab has no struts at all — an empty lattice must
 * degrade to solid walls, not cut the whole wall away.
 */
/** Axis-aligned footprint of a stroked segment in the slab's (u, z) plane. */
export interface FootprintBox {
  readonly u0: number;
  readonly u1: number;
  readonly z0: number;
  readonly z1: number;
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

/** Radial rect profile face on the XZ plane: r ∈ [r0, r1], z ∈ [z0, z1]. */
function radialProfileFace(r0: number, r1: number, z0: number, z1: number): RevolveProfile {
  const drawing = drawRoundedRectangle(r1 - r0, z1 - z0, 0).translate((r0 + r1) / 2, (z0 + z1) / 2);
  const face = sketch(drawing, 'XZ').face();
  const oriented = unwrap(orientedFace(face));
  // Both brands are runtime-proven above; TS's planarFace signature drops the
  // oriented brand, so restore the intersection it verified.
  return unwrap(planarFace(oriented)) as RevolveProfile;
}

/** Annular wedge around the local Z axis from φ=0 to `angle` (radians). */
function annularWedge(r0: number, r1: number, z0: number, z1: number, angle: number): Shape3D {
  const face = radialProfileFace(r0, r1, z0, z1);
  const wedge = unwrap(revolve(face, { axis: [0, 0, 1], at: [0, 0, 0], angle }));
  face.delete();
  return wedge;
}

/** Rotate a local corner solid to its start angle. */
function toCornerAngle(shape: Shape3D, phiRad: number): Shape3D {
  if (phiRad === 0) return shape;
  const rotated = rotate(shape, phiRad * RAD_TO_DEG, { axis: [0, 0, 1] });
  shape.delete();
  return rotated;
}

/**
 * Max angular span (radians) a corner strut may cover as a straight chord box
 * before splitting: keeps the flat-vs-arc sagitta below ~0.15mm at bin corner
 * radii — under print resolution.
 */
const CHORD_MAX_PHI = 0.55;

type Vec3Tuple = [number, number, number];

/**
 * Straight hexahedral strut along the chord between two corner-surface
 * points. Short filling pieces use this instead of a helix sweep: the true
 * helical strut's sagitta over ≤CHORD_MAX_PHI is below print resolution, and
 * a plain box costs a fraction of a swept helicoid in the wedge boolean.
 */
function chordBoxStrut(
  phiA: number,
  zA: number,
  phiB: number,
  zB: number,
  width: number,
  sr0: number,
  sr1: number
): Shape3D {
  // Near-tangent contacts with neighboring struts (goma ribs seat their ends
  // ON the arm edges) leave knife-edge slivers that fail to sew — export
  // showed boundary-edge cracks on the corner cylinder. A COPLANAR_OVERLAP
  // widening turns the tangency into a finite, invisible overlap.
  const pw = width + 2 * COPLANAR_OVERLAP;
  const rMid = (sr0 + sr1) / 2;
  const A: Vec3Tuple = [rMid * Math.cos(phiA), rMid * Math.sin(phiA), zA];
  const B: Vec3Tuple = [rMid * Math.cos(phiB), rMid * Math.sin(phiB), zB];
  const d: Vec3Tuple = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const dLen = Math.hypot(d[0], d[1], d[2]);
  const du: Vec3Tuple = [d[0] / dLen, d[1] / dLen, d[2] / dLen];
  const phiM = (phiA + phiB) / 2;
  const radial: Vec3Tuple = [Math.cos(phiM), Math.sin(phiM), 0];
  // In-surface perpendicular to the chord, then re-orthogonalized radial.
  const yv: Vec3Tuple = [
    radial[1] * du[2] - radial[2] * du[1],
    radial[2] * du[0] - radial[0] * du[2],
    radial[0] * du[1] - radial[1] * du[0],
  ];
  const yLen = Math.hypot(yv[0], yv[1], yv[2]);
  const yu: Vec3Tuple = [yv[0] / yLen, yv[1] / yLen, yv[2] / yLen];
  const nu: Vec3Tuple = [
    du[1] * yu[2] - du[2] * yu[1],
    du[2] * yu[0] - du[0] * yu[2],
    du[0] * yu[1] - du[1] * yu[0],
  ];

  const corners: Vec3Tuple[] = [];
  for (const base of [A, B]) {
    for (const t of [-pw / 2, pw / 2]) {
      for (const r of [sr0 - rMid, sr1 - rMid]) {
        corners.push([
          base[0] + yu[0] * t + nu[0] * r,
          base[1] + yu[1] * t + nu[1] * r,
          base[2] + yu[2] * t + nu[2] * r,
        ]);
      }
    }
  }
  // Index layout: [end][side t][radial r] → 0:A--, 1:A-+, 2:A+-, 3:A++,
  // 4:B--, 5:B-+, 6:B+-, 7:B++.
  const quads: number[][] = [
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    [0, 2, 6, 4],
    [1, 5, 7, 3],
    [0, 4, 5, 1],
    [2, 3, 7, 6],
  ];
  const faces = quads.map((q) => unwrap(polygon(q.map((i) => corners[i]))));
  const box = unwrap(solid(faces));
  for (const f of faces) f.delete();
  return box;
}

/**
 * Build one corner slab's cutter in the corner-local frame (axis at origin,
 * φ measured from +X): annular wedge minus strut solids. Exact kernels only.
 */
function buildCornerSlabCutter(
  slab: CornerSlab,
  lattice: KumikoLattice,
  bandZ0: number,
  bandHeight: number,
  outerRadius: number,
  wallThickness: number,
  perimeter: number,
  perf?: PerfCollector
): Shape3D {
  const w = lattice.strutWidth;
  const bandZ1 = bandZ0 + bandHeight;
  // Tight radial envelope: the band sits below the lip taper (TOP_KEEP_OUT),
  // so 1mm past each wall face fully pierces it. A wider reach (the flat
  // cutters' ±2·wt convention) balloons the wedge toward the corner axis and
  // grows every curved strut face — measured ~2× cost in the final boolean.
  const rIn = Math.max(outerRadius - wallThickness, 0.3);
  const rc0 = Math.max(rIn - 1, 0.1);
  const rc1 = outerRadius + 1;
  const sr0 = Math.max(rc0 - 0.5, 0.05);
  const sr1 = rc1 + 0.5;
  const rMid = (sr0 + sr1) / 2;
  const radialSpan = sr1 - sr0;
  const phiOf = (u: number): number => (u - slab.u0) / outerRadius;

  const wedge = annularWedge(rc0, rc1, bandZ0, bandZ1, Math.PI / 2);

  // Same family partition as the flat chunks: verticals, horizontals, rising,
  // falling — struts within a family are disjoint, so each family cut has no
  // tool-tool intersection work.
  const families: Shape3D[][] = [[], [], [], [], []];
  const maxW = maxStrutWidth(lattice);
  const pieces: KumikoSegment[] = [];
  for (const seg of lattice.segments) {
    for (const piece of clipSegmentToURangePeriodic(seg, slab.u0 - w, slab.u1 + w, perimeter)) {
      if (!isRedundantMarginPiece(piece, slab.u0, slab.u1)) pieces.push(piece);
    }
  }
  // Filling pieces arrive pre-positioned (absolute u, band-local z); clip each
  // to the corner's reach and keep the margin-redundancy rule — the adjacent
  // flat covers shared vertices' pieces. Non-vertical fillings become chord
  // boxes (split under CHORD_MAX_PHI): dozens of short helix sweeps per
  // corner measured 4× the whole cutter cost on filled patterns, and the
  // chord's sagitta at these spans is below print resolution.
  for (const filling of fillingPiecesForRange(lattice, slab.u0 - maxW, slab.u1 + maxW, perimeter)) {
    const clipped = clipSegmentToURange(filling, slab.u0 - maxW, slab.u1 + maxW);
    if (!clipped || isRedundantMarginPiece(clipped, slab.u0, slab.u1)) continue;
    const pw = clipped.width ?? w;
    const capped = extendSegment(clipped, pw / 2);
    const [fua, fza] = capped.a;
    const [fub, fzb] = capped.b;
    if (Math.abs(fub - fua) < AXIS_EPSILON) {
      // Vertical fillings revolve exactly and cheaply, like grid columns.
      const dPhi = pw / outerRadius;
      const phiMid = phiOf((fua + fub) / 2);
      const slab3d = annularWedge(
        sr0,
        sr1,
        Math.min(fza, fzb) + bandZ0,
        Math.max(fza, fzb) + bandZ0,
        dPhi
      );
      families[0].push(toCornerAngle(slab3d, phiMid - dPhi / 2));
      continue;
    }
    const phiA = phiOf(fua);
    const phiB = phiOf(fub);
    const steps = Math.max(1, Math.ceil(Math.abs(phiB - phiA) / CHORD_MAX_PHI));
    // Consecutive sub-chords overlap by a parameter margin: sharing their end
    // planes exactly leaves coplanar tool faces, and the resulting sliver
    // shows up as boundary-edge cracks on the corner cylinder (goma's long
    // ribs are the only fillings that split).
    const tPad = steps > 1 ? 0.02 : 0;
    for (let i = 0; i < steps; i++) {
      const t0 = Math.max(0, i / steps - tPad);
      const t1 = Math.min(1, (i + 1) / steps + tPad);
      families[4].push(
        chordBoxStrut(
          phiA + (phiB - phiA) * t0,
          fza + (fzb - fza) * t0 + bandZ0,
          phiA + (phiB - phiA) * t1,
          fza + (fzb - fza) * t1 + bandZ0,
          pw,
          sr0,
          sr1
        )
      );
    }
  }
  for (const clipped of pieces) {
    const pw = clipped.width ?? w;
    const capped = extendSegment(clipped, pw / 2);
    const [ua, zaRel] = capped.a;
    const [ub, zbRel] = capped.b;
    const za = zaRel + bandZ0;
    const zb = zbRel + bandZ0;
    const du = Math.abs(ub - ua);
    const dz = Math.abs(zb - za);

    if (du < AXIS_EPSILON) {
      // Vertical strut: small-angle revolve so both faces are radial planes.
      const dPhi = pw / outerRadius;
      const phiMid = phiOf((ua + ub) / 2);
      const slab3d = annularWedge(sr0, sr1, Math.min(za, zb), Math.max(za, zb), dPhi);
      families[0].push(toCornerAngle(slab3d, phiMid - dPhi / 2));
    } else if (dz < AXIS_EPSILON) {
      // Near-horizontal strut: thin partial revolve across its angular span.
      const zMid = (za + zb) / 2;
      const phiA = phiOf(Math.min(ua, ub));
      const phiB = phiOf(Math.max(ua, ub));
      const slab3d = annularWedge(sr0, sr1, zMid - pw / 2, zMid + pw / 2, phiB - phiA);
      families[1].push(toCornerAngle(slab3d, phiA));
    } else if (zb - za > 0 === ub - ua > 0) {
      // Rising diagonal (φ and z increase together): rectangle swept along a
      // right-handed helix — the exact strut surface, and the construction
      // whose contacts with rib fillings are proven to sew in exports.
      const lowFirst = za <= zb;
      const [uLow, zLow] = lowFirst ? [ua, za] : [ub, zb];
      const [uHigh, zHigh] = lowFirst ? [ub, zb] : [ua, za];
      const dPhi = phiOf(uHigh) - phiOf(uLow);
      const height = zHigh - zLow;
      const pitch = (height * 2 * Math.PI) / Math.abs(dPhi);
      const spine = sketchHelix(pitch, height, rMid, [0, 0, zLow], [0, 0, 1], false);
      const swept = spine.sweepSketch(
        (plane) => drawRoundedRectangle(radialSpan, pw, 0).sketchOnPlane(plane),
        { frenet: true }
      );
      families[2].push(toCornerAngle(swept, phiOf(uLow)));
    } else {
      // Falling diagonal (φ decreases as z rises): needs a LEFT-handed helix,
      // but occt-wasm's makeHelixWire has no handedness input (the brepjs
      // left-handed flag is silently dropped — both flags produce the same
      // right-handed sweep), so the sweep landed in the mirrored angular span
      // and the wedge cut swallowed the true strut location (clipped pattern
      // + holes on every corner). brepjs `mirror` on a helical sweep yields
      // an empty solid, so instead approximate with straight chord boxes
      // split under CHORD_MAX_PHI (same construction as non-vertical
      // fillings; sagitta below print resolution).
      const phiA = phiOf(ua);
      const phiB = phiOf(ub);
      const steps = Math.max(1, Math.ceil(Math.abs(phiB - phiA) / CHORD_MAX_PHI));
      // Sub-chords overlap by a parameter margin — exactly-shared end planes
      // leave coplanar tool faces that crack the corner cylinder in exports.
      const tPad = steps > 1 ? 0.02 : 0;
      for (let i = 0; i < steps; i++) {
        const t0 = Math.max(0, i / steps - tPad);
        const t1 = Math.min(1, (i + 1) / steps + tPad);
        families[3].push(
          chordBoxStrut(
            phiA + (phiB - phiA) * t0,
            za + (zb - za) * t0,
            phiA + (phiB - phiA) * t1,
            za + (zb - za) * t1,
            pw,
            sr0,
            sr1
          )
        );
      }
    }
  }

  const strutsBuiltAt = performance.now();

  let cutter = wedge;
  let strutCount = 0;
  for (const family of families) {
    if (family.length === 0) continue;
    strutCount += family.length;
    const carved = unwrap(cutAll(cutter, family, { trackEvolution: false }));
    cutter.delete();
    for (const s of family) s.delete();
    cutter = carved;
  }

  perf?.recordWallPatternSubstep(
    'kumiko_corner_cut',
    performance.now() - strutsBuiltAt,
    strutCount
  );

  const angled = toCornerAngle(cutter, slab.thetaStart);
  const positioned = translate(angled, [slab.cx, slab.cy, 0]);
  angled.delete();
  return positioned;
}

/** Stamp-convention wall descriptor used to position clip boxes. */
function clipDescriptorFor(
  side: WallSide,
  innerW: number,
  innerD: number,
  patternCenterZ: number
): WallPatternDescriptor {
  const table: Record<WallSide, { tx: number; ty: number; rot?: number; span: number }> = {
    front: { tx: 0, ty: -innerD / 2, span: innerW },
    back: { tx: 0, ty: innerD / 2, rot: 180, span: innerW },
    left: { tx: -innerW / 2, ty: 0, rot: 90, span: innerD },
    right: { tx: innerW / 2, ty: 0, rot: -90, span: innerD },
  };
  const t = table[side];
  return {
    side,
    centers: [{ x: 0, y: 0 }],
    translateX: t.tx,
    translateY: t.ty,
    translateZ: patternCenterZ,
    zRotation: t.rot,
    wallSpan: t.span,
    allowClip: true,
  };
}

/** Resolve the wrapped-lattice calculator for the current params, if any. */
export function resolveKumikoCalculator(params: BinParams): WrappedLatticeCalculator | null {
  const wallPattern = params.wallPattern as typeof params.wallPattern | undefined;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for old saved data
  if (!wallPattern?.enabled || wallPattern.pattern === undefined) return null;
  if (!(wallPattern.pattern in PATTERN_REGISTRY)) return null;
  const scale = wallPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const calculator = getPatternCalculator(wallPattern.pattern, params.height, scale);
  return isWrappedLatticeCalculator(calculator) ? calculator : null;
}

/**
 * Wrapped kumiko cut targets plus the geometry identity of the whole set.
 *
 * `key` is empty when no kumiko cut applies, and otherwise fully identifies the
 * returned shapes: it composes the per-wall cache key the cutters are stored
 * under (which already captures the lattice, perimeter, selected sides and every
 * wall clip) with the post-cache interior offset. The resume cache in
 * `booleanStage` keys on this so a patterned bin can skip the whole boolean
 * stage on an edit that leaves the cut set unchanged.
 */
export interface KumikoWallPatternResult {
  readonly shapes: Shape3D[];
  readonly key: string;
}

/**
 * Build the wrapped kumiko pattern cut targets for the whole perimeter.
 * `shapes` is empty (and `key` blank) when no wrapped-lattice pattern applies
 * (stamp patterns and solid walls take the other paths).
 */
export function buildKumikoWallPatterns(ctx: PipelineContext): KumikoWallPatternResult {
  const { params, dimensions: dim, signal, originToTag, perfCollector } = ctx;
  const { innerW, innerD, innerOffsetX, innerOffsetY } = dim;
  const NONE: KumikoWallPatternResult = { shapes: [], key: '' };

  const calculator = resolveKumikoCalculator(params);
  if (!calculator) return NONE;

  // PR-1 scope: the wrap needs the rectangular perimeter; polygon footprints
  // and slotted walls fall back to solid walls for kumiko patterns.
  if (isPartialMask(params.cellMask)) return NONE;
  const slotFree = getSlotFreeWalls(params);
  if (!slotFree.front || !slotFree.back || !slotFree.left || !slotFree.right) return NONE;

  const wallThickness = params.wallThickness;
  const bottomKeepOut = wallThickness + BOTTOM_SOLID_SKIRT;
  const patternHeight = dim.interiorHeight - TOP_KEEP_OUT - bottomKeepOut;
  if (patternHeight < calculator.getMinPatternHeight()) return NONE;

  const outerW = innerW + 2 * wallThickness;
  const outerD = innerD + 2 * wallThickness;
  const cornerRadius = Math.min(BOX_CORNER_RADIUS, Math.min(outerW, outerD) / 2 - 0.1);
  if (cornerRadius <= 0.2) return NONE;

  const layout = computePerimeterLayout(outerW, outerD, innerW, innerD, cornerRadius);
  const lattice = calculator.getLattice({
    perimeter: layout.perimeter,
    bandHeight: patternHeight,
  });
  if (lattice.segments.length === 0) return NONE;

  const bandZ0 = bottomKeepOut;
  const patternCenterZ = bottomKeepOut + patternHeight / 2;
  const cutDepth = wallThickness * 4;
  const exact = getKernelCapabilities().exact;
  const patternType = calculator.getPatternType();
  const shapeRadius = calculator.getShapeRadius();

  const wallSides: readonly WallSide[] = ['front', 'right', 'back', 'left'];

  // Per-side selection. The lattice itself still spans the whole
  // perimeter — only which slabs get cut changes — so an unselected wall does
  // not shift the columns on the walls that stay patterned.
  const chosen = resolveWallPatternSides(params.wallPattern);
  const sideMask = wallSides.map((s) => (chosen[s] ? '1' : '0')).join('');

  const baseKey = compactKey(
    buildCacheKey(
      'kumiko-v1',
      patternType,
      sideMask,
      quantize(layout.perimeter),
      quantize(patternHeight),
      quantize(lattice.columnPitch),
      quantize(lattice.strutWidth),
      quantize(wallThickness),
      quantize(cornerRadius),
      quantize(outerW),
      quantize(outerD),
      quantize(patternCenterZ),
      exact ? 'wrap' : 'flat'
    )
  );

  const clipCtx = computeWallClipContext(params, dim, cutDepth);
  const wallClips = wallSides.map((side) => ({
    side,
    descriptor: clipDescriptorFor(side, innerW, innerD, patternCenterZ),
    clips: computeWallClips(
      params,
      dim,
      clipCtx,
      { side, wallSpan: side === 'front' || side === 'back' ? innerW : innerD, allowClip: true },
      shapeRadius
    ),
  }));

  const clippedKey = compactKey(
    buildCacheKey('v1', baseKey, ...wallClips.map((wc) => wc.clips.keyPart))
  );

  // Resume identity for the whole cut set: the per-wall cache key (lattice +
  // sides + clips) plus the interior offset applied after the cache. The cutter
  // count is deterministic from the layout the cache key already captures, so
  // this key changes whenever the emitted shapes would.
  const resumeKey = compactKey(
    buildCacheKey(clippedKey, 'off', quantize(innerOffsetX), quantize(innerOffsetY))
  );

  // The cutters stay SEPARATE all the way into the final pattern-cut boolean:
  // handing OCCT one whole-perimeter compound forces it to treat the tool set
  // as a single operand, defeating its per-tool bounding-box pruning (measured
  // 2.5× slower on the final cut). Cutter count is deterministic from the
  // layout, so both caches store one entry per slab index.
  // A corner needs BOTH its walls selected: cutting it while one neighbour
  // stays solid would leave the arc's struts landing on solid wall with nothing
  // to continue into. Leaving it solid is the same shape the draft kernel
  // already produces (corners are exact-only), so it's a proven-safe omission.
  const slabSelected = (s: PerimeterSlab): boolean =>
    s.kind === 'flat' ? chosen[s.side] : chosen[s.prevSide] && chosen[s.nextSide];
  const activeSlabs = layout.slabs.filter((s) => (s.kind === 'flat' || exact) && slabSelected(s));
  if (activeSlabs.length === 0) return NONE;
  // One planned cutter per flat window / corner — the plan is deterministic
  // from layout + lattice, so cache entries index it directly.
  const plan: Array<{ slab: PerimeterSlab; windowA: number; windowB: number }> = [];
  for (const slab of activeSlabs) {
    if (slab.kind === 'flat') {
      for (const [wa, wb] of flatWindows(slab, lattice)) {
        plan.push({ slab, windowA: wa, windowB: wb });
      }
    } else {
      plan.push({ slab, windowA: slab.u0, windowB: slab.u1 });
    }
  }
  const cacheGetAll = (cacheName: string, key: string): Shape3D[] | null => {
    const shapes: Shape3D[] = [];
    for (let i = 0; i < plan.length; i++) {
      const hit = getFeatureCache(cacheName, `${key}#${i}`);
      if (!hit) {
        for (const s of shapes) s.delete();
        return null;
      }
      shapes.push(hit);
    }
    return shapes;
  };
  const cacheSetAll = (cacheName: string, key: string, shapes: Shape3D[]): Shape3D[] => {
    return shapes.map((s, i) => {
      setFeatureCache(cacheName, `${key}#${i}`, s);
      return unwrap(clone(s));
    });
  };

  // Which walls' clip boxes can reach each slab: a flat sees its own wall's
  // clips; a corner sees both adjacent walls' (a full-width cutout border can
  // spill past the wall end into the corner region).
  const clipSidesFor = (slab: PerimeterSlab): readonly WallSide[] =>
    slab.kind === 'flat' ? [slab.side] : [slab.prevSide, slab.nextSide];
  const hasClips = (side: WallSide): boolean => {
    const wc = wallClips.find((w) => w.side === side);
    return (
      !!wc &&
      (wc.clips.clip !== null ||
        wc.clips.handleClip !== null ||
        wc.clips.rampClip !== null ||
        wc.clips.textClip !== null ||
        // Without this a bin whose ONLY clip is the sliding-tray keep-out
        // skips the clipping pass altogether and the pattern eats the rail.
        wc.clips.slideClip !== null)
    );
  };
  const anyClips = wallSides.some(hasClips);

  const buildStart = perfCollector ? performance.now() : 0;
  let shapes = anyClips ? cacheGetAll(KUMIKO_WRAP_CLIPPED_CACHE, clippedKey) : null;
  const cacheHit = shapes !== null;
  if (!shapes) {
    let baseShapes = cacheGetAll(KUMIKO_WRAP_BASE_CACHE, baseKey);
    if (!baseShapes) {
      const cutters: Shape3D[] = [];
      for (const entry of plan) {
        checkCancelled(signal);
        const slabStart = perfCollector ? performance.now() : 0;
        if (entry.slab.kind === 'flat') {
          const cutter = buildFlatSlabCutter(
            entry.slab,
            lattice,
            bandZ0,
            patternHeight,
            cutDepth,
            patternCenterZ,
            layout.perimeter,
            entry.windowA,
            entry.windowB
          );
          if (!cutter) {
            for (const c of cutters) c.delete();
            return NONE;
          }
          cutters.push(cutter);
          if (perfCollector) {
            perfCollector.recordWallPatternSubstep(
              `kumiko_flat_${entry.slab.side}`,
              performance.now() - slabStart
            );
          }
        } else {
          cutters.push(
            buildCornerSlabCutter(
              entry.slab,
              lattice,
              bandZ0,
              patternHeight,
              layout.cornerRadius,
              wallThickness,
              layout.perimeter,
              perfCollector
            )
          );
          if (perfCollector) {
            perfCollector.recordWallPatternSubstep('kumiko_corner', performance.now() - slabStart);
          }
        }
      }
      baseShapes = cacheSetAll(KUMIKO_WRAP_BASE_CACHE, baseKey, cutters);
    }

    // Route each wall's clip boxes to the cutters they can reach. Clip boxes
    // are positioned in world space, so applyWallPatternClips works per
    // cutter; slabs out of a box's reach cost one cheap disjoint-bbox cut.
    shapes = baseShapes;
    if (anyClips) {
      const clipped: Shape3D[] = [];
      let failed = false;
      for (let i = 0; i < baseShapes.length; i++) {
        let current: Shape3D | null = baseShapes[i];
        for (const side of clipSidesFor(plan[i].slab)) {
          if (!current || !hasClips(side)) continue;
          checkCancelled(signal);
          const wc = wallClips.find((w) => w.side === side);
          if (!wc) continue;
          current = applyWallPatternClips(
            current,
            wc.descriptor,
            wc.clips.clip,
            wc.clips.handleClip,
            wc.clips.rampClip,
            wc.clips.textClip,
            wc.clips.slideClip
          );
        }
        if (!current) {
          failed = true;
          break;
        }
        clipped.push(current);
      }
      if (failed) {
        for (const s of clipped) s.delete();
        return NONE;
      }
      shapes = cacheSetAll(KUMIKO_WRAP_CLIPPED_CACHE, clippedKey, clipped);
    }
  }
  if (perfCollector) {
    perfCollector.recordWallPatternSubstep(
      cacheHit ? 'kumiko_hit' : 'kumiko_build',
      performance.now() - buildStart,
      lattice.segments.length
    );
    perfCollector.setPatternCutToolCount(shapes.length);
  }

  const placedShapes = shapes.map((cutter) => {
    let placed = cutter;
    if (innerOffsetX !== 0 || innerOffsetY !== 0) {
      const old = placed;
      placed = translate(old, [innerOffsetX, innerOffsetY, 0]);
      old.delete();
    }
    collectOrigins(placed, FeatureTag.WALL_PATTERN, originToTag);
    return placed;
  });
  return { shapes: placedShapes, key: resumeKey };
}
