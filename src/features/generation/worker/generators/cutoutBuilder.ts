/**
 * Cutout cavity builder for solid-mode Gridfinity bins.
 *
 * Generates cutout shapes (rectangle, circle, path) that are boolean-subtracted
 * from the solid fill surface. Supports grouped cutouts with adaptive scoop fillets
 * and ungrouped cutouts with individual fillets.
 */

/* eslint-disable max-lines -- Cohesive cutout geometry builder; the boolean grouping, adaptive
   scoop fillets, and path/shape construction share local helpers and geometry invariants.
   Splitting these print-critical paths for a soft line-count limit risks regressions; kept
   together deliberately. */

import {
  draw,
  drawRoundedRectangle,
  box,
  cylinder,
  unwrap,
  translate,
  fillet,
  intersect,
  cut,
  rotate,
  edgeFinder,
  getBounds,
  isOk,
  curveLength,
  clone,
  withScope,
  composeTransforms,
  transformCopy,
  setShapeOrigin,
} from 'brepjs';
import type { TransformOp, Bounds3D } from 'brepjs';
import type { Shape3D, ValidSolid, Edge, Dimension, DisposalScope, Drawing, Sketch } from 'brepjs';
import type { BinParams, Cutout, CutoutArrayConfig, PathPoint, GroupOp } from '@/shared/types/bin';
import { DEFAULT_KNIFE_SPEC } from '@/shared/types/bin';
import { LIP_HEIGHT, CUT_RIM_CLEARANCE } from './generatorConstants';
import { isCutoutEngraveMode } from '@/shared/utils/cutoutLabelSocketPlan';
import {
  MIN_PATH_POINTS,
  DEFAULT_GROUP_OP,
  DEFAULT_POLYGON_SIDES,
  CLEARANCE_SHAPES,
  CHAMFER_SHAPES,
  resolveCutoutLeanDeg,
} from '@/shared/types/bin';
import {
  regularPolygonPoints,
  slotCornerRadius,
  clampPolygonSides,
} from '@/shared/utils/cutoutPolygon';
import {
  arrayInstances,
  expandCutoutArray,
  groupRepeatConfig,
  labelledInstances,
} from '@/shared/utils/cutoutArray';
import { dropCoincidentPoints } from '@/shared/utils/polyline';
import { pointInPolyline } from '@/shared/utils/drawerOutlineGeometry';
import {
  cutoutLabelPlacement,
  expandBandToInterior,
  fitLabelRoom,
  hasExplicitLabelSize,
  withCenteredTextPlacement,
} from '@/shared/utils/cutoutLabel';
import { combineGroupSolids } from './cutoutGroupOps';
import {
  resolveScoop,
  maxOwnerAxisRadius,
  classifyAxisRadius,
  type ResolvedScoop,
} from './cutoutScoopHelpers';
import { sketch } from './meshUtils';
import { buildTextSolid } from './textBuilder';
import { resolveTextStyle, ZERO_TEXT_OFFSET } from '@/shared/types/bin';
import { offsetClosedPolygon } from './polygonOffset';
import { buildTaperedInnerEnvelope } from './taperedOuter';
import type { ResolvedTaper } from './overhang';
import { FeatureTag } from './featureTags';
import {
  enumerateCutoutColorUnits,
  cutoutUnitKey,
  cutoutColorTag,
} from '@/shared/generation/cutoutColorUnits';
/** Axis-aligned bounding box in XY. */
export interface AABB {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}
/**
 * Build a rotation-safe AABB for a positioned cutout member.
 * Uses the member's diagonal as a safe half-extent to account for any rotation.
 */
function computeRotationSafeAABB(cx: number, cy: number, width: number, depth: number): AABB {
  const diag = Math.sqrt(width ** 2 + depth ** 2) / 2;
  return { minX: cx - diag, minY: cy - diag, maxX: cx + diag, maxY: cy + diag };
}

/**
 * Vertex count for the polygonal circle/ellipse approximation.
 *
 * brepjs's `drawEllipse` yields a single periodic edge with no vertices. That
 * breaks two kernel ops: extruding it produces an invalid (non-solid) prism,
 * and `loftWith({ ruled: true })` has nothing to rule between. In both cases the
 * resulting shape is dropped by the downstream boolean, so the cut silently
 * no-ops while the bin stays valid. A fine polygon gives explicit vertices the
 * extrude and ruled loft both need (the same reason polygon/slot/rectangle cut
 * fine); 64 sides is visually smooth at print scale.
 */
const ELLIPSE_SEGMENTS = 64;

/** Closed fine-polygon approximation of an ellipse (semi-axes rx, ry), centered at origin. */
function ellipsePolygonDrawing(rx: number, ry: number): Drawing {
  let pen = draw([rx, 0]);
  for (let i = 1; i < ELLIPSE_SEGMENTS; i++) {
    const a = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
    pen = pen.lineTo([rx * Math.cos(a), ry * Math.sin(a)]);
  }
  return pen.close();
}

/**
 * 2D outline for a parametric cutout shape, centered at origin. Used by the
 * chamfer loft. Paths are not parametric and are handled separately.
 */
function cutoutProfileDrawing(p: {
  readonly shape: string;
  readonly w: number;
  readonly d: number;
  readonly cornerRadius: number;
  readonly sides?: number;
}): Drawing {
  switch (p.shape) {
    case 'circle':
      return ellipsePolygonDrawing(p.w / 2, p.d / 2);
    case 'polygon': {
      const pts = regularPolygonPoints(
        clampPolygonSides(p.sides ?? DEFAULT_POLYGON_SIDES),
        p.w,
        p.d
      );
      // Mirror the straight-extrude path's guard: a degenerate vertex set
      // (zero-size box) falls back to a bounding-box rect rather than crashing
      // the kernel on an empty wire.
      if (pts.length < 3) return drawRoundedRectangle(p.w, p.d, 0.01);
      let pen = draw([pts[0].x, pts[0].y]);
      for (let i = 1; i < pts.length; i++) pen = pen.lineTo([pts[i].x, pts[i].y]);
      return pen.close();
    }
    case 'slot':
    case 'knifeSlot':
      return drawRoundedRectangle(p.w, p.d, Math.max(0.01, slotCornerRadius(p.w, p.d) - 0.01));
    case 'rectangle':
    default: {
      // Sharp corners when no radius is requested. A 0.01mm "rounded" corner is
      // a near-degenerate arc; lofting it leaves a pinched corner seam that a
      // later scoop fillet corrupts into open sliver faces at the flared rim
      // (GH). A true four-line rectangle gives the loft clean corner edges
      // the fillet blends cleanly, exactly like the non-chamfered box path.
      if (p.cornerRadius <= 0) {
        const hw = p.w / 2;
        const hd = p.d / 2;
        return draw([-hw, -hd]).lineTo([hw, -hd]).lineTo([hw, hd]).lineTo([-hw, hd]).close();
      }
      const maxCR = Math.min(p.w, p.d) / 2 - 0.01;
      return drawRoundedRectangle(p.w, p.d, Math.min(p.cornerRadius, maxCR));
    }
  }
}

/**
 * Extra tool length past the mouth (z = cutDepth), along the axis, that a
 * leaned tool needs so its tilted top still covers the whole drawn footprint
 * at the mouth plane — otherwise the down-tilted side leaves a material hood
 * overhanging the opening. The interior clip trims whatever ends up above the
 * fill surface, so the margin only has to be sufficient, not exact.
 */
function leanTopExtension(leanDeg: number, localDepth: number): number {
  if (leanDeg === 0) return 0;
  return (localDepth / 2) * Math.abs(Math.tan((leanDeg * Math.PI) / 180)) + 1;
}

/**
 * Tilt a finished tool about its own mouth: rotate about the local X axis
 * through (0, 0, mouthZ), so the opening stays put and the floor travels along
 * local +Y for positive angles. Applied after the scoop fillet (the scooped
 * floor tilts with the pocket) and before the plan rotation (which carries the
 * tilt to any direction). Consumes `shape`.
 */
function applyCutoutLean(shape: Shape3D, leanDeg: number, mouthZ: number): Shape3D {
  if (leanDeg === 0) return shape;
  const leaned = rotate(shape, leanDeg, { at: [0, 0, mouthZ], axis: [1, 0, 0] });
  shape.delete();
  return leaned;
}

/**
 * Entry-chamfer cutout: a straight prism that flares outward over the top
 * `chamfer` mm so the opening is a ~45° countersink (bits self-center). Built
 * as a 3-section ruled loft — nominal at the bottom, nominal again at
 * `cutDepth − chamfer`, then the outset profile at the top rim. The outset
 * grows each bounding dimension by `2·chamfer` (and the corner radius by
 * `chamfer`), matching the vertical drop for a true 45° bevel.
 *
 * `topExtension` (leaned tools) continues the flared rim profile straight up
 * past the mouth as a fourth section, so the countersink stays at the mouth
 * while the extension keeps the tilted opening fully clear.
 */
function buildChamferedCutoutShape(p: {
  readonly shape: string;
  readonly w: number;
  readonly d: number;
  readonly cornerRadius: number;
  readonly sides?: number;
  readonly cutDepth: number;
  readonly chamfer: number;
  readonly topExtension: number;
}): Shape3D {
  const profile = (w: number, dd: number, cr: number, z: number): Sketch =>
    cutoutProfileDrawing({
      shape: p.shape,
      w,
      d: dd,
      cornerRadius: cr,
      sides: p.sides,
    }).sketchOnPlane('XY', z) as Sketch;

  const base = profile(p.w, p.d, p.cornerRadius, 0);
  const straightTop = profile(p.w, p.d, p.cornerRadius, p.cutDepth - p.chamfer);
  const flaredW = p.w + 2 * p.chamfer;
  const flaredD = p.d + 2 * p.chamfer;
  const flaredCR = p.cornerRadius + p.chamfer;
  const flared = profile(flaredW, flaredD, flaredCR, p.cutDepth);
  const sections = [straightTop, flared];
  if (p.topExtension > 0) {
    sections.push(profile(flaredW, flaredD, flaredCR, p.cutDepth + p.topExtension));
  }
  return base.loftWith(sections, { ruled: true });
}

/** Create an extruded cutout shape centered at origin, **without rotation**.
 *  Splitting out rotation lets callers apply axis-aware fillets in the
 *  cutout's canonical local frame (W along X, D along Y) before rotating.
 *  Returns null if dimensions are degenerate (would crash WASM).
 */
function buildUnrotatedCutoutShape(cutout: {
  readonly shape: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly cutDepth: number;
  readonly cornerRadius: number;
  readonly sides?: number;
  readonly clearance?: number;
  readonly chamferWidth?: number;
  readonly leanDeg?: number;
  readonly path?: readonly PathPoint[];
}): Shape3D | null {
  if (cutout.cutDepth <= 0 || cutout.width <= 0 || cutout.depth <= 0) return null;

  // Insertion clearance enlarges the cut symmetrically about its own center so a
  // part cut to spec drops in. The cutout stays positioned by its nominal
  // center (cutout.x + cutout.width/2), so the enlarged shape stays aligned.
  // Missing clearance / non-insert shapes keep their exact nominal size.
  const clearance =
    (CLEARANCE_SHAPES as readonly string[]).includes(cutout.shape) && cutout.clearance !== undefined
      ? Math.max(0, cutout.clearance)
      : 0;
  const d = cutout.depth + clearance;
  // Polygons scale uniformly (across-flats = depth grows by clearance) so the
  // result stays a *regular* N-gon; a flat additive box offset would skew the
  // width/depth ratio. Other shapes use a symmetric additive offset.
  const w =
    cutout.shape === 'polygon' && cutout.depth > 0
      ? cutout.width * (d / cutout.depth)
      : cutout.width + clearance;

  // Entry chamfer: flare the top rim. Clamp so a straight wall always remains
  // below the bevel (loft needs cutDepth − chamfer > 0).
  const chamfer =
    (CHAMFER_SHAPES as readonly string[]).includes(cutout.shape) && cutout.chamferWidth
      ? Math.max(0, Math.min(cutout.chamferWidth, cutout.cutDepth - 0.2))
      : 0;

  // Leaned tools carry extra length past the mouth so the tilted top still
  // clears the whole opening; the interior clip trims the excess. `d` (with
  // clearance) is the local extent the tilt sweeps, whatever the shape.
  const topExt = leanTopExtension(resolveCutoutLeanDeg(cutout), d);
  const fullDepth = cutout.cutDepth + topExt;

  if (chamfer > 0.05) {
    if (cutout.shape === 'path') {
      // Paths can't use the parametric profile loft; flatten + offset the outline
      // for the flared rim. On any failure, fall through to a straight extrude.
      try {
        return buildChamferedPathShape(cutout, chamfer, clearance, topExt);
      } catch {
        /* fall through to the straight `case 'path'` below */
      }
    } else {
      return buildChamferedCutoutShape({
        shape: cutout.shape,
        w,
        d,
        cornerRadius: cutout.cornerRadius,
        sides: cutout.sides,
        cutDepth: cutout.cutDepth,
        chamfer,
        topExtension: topExt,
      });
    }
  }

  switch (cutout.shape) {
    case 'circle': {
      const rx = w / 2;
      const ry = d / 2;
      // True circle → smooth cylinder. Ellipse (rx≠ry) → polygon prism: a
      // `drawEllipse` extrude produces an invalid solid that the boolean drops,
      // so the cut silently no-ops (see ELLIPSE_SEGMENTS).
      return Math.abs(rx - ry) < 0.01
        ? cylinder(rx, fullDepth)
        : sketch(ellipsePolygonDrawing(rx, ry), 'XY').extrude(fullDepth);
    }
    case 'polygon': {
      const pts = regularPolygonPoints(
        clampPolygonSides(cutout.sides ?? DEFAULT_POLYGON_SIDES),
        w,
        d
      );
      if (pts.length < 3) {
        return box(w, d, fullDepth, { at: [0, 0, fullDepth / 2] });
      }
      let pen = draw([pts[0].x, pts[0].y]);
      for (let i = 1; i < pts.length; i++) pen = pen.lineTo([pts[i].x, pts[i].y]);
      return sketch(pen.close(), 'XY').extrude(fullDepth);
    }
    case 'slot':
    case 'knifeSlot': {
      // Back the radius off the exact half-short-side by a hair: an exact
      // half-height radius makes drawRoundedRectangle emit a degenerate
      // zero-length straight segment on the short edges, which OCCT rejects.
      const r = Math.max(0.01, slotCornerRadius(w, d) - 0.01);
      return sketch(drawRoundedRectangle(w, d, r), 'XY').extrude(fullDepth);
    }
    case 'path': {
      try {
        return buildPathCutoutShape({ ...cutout, cutDepth: fullDepth }, clearance);
      } catch {
        // Self-intersecting or degenerate path — fall back to bounding box rectangle
        return box(cutout.width, cutout.depth, fullDepth, {
          at: [0, 0, fullDepth / 2],
        });
      }
    }
    case 'rectangle':
    default: {
      if (cutout.cornerRadius > 0) {
        const maxCR = Math.min(cutout.width, cutout.depth) / 2 - 0.01;
        return sketch(
          drawRoundedRectangle(cutout.width, cutout.depth, Math.min(cutout.cornerRadius, maxCR)),
          'XY'
        ).extrude(fullDepth);
      }
      return box(cutout.width, cutout.depth, fullDepth, {
        at: [0, 0, fullDepth / 2],
      });
    }
  }
}

/** Create an extruded + rotated cutout shape centered at origin (no translation).
 *  Returns null if dimensions are degenerate (would crash WASM).
 */
function buildCutoutShape(cutout: {
  readonly shape: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly cutDepth: number;
  readonly rotation: number;
  readonly cornerRadius: number;
  readonly sides?: number;
  readonly clearance?: number;
  readonly chamferWidth?: number;
  readonly leanDeg?: number;
  readonly path?: readonly PathPoint[];
}): Shape3D | null {
  let shape = buildUnrotatedCutoutShape(cutout);
  if (!shape) return null;

  shape = applyCutoutLean(shape, resolveCutoutLeanDeg(cutout), cutout.cutDepth);

  if (cutout.rotation !== 0) {
    const rotated = rotate(shape, -cutout.rotation, { axis: [0, 0, 1] });
    shape.delete();
    shape = rotated;
  }

  return shape;
}
/** Centered, flattened, validated outline for a path cutout (or null if degenerate). */
function pathOutline(cutout: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly path?: readonly PathPoint[];
}): Array<{ x: number; y: number }> | null {
  const path = cutout.path;
  if (!path || path.length < MIN_PATH_POINTS) return null;
  const polyline = dropCoincidentPoints(flattenPathToPolyline(path));
  if (polyline.length < 3 || polylineSelfIntersects(polyline)) return null;
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  return polyline.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

/**
 * Outset a centered outline by `d` (insertion clearance / chamfer flare). Returns
 * the input unchanged for d<=0, or null when the offset degenerates (self-cross
 * or vertex-count change) so callers can decide how to fall back.
 */
function offsetPathOutline(
  outline: readonly { x: number; y: number }[],
  d: number
): Array<{ x: number; y: number }> | null {
  if (d <= 0) return outline.map((p) => ({ x: p.x, y: p.y }));
  const out = offsetClosedPolygon(outline, d);
  if (out.length !== outline.length || polylineSelfIntersects(out)) return null;
  return out;
}

export function pathWire(pts: readonly { x: number; y: number }[]): Drawing {
  let pen = draw([pts[0].x, pts[0].y]);
  for (let i = 1; i < pts.length; i++) pen = pen.lineTo([pts[i].x, pts[i].y]);
  return pen.close();
}

/**
 * Build an extruded path cutout from bezier path points. Flattens curves to a
 * polyline, applies the insertion `clearance` (outward offset), and extrudes the
 * closed wire. Falls back to a bbox rect for a degenerate outline, and to the
 * un-offset outline if the clearance offset can't be built.
 */
function buildPathCutoutShape(
  cutout: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly depth: number;
    readonly cutDepth: number;
    readonly path?: readonly PathPoint[];
  },
  clearance: number
): Shape3D {
  const outline = pathOutline(cutout);
  if (!outline) {
    return box(cutout.width, cutout.depth, cutout.cutDepth, { at: [0, 0, cutout.cutDepth / 2] });
  }
  const grown = offsetPathOutline(outline, clearance) ?? outline;
  return sketch(pathWire(grown), 'XY').extrude(cutout.cutDepth);
}

/**
 * Entry-chamfered path cutout: a 3-section ruled loft (clearance-offset base →
 * same at `cutDepth − chamfer` → base offset outward by `chamfer` at the top
 * rim), so a freeform outline gets the same ~45° self-centering countersink as
 * the parametric shapes. Throws on degenerate input or a bad offset so the
 * caller can fall back to a straight (clearance-only) extrude.
 */
function buildChamferedPathShape(
  cutout: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly depth: number;
    readonly cutDepth: number;
    readonly path?: readonly PathPoint[];
  },
  chamfer: number,
  clearance: number,
  topExtension: number
): Shape3D {
  const outline = pathOutline(cutout);
  if (!outline) throw new Error('path: degenerate');
  // Base carries the clearance; the flared rim is offset a further `chamfer`.
  const base = offsetPathOutline(outline, clearance);
  const flared = offsetPathOutline(outline, clearance + chamfer);
  if (!base || !flared) throw new Error('path: bad offset');

  const baseSketch = pathWire(base).sketchOnPlane('XY', 0) as Sketch;
  const straightTop = pathWire(base).sketchOnPlane('XY', cutout.cutDepth - chamfer) as Sketch;
  const flaredTop = pathWire(flared).sketchOnPlane('XY', cutout.cutDepth) as Sketch;
  const sections = [straightTop, flaredTop];
  if (topExtension > 0) {
    sections.push(pathWire(flared).sketchOnPlane('XY', cutout.cutDepth + topExtension) as Sketch);
  }
  return baseSketch.loftWith(sections, { ruled: true });
}

/** Flatten a closed bezier path to an open polyline for 3D generation.
 * Returns points for each anchor and bezier intermediates — without duplicating
 * the first point at the end, since brepjs `close()` handles wire closure.
 */
export const BEZIER_SEGMENTS = 12;

export function flattenPathToPolyline(path: readonly PathPoint[]): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  const n = path.length;

  for (let i = 0; i < n; i++) {
    const p0 = path[i];
    const p1 = path[(i + 1) % n];

    result.push({ x: p0.x, y: p0.y });

    // Flatten bezier curves between consecutive anchors (including closing segment)
    if (p0.handleOut || p1.handleIn) {
      const bx = p0.handleOut ? p0.x + p0.handleOut.dx : p0.x;
      const by = p0.handleOut ? p0.y + p0.handleOut.dy : p0.y;
      const cx = p1.handleIn ? p1.x + p1.handleIn.dx : p1.x;
      const cy = p1.handleIn ? p1.y + p1.handleIn.dy : p1.y;

      // Skip s=0 (p0 already pushed) and s=BEZIER_SEGMENTS (next iteration pushes p1,
      // or for closing segment we omit to avoid duplicating first point)
      for (let s = 1; s < BEZIER_SEGMENTS; s++) {
        const t = s / BEZIER_SEGMENTS;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = mt3 * p0.x + 3 * mt2 * t * bx + 3 * mt * t2 * cx + t3 * p1.x;
        const y = mt3 * p0.y + 3 * mt2 * t * by + 3 * mt * t2 * cy + t3 * p1.y;
        result.push({ x, y });
      }

      // p1 is pushed as p0 of the next iteration for non-closing segments.
      // For the closing segment, brepjs close() handles the connection back to start.
    }
  }

  return result;
}

/** Check if a closed polyline self-intersects (any non-adjacent edges cross). */
export function polylineSelfIntersects(poly: readonly { x: number; y: number }[]): boolean {
  const n = poly.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (j === n - 1 && i === 0) continue; // adjacent (closing edge)
      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];
      const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
      if (Math.abs(d) < 1e-10) continue;
      const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
      const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
      const eps = 1e-6;
      if (t > eps && t < 1 - eps && u > eps && u < 1 - eps) return true;
    }
  }
  return false;
}
/**
 * Find the bottom-plane edges within XY bounds — the edges a scoop fillet should
 * round.
 *
 * Selects edges that lie *flat* in the z≈zTarget plane (the cutout floor), not
 * merely edges that touch it. A box's four vertical corner edges have
 * `zMin = zTarget` but span the full cut depth; the older "z range overlaps
 * zTarget" test picked them up, so the scoop fillet rounded the corners all the
 * way to the top rim. That left a degenerate sliver face where the rounded
 * vertical surface met the sharp top edges — an open (single-face) edge that
 * survives as a non-manifold edge in the exported STL (GH). Requiring the
 * whole edge to sit in the bottom plane keeps verticals sharp and scoops only
 * the floor ring, as intended.
 */
export function findBottomEdges(
  shape: Shape3D,
  zTarget: number,
  xyBounds: AABB,
  margin: number = 1
): readonly Edge[] {
  return edgeFinder()
    .when((e) => {
      const bounds = getBounds(e);
      const inBottomPlane = bounds.zMin >= zTarget - 0.1 && bounds.zMax <= zTarget + 0.1;
      const xOverlaps =
        bounds.xMax >= xyBounds.minX - margin && bounds.xMin <= xyBounds.maxX + margin;
      const yOverlaps =
        bounds.yMax >= xyBounds.minY - margin && bounds.yMin <= xyBounds.maxY + margin;
      return inBottomPlane && xOverlaps && yOverlaps;
    })
    .findAll(shape);
}

/** Minimum fillet radius in mm — below this OCCT cannot produce valid geometry. */
const MIN_FILLET_RADIUS = 0.1;

/** Edges shorter than this (mm) are degenerate seam artifacts; skip them entirely. */
const MIN_EDGE_LENGTH = 0.2;

/**
 * Safety margin when fitting a fillet to a short edge.
 * Radius is set to `(edgeLength / 2) * SHORT_EDGE_MARGIN` so the fillet
 * doesn't consume the full edge span and fail.
 */
const SHORT_EDGE_MARGIN = 0.9;

/**
 * Fraction of the target radius applied to junction edges (where two merged
 * shapes meet after boolean union). 30% is empirically the sweet spot:
 * high enough to keep the scoop visible, low enough to avoid the curvature
 * discontinuity that causes pinching. Validated across circle+rect, rect+rect,
 * and rotated shape combinations at radii from 1–6 mm.
 */
const JUNCTION_RADIUS_FACTOR = 0.3;

/** Progressive fallback multipliers when a fillet attempt fails. */
const FALLBACK_FACTORS = [1.0, 0.75, 0.5, 0.25] as const;
/**
 * Apply a fillet with progressive radius fallback for ungrouped cutouts.
 * Tries 100%, 75%, 50%, 25% of the target radius. Returns original shape on total failure.
 */
export function applyFilletWithFallback(
  shape: Shape3D,
  edges: readonly Edge[],
  radius: number
): Shape3D {
  for (const factor of FALLBACK_FACTORS) {
    const r = radius * factor;
    if (r < MIN_FILLET_RADIUS) break;
    try {
      const result = fillet(shape as ValidSolid, edges as Edge[], r);
      if (isOk(result)) return unwrap(result);
    } catch {
      // Try next reduction
    }
  }
  return shape;
}

/**
 * Apply an adaptive scoop fillet to a fused group of cutout shapes.
 *
 * Uses brepjs's per-edge radius callback to classify each bottom edge:
 * - Short edges (length < 2× radius) get proportionally reduced radius
 * - Junction edges (center falls inside 2+ member AABBs) get reduced radius
 *   computed from the max axis radius across owning members
 * - Perimeter edges owned by exactly one member get that member's axis-specific
 *   radius, classified by rotating the edge direction back to the member's local frame
 *
 * Per-edge toggles (`scoopEdges`) are not honored for grouped cutouts — edges
 * may be shared between members, making per-edge semantics ambiguous.
 */
function applyAdaptiveScoop(
  shape: Shape3D,
  edges: readonly Edge[],
  targetRadius: number,
  memberBounds: readonly AABB[],
  members: readonly Cutout[],
  memberScoops: readonly ResolvedScoop[]
): Shape3D {
  // Pick the desired radius for one edge. Returns 0 when the edge should
  // stay sharp (disabled gate, zero axis); `applyCallbackFilletWithFallback`
  // honors that across every fallback step.
  const pickRadius = (edge: Edge<Dimension>): number => {
    const b = getBounds(edge);
    const midX = (b.xMin + b.xMax) / 2;
    const midY = (b.yMin + b.yMax) / 2;

    const owners: number[] = [];
    for (let i = 0; i < memberBounds.length; i++) {
      const mb = memberBounds[i];
      if (midX >= mb.minX && midX <= mb.maxX && midY >= mb.minY && midY <= mb.maxY) {
        owners.push(i);
      }
    }

    if (owners.length >= 2) {
      return maxOwnerAxisRadius(owners, memberScoops) * JUNCTION_RADIUS_FACTOR;
    }
    if (owners.length === 1) {
      const idx = owners[0];
      const aabb = memberBounds[idx];
      return classifyAxisRadius(b, members[idx], memberScoops[idx], {
        x: (aabb.minX + aabb.maxX) / 2,
        y: (aabb.minY + aabb.maxY) / 2,
      });
    }
    return targetRadius;
  };

  return applyCallbackFilletWithFallback(shape, edges, pickRadius);
}

/**
 * Build and position an ungrouped cutout with axis-aware scoop fillet.
 *
 * The fillet is applied in the cutout's local (unrotated) frame so edges
 * can be classified by canonical orientation: Y-aligned bottom edges (left/right
 * walls) get `scoopRadiusW`; X-aligned bottom edges (front/back walls) get
 * `scoopRadiusD`. Rotation is applied **after** the fillet so the curve
 * follows the cutout's local axes. Per-edge toggles (`scoopEdges`) gate
 * individual walls — disabled edges return a null radius from the callback,
 * which OCCT treats as "skip this edge."
 *
 * Exported alongside {@link buildGroupedCutouts} and
 * {@link buildArrayUngroupedCutouts} because the lid's plate reuses all three.
 * What makes that safe is that the frame is entirely in the arguments: the tool
 * is built spanning `[solidSurfaceZ - min(cutDepth, solidSurfaceZ), solidSurfaceZ]`
 * with `x`/`y` measured from (`originX`, `originY`). Nothing here reads a bin
 * dimension, so a caller with a different host face supplies its own plane and
 * origin and gets a tool in that frame — see `lidCutoutBuilder`.
 */
export function buildUngroupedCutout(
  cutout: BinParams['cutouts'][number],
  solidSurfaceZ: number,
  originX: number,
  originY: number
): Shape3D | null {
  const effectiveDepth = Math.min(cutout.cutDepth, solidSurfaceZ);
  if (effectiveDepth <= 0) return null;

  let shape = buildUnrotatedCutoutShape({ ...cutout, cutDepth: effectiveDepth });
  if (!shape) return null;

  const scoop = resolveScoop(cutout, effectiveDepth);
  if (scoop.w > 0 || scoop.d > 0) {
    const filleted = applyAxisAwareScoop(shape, cutout, scoop);
    if (filleted !== shape) {
      shape.delete();
      shape = filleted;
    }
  }

  shape = applyCutoutLean(shape, resolveCutoutLeanDeg(cutout), effectiveDepth);

  if (cutout.rotation !== 0) {
    const rotated = rotate(shape, -cutout.rotation, { axis: [0, 0, 1] });
    shape.delete();
    shape = rotated;
  }

  const positioned = translate(shape, [
    originX + cutout.x + cutout.width / 2,
    originY + cutout.y + cutout.depth / 2,
    solidSurfaceZ - effectiveDepth,
  ]);
  shape.delete();
  return positioned;
}

/**
 * Apply an axis-aware fillet to a cutout's bottom edges in its local frame.
 *
 * Classification rules (edges are in canonical local frame since rotation hasn't run yet):
 *   - |dy| > |dx|  →  Y-aligned (left/right wall)   →  radiusW, gated by edges.left/right
 *   - |dx| > |dy|  →  X-aligned (front/back wall)   →  radiusD, gated by edges.front/back
 *   - dx ≈ dy      →  corner arc (rounded rect)     →  max(W, D), gated by BOTH adjacent edges
 *
 * Disabled edges and zero-radius axes return null, which OCCT skips via the
 * per-edge callback API. Progressive fallback preserves the callback's per-edge
 * decisions by scaling the returned radii, never falling back to a uniform
 * radius that would re-enable disabled edges.
 */
function applyAxisAwareScoop(shape: Shape3D, cutout: Cutout, scoop: ResolvedScoop): Shape3D {
  const halfW = cutout.width / 2;
  const halfD = cutout.depth / 2;
  const edges = findBottomEdges(shape, 0, {
    minX: -halfW,
    minY: -halfD,
    maxX: halfW,
    maxY: halfD,
  });
  if (edges.length === 0) return shape;

  // Freeform paths have many short, varied bottom edges; the uniform all-edges
  // fillet fails wholesale on them (one bad edge aborts the whole call), so the
  // scoop silently no-ops. The per-edge callback filleter skips degenerate edges
  // and shrinks the radius on short ones, so the scoop actually lands. Paths
  // can't classify walls as W/D, so every edge gets the uniform radius.
  if (cutout.shape === 'path') {
    return applyCallbackFilletWithFallback(shape, edges, () => scoop.w);
  }

  // Uniform path: both axes equal AND all edges on → preserve historical
  // progressive-uniform fallback so existing geometry is unchanged.
  const allEdgesOn = scoop.edges.left && scoop.edges.right && scoop.edges.front && scoop.edges.back;
  if (scoop.w === scoop.d && allEdgesOn) {
    return applyFilletWithFallback(shape, edges, scoop.w);
  }

  // Pick the radius for one edge in local frame. Edge gates apply per-wall;
  // corner arcs require BOTH adjacent walls enabled to round.
  const pickRadius = (edge: Edge<Dimension>): number => {
    const b = getBounds(edge);
    const dx = b.xMax - b.xMin;
    const dy = b.yMax - b.yMin;
    const midX = (b.xMin + b.xMax) / 2;
    const midY = (b.yMin + b.yMax) / 2;
    // Tolerance: a sharp 90° corner vertex has dx ≈ dy ≈ 0; an arc has dx ≈ dy ≈ cornerRadius.
    // Distinguish from a long axis-aligned edge by requiring one dim to clearly dominate.
    const isYAligned = dy > dx + 0.01;
    const isXAligned = dx > dy + 0.01;
    if (isYAligned) {
      return (midX < 0 ? scoop.edges.left : scoop.edges.right) ? scoop.w : 0;
    }
    if (isXAligned) {
      return (midY < 0 ? scoop.edges.front : scoop.edges.back) ? scoop.d : 0;
    }
    // Corner arc: needs both adjacent walls enabled.
    const wAllowed = midX < 0 ? scoop.edges.left : scoop.edges.right;
    const dAllowed = midY < 0 ? scoop.edges.front : scoop.edges.back;
    return wAllowed && dAllowed ? Math.max(scoop.w, scoop.d) : 0;
  };

  return applyCallbackFilletWithFallback(shape, edges, pickRadius);
}

/**
 * Run a per-edge fillet callback, progressively scaling all radii on failure.
 *
 * Unlike `applyFilletWithFallback`, this preserves the caller's per-edge intent
 * — null/zero returns stay null/zero through every fallback attempt, so edges
 * the caller wanted left sharp (disabled walls, zero-axis radii) never gain a
 * scoop just because the full-radius attempt failed.
 */
function applyCallbackFilletWithFallback(
  shape: Shape3D,
  edges: readonly Edge[],
  pickRadius: (edge: Edge<Dimension>) => number
): Shape3D {
  for (const factor of FALLBACK_FACTORS) {
    if (factor < MIN_FILLET_RADIUS) break;
    const callback = (edge: Edge<Dimension>): number | null => {
      const len = curveLength(edge);
      if (len < MIN_EDGE_LENGTH) return null;
      const r = pickRadius(edge) * factor;
      if (r < MIN_FILLET_RADIUS) return null;
      if (len < 2 * r) {
        const short = (len / 2) * SHORT_EDGE_MARGIN;
        return short < MIN_FILLET_RADIUS ? null : short;
      }
      return r;
    };
    try {
      const result = fillet(shape as ValidSolid, edges as Edge[], callback);
      if (isOk(result)) return unwrap(result);
    } catch {
      // Try next reduction
    }
  }
  return shape;
}

/** A member with its shared Repeat stripped, so one group solid is built. */
function withoutArray(cutout: Cutout): Cutout {
  if (cutout.array === undefined) return cutout;
  const { array: _drop, ...rest } = cutout;
  return rest;
}

/**
 * Build a grouped cutout, repeated across its members' shared Repeat.
 *
 * The boolean runs ONCE, on the group as the user drew it, and each further
 * copy is a transform of that result. Expanding the members first and running
 * one boolean over the whole flattened pile would be a different shape
 * entirely: Intersect across copies that do not touch is empty, Subtract lets
 * the frontmost copy carve every other one, and Exclude (union minus the
 * intersection of ALL members) degrades to a plain union. It is also N times
 * the boolean work for a result that has to come out identical at every copy.
 *
 * A grouped repeat always leaves `drot` at 0 (`groupArrayConfig` refuses
 * rotate-to-center for a group), so a copy is a pure translation.
 */
export function buildGroupedCutouts(
  groupMembers: BinParams['cutouts'],
  solidSurfaceZ: number,
  originX: number,
  originY: number
): Shape3D[] {
  const base = buildGroupSolid(groupMembers, solidSurfaceZ, originX, originY);
  if (!base) return [];

  // Only when every member agrees on the placement. A stored design can carry a
  // group where they do not, and the editor declines to repeat that through the
  // same gate, so honouring one member's repeat here would cut copies the
  // preview never showed.
  const config = groupRepeatConfig(groupMembers);
  if (!config) return [base];

  const shapes: Shape3D[] = [];
  for (const inst of arrayInstances(config)) {
    if (inst.isMaster) {
      shapes.push(base);
      continue;
    }
    try {
      shapes.push(translate(base, [inst.dx, inst.dy, 0]));
    } catch {
      // One copy failing is not a reason to drop the pattern; the rest still cut.
    }
  }
  return shapes;
}

/** Build and fuse ONE grouped cutout with a shared adaptive scoop fillet. */
function buildGroupSolid(
  groupMembers: BinParams['cutouts'],
  solidSurfaceZ: number,
  originX: number,
  originY: number
): Shape3D | null {
  // Create and translate each member shape (no individual scoop).
  // Track which members actually produced shapes so scoop aggregates
  // use clamped depths and exclude filtered-out zero-dimension members.
  const memberShapes: Shape3D[] = [];
  const builtMembers: Cutout[] = [];
  const builtDepths: number[] = [];
  // The members' own Repeat is applied to the group RESULT by the caller, so
  // it is stripped here: expanding a member into its instances would put every
  // copy inside one boolean, which is what this split exists to avoid.
  for (const cutout of groupMembers.map(withoutArray)) {
    const effectiveDepth = Math.min(cutout.cutDepth, solidSurfaceZ);
    if (effectiveDepth <= 0) continue;

    const shape = buildCutoutShape({ ...cutout, cutDepth: effectiveDepth });
    if (!shape) continue;

    builtMembers.push(cutout);
    builtDepths.push(effectiveDepth);
    const positioned = translate(shape, [
      originX + cutout.x + cutout.width / 2,
      originY + cutout.y + cutout.depth / 2,
      solidSurfaceZ - effectiveDepth,
    ]);
    shape.delete();
    memberShapes.push(positioned);
  }
  if (memberShapes.length === 0) return null;

  const op: GroupOp = groupMembers[0].groupOp ?? DEFAULT_GROUP_OP;

  const combined = combineGroupSolids(memberShapes, builtMembers, op);
  for (const s of memberShapes) s.delete();
  if (!combined) return null;

  // Scoop fillets only apply to union groups — Subtract/Intersect/Exclude can
  // produce holes or disjoint topologies where "bottom edge" is ambiguous.
  if (op !== 'union') return combined;

  let fused: Shape3D = combined;

  // Per-member axis radii, clamped to each member's geometric limits.
  // Group-level max is used only as an envelope (skip fillet entirely if all are zero).
  const groupCutDepth = Math.min(...builtDepths);
  const memberScoops: ResolvedScoop[] = builtMembers.map((m, i) => resolveScoop(m, builtDepths[i]));
  const groupMaxR = Math.max(0, ...memberScoops.flatMap((s) => [s.w, s.d]));

  if (groupMaxR > 0) {
    // Build rotation-safe AABBs for each member (used for edge selection + junction detection)
    const memberAABBs = builtMembers.map((cutout) =>
      computeRotationSafeAABB(
        originX + cutout.x + cutout.width / 2,
        originY + cutout.y + cutout.depth / 2,
        cutout.width,
        cutout.depth
      )
    );

    // Compute group bounding box from individual AABBs
    const groupBounds: AABB = {
      minX: Math.min(...memberAABBs.map((b) => b.minX)),
      minY: Math.min(...memberAABBs.map((b) => b.minY)),
      maxX: Math.max(...memberAABBs.map((b) => b.maxX)),
      maxY: Math.max(...memberAABBs.map((b) => b.maxY)),
    };

    const zBottom = solidSurfaceZ - groupCutDepth;
    const groupScoopEdges = findBottomEdges(fused, zBottom, groupBounds);
    if (groupScoopEdges.length > 0) {
      const filleted = applyAdaptiveScoop(
        fused,
        groupScoopEdges,
        groupMaxR,
        memberAABBs,
        builtMembers,
        memberScoops
      );
      if (filleted !== fused) {
        fused.delete();
        fused = filleted;
      }
    }
  }

  return fused;
}
/**
 * Build all positioned instances of an array cutout using transformCopy.
 *
 * Builds the master shape (extrude + scoop fillet) exactly once, then clones
 * and positions each instance with a single OCCT matrix operation. For a grid
 * with N instances this reduces scoop fillet calls from N to 1.
 *
 * Radial arrays with rotateToCenter get per-instance rotation composed with
 * the translate; all other modes bake the master rotation in up front.
 */
export function buildArrayUngroupedCutouts(
  cutout: BinParams['cutouts'][number],
  solidSurfaceZ: number,
  originX: number,
  originY: number
): Shape3D[] {
  const effectiveDepth = Math.min(cutout.cutDepth, solidSurfaceZ);
  if (effectiveDepth <= 0 || !cutout.array) return [];

  const instances = expandCutoutArray(cutout);
  if (instances.length === 0) return [];

  // Radial + rotateToCenter: each instance has a unique rotation angle.
  // All other modes (grid, staggered, radial without rotateToCenter): uniform.
  const nonUniformRotation = cutout.array.mode === 'radial' && cutout.array.rotateToCenter;

  let master = buildUnrotatedCutoutShape({ ...cutout, cutDepth: effectiveDepth });
  if (!master) return [];

  const scoop = resolveScoop(cutout, effectiveDepth);
  if (scoop.w > 0 || scoop.d > 0) {
    const filleted = applyAxisAwareScoop(master, cutout, scoop);
    if (filleted !== master) {
      master.delete();
      master = filleted;
    }
  }

  master = applyCutoutLean(master, resolveCutoutLeanDeg(cutout), effectiveDepth);

  // Bake the uniform rotation into master so instances only need a translate.
  if (!nonUniformRotation && cutout.rotation !== 0) {
    const rotated = rotate(master, -cutout.rotation, { axis: [0, 0, 1] });
    master.delete();
    master = rotated;
  }

  const zOffset = solidSurfaceZ - effectiveDepth;
  const results: Shape3D[] = [];

  try {
    for (const instance of instances) {
      const tx = originX + instance.x + instance.width / 2;
      const ty = originY + instance.y + instance.depth / 2;

      const ops: TransformOp[] = [];
      if (nonUniformRotation && instance.rotation !== 0) {
        ops.push({ type: 'rotate', angle: -instance.rotation, axis: [0, 0, 1] });
      }
      ops.push({ type: 'translate', v: [tx, ty, zOffset] });

      const trsf = composeTransforms(ops);
      try {
        results.push(transformCopy(master, trsf));
      } finally {
        trsf.cleanup();
      }
    }
  } finally {
    master.delete();
  }

  return results;
}

/**
 * Cut and fuse tool sets for a solid bin's cutouts.
 *
 * `cutTools` are subtractive (cavities + engraved label text); `fuseTools` are
 * additive (embossed label text raised above the bin top). They go to separate
 * boolean passes — booleanStage fuses first, then cuts.
 */
export interface CutoutTools {
  readonly cutTools: Shape3D[];
  readonly fuseTools: Shape3D[];
}

/**
 * Everything the interior clip needs to follow a tapered outer wall.
 *
 * Passed only when a taper actually applies; absent, the clip stays the plain
 * rim-sized prism it has always been.
 */
export interface InteriorTaper {
  /** Overhang-expanded outer footprint at the rim, in mm. */
  readonly outerW: number;
  readonly outerD: number;
  /** Wall height the band is clamped against — must match the box builder's. */
  readonly wallHeight: number;
  readonly wallThickness: number;
  readonly taper: ResolvedTaper;
}

/** Lift the emboss clip ceiling a hair above the raised text so it isn't grazed. */
const CUTOUT_BOOLEAN_EPSILON = 0.1;

/**
 * Build the cut and fuse tool sets for a solid bin's cutouts.
 * Each cut entry is one logical cutout (an ungrouped cutout, a fused-and-scooped
 * group, or an engraved label) clipped to the bin interior. The pipeline
 * subtracts them from the shell via the booleanStage's cutAllBisect, which
 * recovers individual tool failures instead of dropping the whole set. Embossed
 * labels are returned as fuse tools instead, raised above the bin top.
 *
 * @param params - Bin configuration (reads cutouts array and cutoutConfig.topOffset)
 * @param innerW - Interior width in mm (outer - 2*wall)
 * @param innerD - Interior depth in mm (outer - 2*wall)
 * @param wallHeight - Wall height in mm (Z extent from floor to wall top)
 * @param interiorTaper - Present when the outer wall tapers, so the interior
 *   clip follows the narrowing wall instead of a rim-sized prism
 */
export function buildCutoutCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  interiorTaper?: InteriorTaper
): CutoutTools {
  // Color ordinals MUST come from the full cutout list — the paint layer
  // enumerates ALL cutouts (incl. mesh imprints), so filtering first would
  // shift every subsequent unit's tag and recolor the wrong cavities.
  const colorOrdinal = new Map(enumerateCutoutColorUnits(params.cutouts).map((u, i) => [u.key, i]));

  // Two reasons a cutout never becomes a tool, both narrowing the list AFTER the
  // ordinals above. Mesh imprints are not profile-extrudable: they subtract
  // post-tessellation in the mesh domain (meshImprint stage), never through the
  // BREP cut path. `hidden` means absent — the same reading the imprint path
  // (`meshAsset.ts`), the lid cutout builder and `checkLidCompatibility` already
  // apply, and the one the store's epoch bump has always assumed. Group MEMBERS
  // are dropped too, so a hidden subtract-member stops subtracting and a group
  // whose members are all hidden builds nothing.
  // Mesh imprints stay in `labelable` for the LABEL loop below (their text
  // engraves on the bin top like any other cutout's), but are dropped from
  // `buildable` because their cavity is not profile-extrudable: it subtracts
  // post-tessellation in the mesh domain (meshImprint stage), never here.
  const labelable = params.cutouts.filter((c) => c.hidden !== true);
  const buildable = labelable.filter((c) => c.shape !== 'mesh');
  // Emit nothing only when there is neither a buildable cavity nor a labelled
  // mesh imprint (whose label this function still owns).
  const hasMeshLabel = labelable.some(
    (c) => c.shape === 'mesh' && isCutoutEngraveMode(c) && c.label.trim() !== ''
  );
  if (buildable.length === 0 && !hasMeshLabel) return { cutTools: [], fuseTools: [] };
  params = { ...params, cutouts: buildable };

  // Cutout x,y are relative to interior bottom-left corner (0,0).
  // The bin body is centered at model origin, so interior left/front is at -innerW/2, -innerD/2.
  const originX = -innerW / 2;
  const originY = -innerD / 2;

  // Global top offset: the solid fill surface is at wallHeight - topOffset
  const topOffset = params.cutoutConfig.topOffset;
  const solidSurfaceZ = wallHeight - topOffset;

  // Guard: if solidSurfaceZ is non-positive, there's no valid cutting surface
  // (the solid fill is at or below floor level). Skip all cutouts.
  if (solidSurfaceZ <= 0) return { cutTools: [], fuseTools: [] };

  const rawShapes: Shape3D[] = [];
  // Per-cutout color face tag, aligned 1:1 with rawShapes. Applied AFTER the
  // interior clip (its intersect boolean regenerates faces and drops any origin
  // set beforehand), so it's carried alongside rather than stamped here. Every
  // cutout is tagged (colored or not), so recoloring stays a pure read-side
  // change that never regenerates geometry.
  const rawTags: number[] = [];
  // Cavity tool indices per cutout id — floor-embossed labels are carved OUT
  // of their owning cavity tool rather than fused (see carveLabelFromCavities).
  const cavityIndices = new Map<string, number[]>();
  const cavityTag = (cutout: Cutout): number =>
    cutoutColorTag(colorOrdinal.get(cutoutUnitKey(cutout)) ?? 0);
  const pushRaw = (shape: Shape3D, tag: number, ownerId?: string): void => {
    if (ownerId !== undefined) {
      const list = cavityIndices.get(ownerId);
      if (list) list.push(rawShapes.length);
      else cavityIndices.set(ownerId, [rawShapes.length]);
    }
    rawShapes.push(shape);
    rawTags.push(tag);
  };

  // Partition cutouts by groupId: null -> ungrouped, same groupId -> collected.
  // Array masters expand into one cut per instance first — the grouped path
  // expands its own members inside `buildGroupedCutouts`.
  const groups = new Map<string, typeof params.cutouts>();
  for (const cutout of params.cutouts) {
    // A text element is caption only: it stays in the label loop below but
    // contributes no cavity tool — inside a group it adds nothing to the
    // boolean, which is what keeps grouping text with shapes purely spatial.
    if (cutout.shape === 'text') continue;
    if (cutout.groupId === null) {
      if (cutout.array) {
        for (const s of buildArrayUngroupedCutouts(cutout, solidSurfaceZ, originX, originY)) {
          pushRaw(s, cavityTag(cutout), cutout.id);
        }
      } else {
        const shape = buildUngroupedCutout(cutout, solidSurfaceZ, originX, originY);
        if (shape) pushRaw(shape, cavityTag(cutout), cutout.id);
      }
    } else {
      const list = groups.get(cutout.groupId);
      if (list) {
        list.push(cutout);
      } else {
        groups.set(cutout.groupId, [cutout]);
      }
    }
  }

  for (const [, groupMembers] of groups) {
    // One entry per copy of a repeated group; a plain group yields one.
    const indices: number[] = [];
    for (const shape of buildGroupedCutouts(groupMembers, solidSurfaceZ, originX, originY)) {
      indices.push(rawShapes.length);
      // All members share a groupId -> one unit, one color for the merged cavity.
      pushRaw(shape, cavityTag(groupMembers[0]));
    }
    // Every member points at every copy, so a floor-embossed label carves out
    // of whichever copy it sits over (`carveLabelFromCavities` filters by
    // bounds), exactly as an ungrouped repeat's instances already do.
    if (indices.length > 0) {
      for (const m of groupMembers) cavityIndices.set(m.id, indices);
    }
  }

  // Per-cutout label text, placed by the 9-point anchor: the outer anchors
  // land on the bin top beside the cutout, `center` lands on the recess floor
  // inside it. The design-level mode picks engrave (cut into the surface) or
  // emboss (raised above it); through-cut falls back to engrave since punching
  // bin-top text through the floor is meaningless. Engraved text joins the cut
  // pile; top-surface embossed text is collected separately for fusing; floor
  // embossed text is carved out of its cavity tool.
  // Group op per groupId, keyed off the first member in cutouts order — the
  // same member buildGroupedCutouts reads it from.
  const groupOps = new Map<string, GroupOp>();
  for (const c of labelable) {
    if (c.groupId !== null && !groupOps.has(c.groupId)) {
      groupOps.set(c.groupId, c.groupOp ?? DEFAULT_GROUP_OP);
    }
  }

  // Labels iterate `labelable` (incl. mesh imprints) so a mesh cutout's text
  // engraves on the bin top even though its cavity is built in the mesh domain.
  const rawFuseShapes: Shape3D[] = [];
  for (const master of labelable) {
    if (!isCutoutEngraveMode(master)) continue;
    // A repeat with a label list engraves once per instance, each with its own
    // word; without one it engraves once beside the master, which is what every
    // design stored before the list existed already prints.
    for (const cutout of labelledInstances(master)) {
      const label = cutout.label.trim();
      if (label === '') continue;
      // Non-union groups (subtract/intersect/exclude) can hollow a member's
      // footprint out of the final cavity, so a member-footprint floor guess may
      // point at solid material. Only union cavities keep member floors intact.
      // A leaned pocket's floor is tilted and laterally shifted, so the flat
      // recess-floor Z guess is wrong for it too — its labels stay on the top.
      const allowFloor =
        (cutout.groupId === null || groupOps.get(cutout.groupId) === 'union') &&
        resolveCutoutLeanDeg(cutout) === 0;
      const textShape = buildCutoutLabel(
        cutout,
        label,
        params.textDefaults,
        solidSurfaceZ,
        originX,
        originY,
        innerW,
        innerD,
        allowFloor,
        master.array
      );
      if (!textShape) continue;
      // Label text is its own color zone — tag it TEXT so an engraved label
      // sharing the cut pile doesn't inherit its cutout's cavity color.
      // Cavity lookup stays on the MASTER id: every instance's tool registers
      // under it, and `carveLabelFromCavities` filters the list by bounds so
      // these glyphs only carve the cavity they actually sit over.
      if (textShape.op === 'fuse') rawFuseShapes.push(textShape.solid);
      else if (textShape.op === 'carve')
        carveLabelFromCavities(textShape.solid, cavityIndices.get(master.id), rawShapes);
      else pushRaw(textShape.solid, FeatureTag.TEXT);
    }
  }

  if (rawShapes.length === 0 && rawFuseShapes.length === 0) {
    return { cutTools: [], fuseTools: [] };
  }

  // Clip each tool individually to the bin interior so cutouts extending past
  // the walls don't punch through them. Shapes that fail to clip are skipped
  // rather than poisoning the whole set. Cut tools live at or below the bin top,
  // so a box spanning the fill height contains them. Embossed text rises ABOVE
  // the top, so its clip box must be tall enough to keep the raised geometry —
  // an interior-height box would shear it off.
  const cutTools = clipToInterior(rawShapes, innerW, innerD, solidSurfaceZ, rawTags, interiorTaper);
  if (!interiorTaper) {
    cutTools.push(
      ...buildKnifeBreachChannels(
        params,
        innerW,
        innerD,
        solidSurfaceZ,
        wallHeight,
        originX,
        originY,
        cavityTag
      )
    );
  }
  const fuseTools =
    rawFuseShapes.length > 0
      ? clipToInterior(
          rawFuseShapes,
          innerW,
          innerD,
          solidSurfaceZ + params.textDefaults.depth + CUTOUT_BOOLEAN_EPSILON,
          rawFuseShapes.map(() => FeatureTag.TEXT),
          interiorTaper
        )
      : [];
  return { cutTools, fuseTools };
}

/** Extra reach past any wall so a breach channel always exits the body (mm). */
const KNIFE_BREACH_REACH_MARGIN = 50;

/**
 * Open-end channels for `knifeSlot` cutouts: a straight continuation of the
 * slot from its open end out through the perimeter wall, floor-level up
 * through the rim, collar and stacking lip, so the bolster stops at the block
 * face and the handle lies level past it.
 *
 * Deliberately NOT passed through `clipToInterior` — breaching the wall is the
 * point. Restricted to ungrouped, axis-aligned, untapered hosts: a boolean
 * group makes the final cavity unknowable here, a rotated exit would need an
 * angled lip-gap plan the lid machinery doesn't model (gotcha #19), and the
 * tapered envelope has no straight wall to exit square through.
 */
function buildKnifeBreachChannels(
  params: BinParams,
  innerW: number,
  innerD: number,
  solidSurfaceZ: number,
  wallHeight: number,
  originX: number,
  originY: number,
  cavityTag: (cutout: Cutout) => number
): Shape3D[] {
  const channels: Shape3D[] = [];
  const collar = params.extraWallHeightMm ?? 0;
  for (const master of params.cutouts) {
    if (master.shape !== 'knifeSlot' || master.groupId !== null) continue;
    const openEnd = (master.knife ?? DEFAULT_KNIFE_SPEC).openEnd;
    if (openEnd === undefined) continue;
    const instances = master.array ? expandCutoutArray(master) : [master];
    for (const cutout of instances) {
      if (cutout.rotation % 90 !== 0) continue;
      const effectiveDepth = Math.min(cutout.cutDepth, solidSurfaceZ);
      if (effectiveDepth <= 0) continue;
      const r = slotCornerRadius(cutout.width, cutout.depth);
      const reach = innerW + innerD + KNIFE_BREACH_REACH_MARGIN;
      // Overlap the stadium's end cap (start at width/2 - r) so the union has
      // no seam; the cap's semicircle lies inside the channel's square end.
      const nearEdge = cutout.width / 2 - r;
      const centerX = (nearEdge + reach / 2) * (openEnd === 'end' ? 1 : -1);
      const height =
        effectiveDepth + (wallHeight - solidSurfaceZ) + collar + LIP_HEIGHT + CUT_RIM_CLEARANCE;
      let shape: Shape3D = box(reach, cutout.depth, height, { at: [centerX, 0, height / 2] });
      if (cutout.rotation !== 0) {
        const rotated = rotate(shape, -cutout.rotation, { axis: [0, 0, 1] });
        shape.delete();
        shape = rotated;
      }
      const positioned = translate(shape, [
        originX + cutout.x + cutout.width / 2,
        originY + cutout.y + cutout.depth / 2,
        solidSurfaceZ - effectiveDepth,
      ]);
      shape.delete();
      setShapeOrigin(positioned, cavityTag(master));
      channels.push(positioned);
    }
  }
  return channels;
}

/**
 * Intersect each shape with an interior box of the given height (bottom at
 * z=0), consuming the inputs. Tools that fail to clip are dropped rather than
 * poisoning the whole set.
 *
 * `tags` (aligned 1:1 with `shapes`) is stamped onto each clipped result via
 * `setShapeOrigin`. It MUST be applied here, after the intersect — the boolean
 * regenerates the tool's faces, so an origin set on the input shape is lost.
 */
function clipToInterior(
  shapes: Shape3D[],
  innerW: number,
  innerD: number,
  boxHeight: number,
  tags?: readonly number[],
  taper?: InteriorTaper
): Shape3D[] {
  if (shapes.length === 0) return [];
  let clipBoundary: Shape3D;
  try {
    // A tapered bin's wall narrows toward the floor, so the prism below is the
    // wrong boundary: `innerW`/`innerD` are rim-anchored, leaving a pocket
    // flush with the interior edge only `wallThickness - flare` of material at
    // the base — negative for any flare wider than the wall. The lofted
    // envelope holds `wallThickness` at EVERY height instead, and is identical
    // to the prism above the band, so untapered bins are unaffected.
    //
    // Built at the origin because featuresStage translates the finished tools
    // by the asymmetric-overhang offset afterwards — baking the offset in here
    // too would shift the clip twice.
    clipBoundary = taper
      ? buildTaperedInnerEnvelope(
          taper.outerW,
          taper.outerD,
          taper.wallHeight,
          taper.wallThickness,
          taper.taper,
          boxHeight,
          0,
          0
        )
      : box(innerW, innerD, boxHeight, { at: [0, 0, boxHeight / 2] });
  } catch (e) {
    for (const s of shapes) s.delete();
    throw e;
  }

  const clipped: Shape3D[] = [];
  try {
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      try {
        const result = unwrap(intersect(shape, clipBoundary));
        const tag = tags?.[i];
        if (tag !== undefined) setShapeOrigin(result, tag);
        clipped.push(result);
      } catch {
        // Individual clip failure: drop this tool but keep the rest.
      } finally {
        shape.delete();
      }
    }
  } finally {
    clipBoundary.delete();
  }
  return clipped;
}

/** A cutout label solid plus how it must be applied to the bin. */
interface CutoutLabelShape {
  readonly solid: Shape3D;
  /**
   * `cut` engraves (bin top or recess floor), `fuse` embosses on the bin top,
   * `carve` embosses on a recess floor: the solid must be subtracted from the
   * owning cavity tool instead of fused (see {@link carveLabelFromCavities}).
   */
  readonly op: 'cut' | 'fuse' | 'carve';
}

/** Point-in-rounded-rect for a `2·hw × 2·hd` rect with corner radius `r`,
 *  centered at the origin. */
function roundedRectContains(lx: number, ly: number, hw: number, hd: number, r: number): boolean {
  const ax = Math.abs(lx);
  const ay = Math.abs(ly);
  if (ax > hw || ay > hd) return false;
  if (r <= 0) return true;
  const ex = ax - (hw - r);
  const ey = ay - (hd - r);
  if (ex <= 0 || ey <= 0) return true;
  return ex * ex + ey * ey <= r * r;
}

/**
 * Whether a point (in the cutout's local, unrotated frame, origin at its
 * center) lies inside the actual cavity footprint. Shape-aware so a label near
 * a bounding-box corner of a circle/polygon/path isn't mistaken for "over the
 * recess" and engraved at floor depth under solid fill. Degenerate polygons and
 * paths extrude as their bounding box (see the shape builders), so their
 * containment tests fall back to the same box.
 */
function labelCenterInFootprint(cutout: Cutout, lx: number, ly: number): boolean {
  const hw = cutout.width / 2;
  const hd = cutout.depth / 2;
  switch (cutout.shape) {
    case 'circle':
      return hw > 0 && hd > 0 && (lx / hw) ** 2 + (ly / hd) ** 2 <= 1;
    case 'polygon': {
      const pts = regularPolygonPoints(
        clampPolygonSides(cutout.sides ?? DEFAULT_POLYGON_SIDES),
        cutout.width,
        cutout.depth
      );
      if (pts.length < 3) return Math.abs(lx) <= hw && Math.abs(ly) <= hd;
      return pointInPolyline(pts, lx, ly);
    }
    case 'slot':
    case 'knifeSlot':
      return roundedRectContains(lx, ly, hw, hd, slotCornerRadius(cutout.width, cutout.depth));
    case 'path': {
      const outline = pathOutline(cutout);
      if (!outline) return Math.abs(lx) <= hw && Math.abs(ly) <= hd;
      return pointInPolyline(outline, lx, ly);
    }
    case 'mesh':
      // The imported pocket floor is an arbitrary surface with no flat plane to
      // engrave into, so a mesh cutout's label always lands on the bin top.
      return false;
    case 'text':
      // A text element has no cavity, so its caption always lands on the
      // fill top — never on a recess floor.
      return false;
    case 'rectangle':
      return roundedRectContains(lx, ly, hw, hd, Math.min(cutout.cornerRadius, hw, hd));
  }
}

/**
 * Z of the surface a cutout label lands on: the recess floor when the placed
 * center sits inside the cutout's rotated footprint (the `center` anchor, or an
 * offset drag ending over the cavity), the un-recessed fill top otherwise.
 * Labels used to engrave at the fill top unconditionally, so a center-anchored
 * label's shallow cut sat entirely inside the volume the cavity removes and
 * vanished from the model.
 */
function labelSurfaceZ(
  cutout: Cutout,
  centerX: number,
  centerY: number,
  solidSurfaceZ: number,
  originX: number,
  originY: number
): number {
  const dx = centerX - (originX + cutout.x + cutout.width / 2);
  const dy = centerY - (originY + cutout.y + cutout.depth / 2);
  // Localize with the inverse of the shape's world rotation —
  // buildUngroupedCutout rotates by -cutout.rotation, so invert with +rotation.
  const theta = (cutout.rotation * Math.PI) / 180;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  if (!labelCenterInFootprint(cutout, lx, ly)) return solidSurfaceZ;
  return solidSurfaceZ - Math.min(cutout.cutDepth, solidSurfaceZ);
}

/**
 * Subtract a floor-embossed label from its cutout's cavity tools, leaving the
 * glyphs standing on the recess floor once the cavity is cut from the bin.
 * Raised text inside a recess cannot go through the fuse pile: the boolean
 * stage fuses BEFORE it cuts, so fused glyphs would sit inside still-solid
 * fill and the cavity cut would shear them away. Consumes `text`; a failed
 * carve keeps the uncarved cavity and silently drops the label (matching
 * {@link buildCutoutLabel}'s silent-skip contract).
 */
function boundsOverlap(a: Bounds3D, b: Bounds3D): boolean {
  return (
    a.xMin <= b.xMax &&
    a.xMax >= b.xMin &&
    a.yMin <= b.yMax &&
    a.yMax >= b.yMin &&
    a.zMin <= b.zMax &&
    a.zMax >= b.zMin
  );
}

function carveLabelFromCavities(
  text: Shape3D,
  indices: readonly number[] | undefined,
  rawShapes: Shape3D[]
): void {
  try {
    const textBounds = getBounds(text);
    for (const i of indices ?? []) {
      // Array instances all register under the master's id, but the glyphs
      // occupy a single world location — skip tools the text can't touch so
      // spaced instances don't pay (or risk) a pointless boolean. Every
      // OVERLAPPING tool must be carved, though: an uncarved overlapping
      // cavity would erase the standing text when it is subtracted.
      if (!boundsOverlap(textBounds, getBounds(rawShapes[i]))) continue;
      try {
        // brepjs `cut` never consumes its operands (callers delete inputs
        // themselves — see lightweightBaseBuilder), so reusing `text` across
        // iterations is safe.
        const carved = unwrap(cut(rawShapes[i] as ValidSolid, text as ValidSolid));
        if (carved !== rawShapes[i]) {
          rawShapes[i].delete();
          rawShapes[i] = carved;
        }
      } catch {
        // Keep the uncarved cavity; this label is silently skipped.
      }
    }
  } finally {
    text.delete();
  }
}

/**
 * Label text for a cutout: on the bin top beside it (outer anchors) or on the
 * recess floor inside it (`center` anchor, see {@link labelSurfaceZ}).
 * `allowFloor` gates the floor branch — callers pass false for members of
 * non-union groups, whose final cavity may not contain the member's footprint.
 *
 * The side picker is interpreted in WORLD coordinates (top = +Y, etc.); text
 * reads left-to-right in world XY regardless of cutout rotation. The cutout
 * AABB used for placement IS rotation-aware so labels never overlap a rotated
 * cutout's footprint — `cutoutWorldAabb()` projects the four rotated corners
 * and takes their min/max.
 *
 * The design-level mode selects `engrave` (recessed, returned with `op: 'cut'`)
 * or `emboss` (raised, returned with `op: 'fuse'` on the bin top, `op: 'carve'`
 * on a recess floor). `through-cut` falls back to engrave — punching bin-top
 * text through the floor is meaningless.
 *
 * Placement (side gap + rotation-aware AABB) is delegated to
 * `cutoutLabelPlacement` so the 2D editor preview tracks this engraving.
 * Returns `null` when there's no room or the minimum font size won't fit —
 * better a silent skip than a visually broken engraving.
 */
function buildCutoutLabel(
  cutout: Cutout,
  label: string,
  textDefaults: BinParams['textDefaults'],
  solidSurfaceZ: number,
  originX: number,
  originY: number,
  innerW: number,
  innerD: number,
  allowFloor: boolean,
  repeat: CutoutArrayConfig | undefined
): CutoutLabelShape | null {
  // A text element's caption centers on its own box regardless of stray
  // anchor/offset fields in a hand-authored file — the editor offers neither.
  const placed = withCenteredTextPlacement(cutout);
  const placement = cutoutLabelPlacement(placed, innerW, innerD, originX, originY);
  if (!placement) return null;
  const { centerX, centerY } = placement;
  // An explicit per-cutout size is a target: the band widens to the interior
  // and skips the repeat pitch cap, so the label prints at the asked-for size
  // (overlapping neighbours if it must — the editor warns) and shrinks only
  // when the bin itself cannot hold it. Auto-fit keeps the anchor band, capped
  // to the room one copy of a repeat owns so captions meet rather than print
  // over each other.
  const { availW, availD } = hasExplicitLabelSize(cutout)
    ? expandBandToInterior(placement, innerW, innerD, originX, originY)
    : fitLabelRoom(placement.availW, placement.availD, repeat);

  // Per-cutout style layers over the design-wide defaults, in step with the
  // label tab's own override handling. A text element is forced onto the fixed
  // path: its size is explicit by nature, and a hand-authored one that dropped
  // its style must not auto-fill the widened band.
  const resolved = resolveTextStyle(textDefaults, cutout.textStyle);
  const style =
    cutout.shape === 'text' && resolved.sizeMode !== 'fixed'
      ? { ...resolved, sizeMode: 'fixed' as const }
      : resolved;

  // Cutouts support engrave + emboss; through-cut would punch the floor, so it
  // degrades to engrave.
  const mode = style.mode === 'emboss' ? 'emboss' : 'engrave';

  const surfaceZ = allowFloor
    ? labelSurfaceZ(cutout, centerX, centerY, solidSurfaceZ, originX, originY)
    : solidSurfaceZ;
  // A recess consuming the full fill depth leaves no floor to engrave into —
  // the interior clip stops at z=0 to protect the base, so skip the label.
  if (mode === 'engrave' && surfaceZ <= 0) return null;

  return withScope((scope: DisposalScope): CutoutLabelShape | null => {
    const result = buildTextSolid(scope, {
      text: label,
      // A cutout label's position is decided by `cutoutLabelPlacement`, which
      // already resolved this cutout's own anchor and offset into the band
      // handed over as the host box. Letting the design-wide anchor apply again
      // would push the caption into a corner of that band and double-count the
      // nudge. The typographic fields (face, tracking, case, cut profile) DO
      // apply: a design's type reads the same everywhere, only the placement
      // mechanism differs.
      style: { ...style, mode, anchor: 'center', offset: ZERO_TEXT_OFFSET },
      availW,
      availD,
      centerX,
      centerY,
      topZ: surfaceZ,
      depth: style.depth,
      hostThickness: surfaceZ,
      // A text element IS its text, so the element's rotation turns the
      // glyphs; other shapes rotate their cavity and carry a separate angle.
      angleDeg: cutout.shape === 'text' ? cutout.rotation : (cutout.textAngle ?? 0),
    });
    if (!result) return null;
    // Emboss below the fill top means "inside a recess" — reroute from the
    // fuse pile to the cavity carve so the raised text survives the cut pass.
    const op = result.op === 'fuse' && surfaceZ < solidSurfaceZ ? 'carve' : result.op;
    return { solid: unwrap(clone(result.solid)), op };
  });
}
