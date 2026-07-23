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
 *     partial revolves, diagonal struts swept along a helix (a straight line
 *     in unrolled space IS a helix on the corner cylinder).
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
  compound,
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
import type { WallPatternDescriptor } from './wallPatterns';
import { getSlotFreeWalls, TOP_KEEP_OUT, BOTTOM_SOLID_SKIRT } from './wallPatterns';
import { getPatternCalculator, isWrappedLatticeCalculator, PATTERN_REGISTRY } from './patterns';
import type { KumikoLattice, KumikoSegment, WrappedLatticeCalculator } from './patterns';
import { BOX_CORNER_RADIUS } from './generatorConstants';
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

interface FlatSlab {
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
  const corner = (cx: number, cy: number, thetaStart: number): void => {
    slabs.push({ kind: 'corner', u0: u, u1: u + arc, cx, cy, thetaStart });
    u += arc;
  };

  flat('front', flatW, 0, 0, -innerD / 2);
  corner(outerW / 2 - r, -outerD / 2 + r, -Math.PI / 2);
  flat('right', flatD, 90, innerW / 2, 0);
  corner(outerW / 2 - r, outerD / 2 - r, 0);
  flat('back', flatW, 180, 0, innerD / 2);
  corner(-outerW / 2 + r, outerD / 2 - r, Math.PI / 2);
  flat('left', flatD, 270, -innerW / 2, 0);
  corner(-outerW / 2 + r, -outerD / 2 + r, Math.PI);

  return { perimeter: u, slabs, cornerRadius: r };
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
      shift === 0 ? seg : { a: [seg.a[0] + shift, seg.a[1]], b: [seg.b[0] + shift, seg.b[1]] };
    const clipped = clipSegmentToURange(shifted, u0, u1);
    if (clipped) pieces.push(clipped);
  }
  return pieces;
}

/** Extend both segment endpoints along its direction (square end caps). */
function extendSegment(seg: KumikoSegment, by: number): KumikoSegment {
  const [ua, za] = seg.a;
  const [ub, zb] = seg.b;
  const len = Math.hypot(ub - ua, zb - za);
  if (len < 1e-9) return seg;
  const dx = ((ub - ua) / len) * by;
  const dz = ((zb - za) / len) * by;
  return { a: [ua - dx, za - dz], b: [ub + dx, zb + dz] };
}

/** Stroke a segment into a Drawing rectangle in slab-local (a, y) coords. */
function strokeSegment(
  seg: KumikoSegment,
  width: number,
  uCenter: number,
  zCenter: number
): Drawing {
  const [ua, za] = seg.a;
  const [ub, zb] = seg.b;
  const len = Math.hypot(ub - ua, zb - za);
  const angleDeg = Math.atan2(zb - za, ub - ua) * RAD_TO_DEG;
  return drawRoundedRectangle(len + width, width, 0)
    .rotate(angleDeg, [0, 0])
    .translate((ua + ub) / 2 - uCenter, (za + zb) / 2 - zCenter);
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
function buildFlatSlabCutter(
  slab: FlatSlab,
  lattice: KumikoLattice,
  bandZ0: number,
  bandHeight: number,
  cutDepth: number,
  patternCenterZ: number,
  perimeter: number
): Shape3D | null {
  const w = lattice.strutWidth;
  const u0 = slab.u0 - SLAB_OVERLAP;
  const u1 = slab.u1 + SLAB_OVERLAP;
  const uCenter = (slab.u0 + slab.u1) / 2;
  const zCenter = bandZ0 + bandHeight / 2;
  const halfDepth = cutDepth / 2;
  // Struts pierce the slab in depth so no strut face is coplanar with it.
  const strutDepth = cutDepth + 2;

  const struts: Shape3D[] = [];
  for (const seg of lattice.segments) {
    for (const clipped of clipSegmentToURangePeriodic(seg, u0 - w, u1 + w, perimeter)) {
      // z is band-local in the lattice; shift to absolute before centering.
      const absolute: KumikoSegment = {
        a: [clipped.a[0], clipped.a[1] + bandZ0],
        b: [clipped.b[0], clipped.b[1] + bandZ0],
      };
      const drawing = strokeSegment(extendSegment(absolute, w / 2), w, uCenter, zCenter);
      const prism = sketch(drawing, 'XY').extrude(strutDepth);
      struts.push(translate(prism, [0, 0, -strutDepth / 2]));
      prism.delete();
    }
  }
  if (struts.length === 0) return null;

  const slabPrism = sketch(drawRoundedRectangle(u1 - u0, bandHeight, 0), 'XY').extrude(cutDepth);
  let region = translate(slabPrism, [0, 0, -halfDepth]);
  slabPrism.delete();

  // One n-ary boolean: subtracting the strut prisms directly is far cheaper
  // than fusing ~40 overlapping tools first and cutting the union.
  const carved = unwrap(cutAll(region, struts));
  region.delete();
  for (const s of struts) s.delete();
  region = carved;

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
  perimeter: number
): Shape3D {
  const w = lattice.strutWidth;
  const bandZ1 = bandZ0 + bandHeight;
  // Cutter radial reach mirrors the flat cutter's ±2·wallThickness overshoot
  // around the wall; struts extend 1mm further so they always survive the cut.
  const rIn = Math.max(outerRadius - wallThickness, 0.3);
  const rc0 = Math.max(rIn - 2 * wallThickness, 0.1);
  const rc1 = outerRadius + 2 * wallThickness;
  const sr0 = Math.max(rc0 - 1, 0.05);
  const sr1 = rc1 + 1;
  const rMid = (sr0 + sr1) / 2;
  const radialSpan = sr1 - sr0;
  const phiOf = (u: number): number => (u - slab.u0) / outerRadius;

  const wedge = annularWedge(rc0, rc1, bandZ0, bandZ1, Math.PI / 2);

  const struts: Shape3D[] = [];
  const pieces: KumikoSegment[] = [];
  for (const seg of lattice.segments) {
    pieces.push(...clipSegmentToURangePeriodic(seg, slab.u0 - w, slab.u1 + w, perimeter));
  }
  for (const clipped of pieces) {
    const capped = extendSegment(clipped, w / 2);
    const [ua, zaRel] = capped.a;
    const [ub, zbRel] = capped.b;
    const za = zaRel + bandZ0;
    const zb = zbRel + bandZ0;
    const du = Math.abs(ub - ua);
    const dz = Math.abs(zb - za);

    if (du < AXIS_EPSILON) {
      // Vertical strut: small-angle revolve so both faces are radial planes.
      const dPhi = w / outerRadius;
      const phiMid = phiOf((ua + ub) / 2);
      const slab3d = annularWedge(sr0, sr1, Math.min(za, zb), Math.max(za, zb), dPhi);
      struts.push(toCornerAngle(slab3d, phiMid - dPhi / 2));
    } else if (dz < AXIS_EPSILON) {
      // Near-horizontal strut: thin partial revolve across its angular span.
      const zMid = (za + zb) / 2;
      const phiA = phiOf(Math.min(ua, ub));
      const phiB = phiOf(Math.max(ua, ub));
      const slab3d = annularWedge(sr0, sr1, zMid - w / 2, zMid + w / 2, phiB - phiA);
      struts.push(toCornerAngle(slab3d, phiA));
    } else {
      // Diagonal strut: rectangle swept along a helix. Base the helix at the
      // lower endpoint; it winds left-handed when φ decreases as z rises.
      const lowFirst = za <= zb;
      const [uLow, zLow] = lowFirst ? [ua, za] : [ub, zb];
      const [uHigh, zHigh] = lowFirst ? [ub, zb] : [ua, za];
      const dPhi = phiOf(uHigh) - phiOf(uLow);
      const height = zHigh - zLow;
      const pitch = (height * 2 * Math.PI) / Math.abs(dPhi);
      const spine = sketchHelix(pitch, height, rMid, [0, 0, zLow], [0, 0, 1], dPhi < 0);
      const swept = spine.sweepSketch(
        (plane) => drawRoundedRectangle(radialSpan, w, 0).sketchOnPlane(plane),
        { frenet: true }
      );
      struts.push(toCornerAngle(swept, phiOf(uLow)));
    }
  }

  let cutter = wedge;
  if (struts.length > 0) {
    const carved = unwrap(cutAll(cutter, struts));
    cutter.delete();
    for (const s of struts) s.delete();
    cutter = carved;
  }

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
function resolveKumikoCalculator(params: BinParams): WrappedLatticeCalculator | null {
  const wallPattern = params.wallPattern as typeof params.wallPattern | undefined;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for old saved data
  if (!wallPattern?.enabled || wallPattern.pattern === undefined) return null;
  if (!(wallPattern.pattern in PATTERN_REGISTRY)) return null;
  const scale = wallPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const calculator = getPatternCalculator(wallPattern.pattern, params.height, scale);
  return isWrappedLatticeCalculator(calculator) ? calculator : null;
}

/**
 * Build the wrapped kumiko pattern cut targets for the whole perimeter.
 * Returns [] when no wrapped-lattice pattern applies (stamp patterns and
 * solid walls take the other paths).
 */
export function buildKumikoWallPatterns(ctx: PipelineContext): Shape3D[] {
  const { params, dimensions: dim, signal, originToTag, perfCollector } = ctx;
  const { innerW, innerD, innerOffsetX, innerOffsetY } = dim;

  const calculator = resolveKumikoCalculator(params);
  if (!calculator) return [];

  // PR-1 scope: the wrap needs the rectangular perimeter; polygon footprints
  // and slotted walls fall back to solid walls for kumiko patterns.
  if (isPartialMask(params.cellMask)) return [];
  const slotFree = getSlotFreeWalls(params);
  if (!slotFree.front || !slotFree.back || !slotFree.left || !slotFree.right) return [];

  const wallThickness = params.wallThickness;
  const bottomKeepOut = wallThickness + BOTTOM_SOLID_SKIRT;
  const patternHeight = dim.interiorHeight - TOP_KEEP_OUT - bottomKeepOut;
  if (patternHeight < calculator.getMinPatternHeight()) return [];

  const outerW = innerW + 2 * wallThickness;
  const outerD = innerD + 2 * wallThickness;
  const cornerRadius = Math.min(BOX_CORNER_RADIUS, Math.min(outerW, outerD) / 2 - 0.1);
  if (cornerRadius <= 0.2) return [];

  const layout = computePerimeterLayout(outerW, outerD, innerW, innerD, cornerRadius);
  const lattice = calculator.getLattice({
    perimeter: layout.perimeter,
    bandHeight: patternHeight,
  });
  if (lattice.segments.length === 0) return [];

  const bandZ0 = bottomKeepOut;
  const patternCenterZ = bottomKeepOut + patternHeight / 2;
  const cutDepth = wallThickness * 4;
  const exact = getKernelCapabilities().exact;
  const patternType = calculator.getPatternType();
  const shapeRadius = calculator.getShapeRadius();

  const baseKey = compactKey(
    buildCacheKey(
      'kumiko-v1',
      patternType,
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
  const wallSides: readonly WallSide[] = ['front', 'right', 'back', 'left'];
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

  const buildStart = perfCollector ? performance.now() : 0;
  let shape = getFeatureCache(KUMIKO_WRAP_CLIPPED_CACHE, clippedKey);
  const cacheHit = shape !== null;
  if (!shape) {
    let base = getFeatureCache(KUMIKO_WRAP_BASE_CACHE, baseKey);
    if (!base) {
      const cutters: Shape3D[] = [];
      for (const slab of layout.slabs) {
        checkCancelled(signal);
        if (slab.kind === 'flat') {
          const cutter = buildFlatSlabCutter(
            slab,
            lattice,
            bandZ0,
            patternHeight,
            cutDepth,
            patternCenterZ,
            layout.perimeter
          );
          if (cutter) cutters.push(cutter);
        } else if (exact) {
          cutters.push(
            buildCornerSlabCutter(
              slab,
              lattice,
              bandZ0,
              patternHeight,
              layout.cornerRadius,
              wallThickness,
              layout.perimeter
            )
          );
        }
      }
      if (cutters.length === 0) return [];
      const grouped = cutters.length === 1 ? cutters[0] : compound(cutters);
      if (cutters.length > 1) for (const c of cutters) c.delete();
      setFeatureCache(KUMIKO_WRAP_BASE_CACHE, baseKey, grouped);
      base = unwrap(clone(grouped));
    }

    // Clip boxes are positioned in world space per wall, so they apply
    // directly to the whole-perimeter compound — including the corner
    // cutters when a cutout border reaches past a wall end.
    let current: Shape3D | null = base;
    for (const wc of wallClips) {
      checkCancelled(signal);
      if (!current) break;
      current = applyWallPatternClips(
        current,
        wc.descriptor,
        wc.clips.clip,
        wc.clips.handleClip,
        wc.clips.rampClip,
        wc.clips.textClip
      );
    }
    if (!current) return [];
    setFeatureCache(KUMIKO_WRAP_CLIPPED_CACHE, clippedKey, current);
    shape = unwrap(clone(current));
  }
  if (perfCollector) {
    perfCollector.recordWallPatternSubstep(
      cacheHit ? 'kumiko_hit' : 'kumiko_build',
      performance.now() - buildStart,
      lattice.segments.length
    );
    perfCollector.setPatternCutToolCount(1);
  }

  if (innerOffsetX !== 0 || innerOffsetY !== 0) {
    const old = shape;
    shape = translate(old, [innerOffsetX, innerOffsetY, 0]);
    old.delete();
  }
  collectOrigins(shape, FeatureTag.WALL_PATTERN, originToTag);
  return [shape];
}
