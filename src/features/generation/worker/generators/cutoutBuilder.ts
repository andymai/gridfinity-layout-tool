/**
 * Cutout cavity builder for solid-mode Gridfinity bins.
 *
 * Generates cutout shapes (rectangle, circle, path) that are boolean-subtracted
 * from the solid fill surface. Supports grouped cutouts with adaptive scoop fillets
 * and ungrouped cutouts with individual fillets.
 */

import {
  draw,
  drawRoundedRectangle,
  box,
  drawEllipse,
  cylinder,
  unwrap,
  fuseAll,
  translate,
  fillet,
  intersect,
  rotate,
  edgeFinder,
  getBounds,
  isOk,
  curveLength,
  clone,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, Edge, Dimension, DisposalScope } from 'brepjs';
import type { BinParams, Cutout, PathPoint } from '@/shared/types/bin';
import { MIN_PATH_POINTS } from '@/shared/types/bin';
import {
  resolveScoop,
  maxOwnerAxisRadius,
  classifyAxisRadius,
  type ResolvedScoop,
} from './cutoutScoopHelpers';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './compartmentBuilder';
import { buildTextSolid } from './textBuilder';
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
 * Tight world-coord AABB for a cutout, accounting for `cutout.rotation`.
 *
 * Projects the four corners through the rotation matrix (around the cutout's
 * own center) and takes their min/max. Unrotated cutouts return their plain
 * extent; rotated ones get a true axis-aligned envelope (smaller than
 * `computeRotationSafeAABB`'s diagonal-based safe box, which would push
 * adjacent text farther out than necessary).
 *
 * `originX/Y` is the bin-interior origin in world coords (= -innerW/2,
 * -innerD/2), so the returned AABB sits in the interior frame.
 */
function cutoutWorldAabb(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  originX: number,
  originY: number
): AABB {
  const cx = originX + cutout.x + cutout.width / 2;
  const cy = originY + cutout.y + cutout.depth / 2;
  const hw = cutout.width / 2;
  const hd = cutout.depth / 2;
  if (cutout.rotation === 0) {
    return { minX: cx - hw, maxX: cx + hw, minY: cy - hd, maxY: cy + hd };
  }
  const θ = (cutout.rotation * Math.PI) / 180;
  const c = Math.cos(θ);
  const s = Math.sin(θ);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lx, ly] of [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ] as const) {
    const wx = cx + lx * c - ly * s;
    const wy = cy + lx * s + ly * c;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }
  return { minX, maxX, minY, maxY };
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
  readonly path?: readonly PathPoint[];
}): Shape3D | null {
  if (cutout.cutDepth <= 0 || cutout.width <= 0 || cutout.depth <= 0) return null;

  switch (cutout.shape) {
    case 'circle': {
      const rx = cutout.width / 2;
      const ry = cutout.depth / 2;
      return Math.abs(rx - ry) < 0.01
        ? cylinder(rx, cutout.cutDepth)
        : sketch(drawEllipse(rx, ry), 'XY').extrude(cutout.cutDepth);
    }
    case 'path': {
      try {
        return buildPathCutoutShape(cutout);
      } catch {
        // Self-intersecting or degenerate path — fall back to bounding box rectangle
        return box(cutout.width, cutout.depth, cutout.cutDepth, {
          at: [0, 0, cutout.cutDepth / 2],
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
        ).extrude(cutout.cutDepth);
      }
      return box(cutout.width, cutout.depth, cutout.cutDepth, {
        at: [0, 0, cutout.cutDepth / 2],
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
  readonly path?: readonly PathPoint[];
}): Shape3D | null {
  let shape = buildUnrotatedCutoutShape(cutout);
  if (!shape) return null;

  if (cutout.rotation !== 0) {
    const rotated = rotate(shape, -cutout.rotation, { axis: [0, 0, 1] });
    shape.delete();
    shape = rotated;
  }

  return shape;
}
/**
 * Build an extruded path cutout from bezier path points.
 * Flattens curves to a polyline and extrudes the closed wire.
 * The shape is centered at origin (bounding box center).
 */
function buildPathCutoutShape(cutout: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly cutDepth: number;
  readonly path?: readonly PathPoint[];
}): Shape3D {
  const fallbackRect = (): Shape3D =>
    box(cutout.width, cutout.depth, cutout.cutDepth, { at: [0, 0, cutout.cutDepth / 2] });

  const path = cutout.path;
  if (!path || path.length < MIN_PATH_POINTS) return fallbackRect();

  // Flatten bezier path to polyline — need 3+ flattened points for a closed wire
  const polyline = flattenPathToPolyline(path);
  if (polyline.length < 3) return fallbackRect();

  // Reject self-intersecting polylines that would produce invalid 3D geometry
  if (polylineSelfIntersects(polyline)) return fallbackRect();

  // Center the polyline at origin (buildCutoutShape expects shapes centered at origin).
  // Use the cutout's stored bounds (from getPathBounds in the editor) so the center
  // matches the translation applied later via cutout.x + cutout.width/2.
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;

  // Build closed wire using brepjs draw API (points relative to center)
  let pen = draw([polyline[0].x - cx, polyline[0].y - cy]);
  for (let i = 1; i < polyline.length; i++) {
    pen = pen.lineTo([polyline[i].x - cx, polyline[i].y - cy]);
  }
  const wire = pen.close();

  return sketch(wire, 'XY').extrude(cutout.cutDepth);
}

/** Flatten a closed bezier path to an open polyline for 3D generation.
 * Returns points for each anchor and bezier intermediates — without duplicating
 * the first point at the end, since brepjs `close()` handles wire closure.
 */
export const BEZIER_SEGMENTS = 12;

function flattenPathToPolyline(path: readonly PathPoint[]): Array<{ x: number; y: number }> {
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
function polylineSelfIntersects(poly: readonly { x: number; y: number }[]): boolean {
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
/** Find edges near a target Z height within XY bounds, with tolerance margins. */
export function findBottomEdges(
  shape: Shape3D,
  zTarget: number,
  xyBounds: AABB,
  margin: number = 1
): readonly Edge[] {
  return edgeFinder()
    .when((e) => {
      const bounds = getBounds(e);
      const zOverlaps = bounds.zMin <= zTarget + 0.1 && bounds.zMax >= zTarget - 0.1;
      const xOverlaps =
        bounds.xMax >= xyBounds.minX - margin && bounds.xMin <= xyBounds.maxX + margin;
      const yOverlaps =
        bounds.yMax >= xyBounds.minY - margin && bounds.yMin <= xyBounds.maxY + margin;
      return zOverlaps && xOverlaps && yOverlaps;
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
 */
function buildUngroupedCutout(
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

/** Build and fuse grouped cutouts with a shared adaptive scoop fillet. */
function buildGroupedCutouts(
  groupMembers: BinParams['cutouts'],
  solidSurfaceZ: number,
  originX: number,
  originY: number
): Shape3D | null {
  // Create and translate each member shape (no individual scoop).
  // Track which members actually produced shapes so scoop aggregates
  // use clamped depths and exclude filtered-out zero-dimension members.
  const memberShapes: Shape3D[] = [];
  const builtMembers: typeof groupMembers = [];
  const builtDepths: number[] = [];
  for (const cutout of groupMembers) {
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

  let fused: Shape3D;
  if (memberShapes.length === 1) {
    fused = memberShapes[0];
  } else {
    fused = unwrap(fuseAll(memberShapes as ValidSolid[]));
    // fuseAll allocates a new handle; dispose the input member shapes.
    for (const s of memberShapes) s.delete();
  }

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
 * Build cutout cavity cuts for solid bins.
 * Cutouts cut down from the solid fill surface with configurable depth.
 * All cutout shapes are unioned into a single solid, then boolean-cut from the bin.
 *
 * @param params - Bin configuration (reads cutouts array and cutoutConfig.topOffset)
 * @param innerW - Interior width in mm (outer - 2*wall)
 * @param innerD - Interior depth in mm (outer - 2*wall)
 * @param wallHeight - Wall height in mm (Z extent from floor to wall top)
 */
export function buildCutoutCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D | null {
  if (params.cutouts.length === 0) return null;

  // Cutout x,y are relative to interior bottom-left corner (0,0).
  // The bin body is centered at model origin, so interior left/front is at -innerW/2, -innerD/2.
  const originX = -innerW / 2;
  const originY = -innerD / 2;

  // Global top offset: the solid fill surface is at wallHeight - topOffset
  const topOffset = params.cutoutConfig.topOffset;
  const solidSurfaceZ = wallHeight - topOffset;

  // Guard: if solidSurfaceZ is non-positive, there's no valid cutting surface
  // (the solid fill is at or below floor level). Skip all cutouts.
  if (solidSurfaceZ <= 0) return null;

  const cutoutShapes: Shape3D[] = [];

  // Partition cutouts by groupId: null -> ungrouped, same groupId -> collected
  const groups = new Map<string, typeof params.cutouts>();
  for (const cutout of params.cutouts) {
    if (cutout.groupId === null) {
      const shape = buildUngroupedCutout(cutout, solidSurfaceZ, originX, originY);
      if (shape) cutoutShapes.push(shape);
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
    const shape = buildGroupedCutouts(groupMembers, solidSurfaceZ, originX, originY);
    if (shape) cutoutShapes.push(shape);
  }

  // Per-cutout engraved label text on the bin top, adjacent to each cutout in
  // the user-picked side direction. Engrave-only (emboss requires a fuse-
  // target pass which lives in a follow-up; through-cut is meaningless on
  // bin-top text since it would punch through the bin floor).
  for (const cutout of params.cutouts) {
    if (cutout.hidden === true) continue;
    if (cutout.engraveLabel !== true) continue;
    const label = cutout.label.trim();
    if (label === '') continue;
    const textShape = buildCutoutLabelEngrave(
      cutout,
      label,
      params.textDefaults,
      solidSurfaceZ,
      originX,
      originY,
      innerW,
      innerD
    );
    if (textShape) cutoutShapes.push(textShape);
  }

  if (cutoutShapes.length === 0) return null;

  const fusedResult = fuseAllOrNull(cutoutShapes);
  if (!fusedResult) return null;
  // fuseAllOrNull may return cutoutShapes[0] directly when length === 1;
  // dispose the other inputs that were consumed by the fuse.
  if (cutoutShapes.length > 1) {
    for (const s of cutoutShapes) s.delete();
  }

  // Clip cutout union to bin interior so cutouts extending past walls don't
  // cut through them. The clip boundary covers from floor to the solid surface.
  const clipBoundary = box(innerW, innerD, solidSurfaceZ, { at: [0, 0, solidSurfaceZ / 2] });
  const clipped = unwrap(intersect(fusedResult, clipBoundary));
  fusedResult.delete();
  clipBoundary.delete();
  return clipped;
}

/**
 * Engraved text adjacent to a cutout, on the bin top surface.
 *
 * The side picker is interpreted in WORLD coordinates (top = +Y, etc.); text
 * reads left-to-right in world XY regardless of cutout rotation. The cutout
 * AABB used for placement IS rotation-aware so labels never overlap a rotated
 * cutout's footprint — `cutoutWorldAabb()` projects the four rotated corners
 * and takes their min/max.
 *
 * Available space = the gap between the cutout's rotated AABB edge and the
 * bin interior boundary in the chosen direction, minus 2·margin. Returns
 * `null` when even the minimum font size won't fit — better silent skip than
 * a visually broken engraving.
 */
function buildCutoutLabelEngrave(
  cutout: Cutout,
  label: string,
  textDefaults: BinParams['textDefaults'],
  solidSurfaceZ: number,
  originX: number,
  originY: number,
  innerW: number,
  innerD: number
): Shape3D | null {
  const side = cutout.textSide ?? 'top';
  // World-coord AABB of the cutout (in interior frame: origin at bin center),
  // rotation-aware so labels don't overlap a rotated cutout.
  const {
    minX: aabbMinX,
    maxX: aabbMaxX,
    minY: aabbMinY,
    maxY: aabbMaxY,
  } = cutoutWorldAabb(cutout, originX, originY);

  // Interior bounds in the same frame.
  const interiorMinX = -innerW / 2;
  const interiorMaxX = innerW / 2;
  const interiorMinY = -innerD / 2;
  const interiorMaxY = innerD / 2;

  let availW: number;
  let availD: number;
  let centerX: number;
  let centerY: number;
  switch (side) {
    case 'top':
      availW = aabbMaxX - aabbMinX;
      availD = interiorMaxY - aabbMaxY;
      centerX = (aabbMinX + aabbMaxX) / 2;
      centerY = (aabbMaxY + interiorMaxY) / 2;
      break;
    case 'bottom':
      availW = aabbMaxX - aabbMinX;
      availD = aabbMinY - interiorMinY;
      centerX = (aabbMinX + aabbMaxX) / 2;
      centerY = (interiorMinY + aabbMinY) / 2;
      break;
    case 'left':
      availW = aabbMinX - interiorMinX;
      availD = aabbMaxY - aabbMinY;
      centerX = (interiorMinX + aabbMinX) / 2;
      centerY = (aabbMinY + aabbMaxY) / 2;
      break;
    case 'right':
      availW = interiorMaxX - aabbMaxX;
      availD = aabbMaxY - aabbMinY;
      centerX = (aabbMaxX + interiorMaxX) / 2;
      centerY = (aabbMinY + aabbMaxY) / 2;
      break;
  }
  if (availW <= 0 || availD <= 0) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    // Cutout text is engrave-only this PR. The design-level mode is
    // intentionally ignored for cutouts (emboss-on-cutouts is a follow-up
    // that needs a fuse-target builder; through-cut would punch the floor).
    const result = buildTextSolid(scope, {
      text: label,
      fontFamily: textDefaults.font,
      mode: 'engrave',
      availW,
      availD,
      centerX,
      centerY,
      topZ: solidSurfaceZ,
      depth: textDefaults.depth,
      hostThickness: solidSurfaceZ,
      margin: textDefaults.margin,
      minFontSize: textDefaults.minFontSize,
      maxFontSize: textDefaults.maxFontSize,
    });
    return result ? unwrap(clone(result.solid)) : null;
  });
}
