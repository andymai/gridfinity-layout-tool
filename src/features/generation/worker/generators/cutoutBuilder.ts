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
} from 'brepjs';
import type { Shape3D, Edge, Dimension } from 'brepjs';
import type { BinParams, PathPoint } from '@/shared/types/bin';
import { MIN_PATH_POINTS } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './compartmentBuilder';

// ─── AABB Type ──────────────────────────────────────────────────────────────

/** Axis-aligned bounding box in XY. */
export interface AABB {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

// ─── Rotation-Safe AABB ─────────────────────────────────────────────────────

/**
 * Build a rotation-safe AABB for a positioned cutout member.
 * Uses the member's diagonal as a safe half-extent to account for any rotation.
 */
function computeRotationSafeAABB(cx: number, cy: number, width: number, depth: number): AABB {
  const diag = Math.sqrt(width ** 2 + depth ** 2) / 2;
  return { minX: cx - diag, minY: cy - diag, maxX: cx + diag, maxY: cy + diag };
}

// ─── Cutout Shape Builders ──────────────────────────────────────────────────

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
  // Guard: skip cutouts with degenerate dimensions that would crash WASM
  if (cutout.cutDepth <= 0 || cutout.width <= 0 || cutout.depth <= 0) return null;

  let shape: Shape3D;

  switch (cutout.shape) {
    case 'circle': {
      const rx = cutout.width / 2;
      const ry = cutout.depth / 2;
      if (Math.abs(rx - ry) < 0.01) {
        shape = cylinder(rx, cutout.cutDepth);
      } else {
        shape = sketch(drawEllipse(rx, ry), 'XY').extrude(cutout.cutDepth);
      }
      break;
    }
    case 'path': {
      try {
        shape = buildPathCutoutShape(cutout);
      } catch {
        // Self-intersecting or degenerate path — fall back to bounding box rectangle
        shape = box(cutout.width, cutout.depth, cutout.cutDepth, {
          at: [0, 0, cutout.cutDepth / 2],
        });
      }
      break;
    }
    case 'rectangle':
    default: {
      if (cutout.cornerRadius > 0) {
        const maxCR = Math.min(cutout.width, cutout.depth) / 2 - 0.01;
        shape = sketch(
          drawRoundedRectangle(cutout.width, cutout.depth, Math.min(cutout.cornerRadius, maxCR)),
          'XY'
        ).extrude(cutout.cutDepth);
      } else {
        shape = box(cutout.width, cutout.depth, cutout.cutDepth, {
          at: [0, 0, cutout.cutDepth / 2],
        });
      }
      break;
    }
  }

  // Apply rotation around Z axis (at origin, before translation)
  if (cutout.rotation !== 0) {
    shape = rotate(shape, -cutout.rotation, { axis: [0, 0, 1] });
  }

  return shape;
}

// ─── Path Cutout ────────────────────────────────────────────────────────────

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

// ─── Adaptive Fillet Constants ───────────────────────────────────────────────

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

// ─── Adaptive Fillet Helpers ─────────────────────────────────────────────────

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
      const result = fillet(shape, edges as Edge[], r);
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
 * - Normal perimeter edges get the full requested radius
 *
 * On failure, falls back to progressively reduced uniform radii.
 */
function applyAdaptiveScoop(
  shape: Shape3D,
  edges: readonly Edge[],
  targetRadius: number,
  memberBounds: readonly AABB[]
): Shape3D {
  // Per-edge radius callback
  const radiusCallback = (edge: Edge<Dimension>): number | null => {
    const len = curveLength(edge);

    if (len < MIN_EDGE_LENGTH) return null;

    // Short edges get proportionally reduced radius
    if (len < 2 * targetRadius) {
      const r = (len / 2) * SHORT_EDGE_MARGIN;
      return r < MIN_FILLET_RADIUS ? null : r;
    }

    // Classify as junction edge: edge center falls inside 2+ member AABBs
    const b = getBounds(edge);
    const midX = (b.xMin + b.xMax) / 2;
    const midY = (b.yMin + b.yMax) / 2;
    let containCount = 0;
    for (const mb of memberBounds) {
      if (midX >= mb.minX && midX <= mb.maxX && midY >= mb.minY && midY <= mb.maxY) {
        containCount++;
        if (containCount >= 2) break;
      }
    }

    if (containCount >= 2) {
      const r = targetRadius * JUNCTION_RADIUS_FACTOR;
      return r < MIN_FILLET_RADIUS ? null : r;
    }

    return targetRadius;
  };

  // Try adaptive per-edge fillet first
  try {
    const result = fillet(shape, edges as Edge[], radiusCallback);
    if (isOk(result)) return unwrap(result);
  } catch {
    // Fall through to uniform fallback
  }

  // Progressive uniform fallback
  return applyFilletWithFallback(shape, edges, targetRadius);
}

// ─── Cutout Processing Helpers ──────────────────────────────────────────────

/** Build and position an ungrouped cutout with individual scoop fillet. */
function buildUngroupedCutout(
  cutout: BinParams['cutouts'][number],
  solidSurfaceZ: number,
  originX: number,
  originY: number
): Shape3D | null {
  const effectiveDepth = Math.min(cutout.cutDepth, solidSurfaceZ);
  if (effectiveDepth <= 0) return null;

  let shape = buildCutoutShape({ ...cutout, cutDepth: effectiveDepth });
  if (!shape) return null;

  // Apply scoop radius fillet to bottom edges (before translation, at Z ~ 0)
  const maxScoop = Math.min(effectiveDepth, Math.min(cutout.width, cutout.depth) / 2) - 0.01;
  const scoopR = Math.min(cutout.scoopRadius ?? 0, Math.max(0, maxScoop));
  if (scoopR > 0) {
    const halfW = cutout.width / 2;
    const halfD = cutout.depth / 2;
    const scoopEdges = findBottomEdges(shape, 0, {
      minX: -halfW,
      minY: -halfD,
      maxX: halfW,
      maxY: halfD,
    });
    if (scoopEdges.length > 0) {
      shape = applyFilletWithFallback(shape, scoopEdges, scoopR);
    }
  }

  return translate(shape, [
    originX + cutout.x + cutout.width / 2,
    originY + cutout.y + cutout.depth / 2,
    solidSurfaceZ - effectiveDepth,
  ]);
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
    memberShapes.push(
      translate(shape, [
        originX + cutout.x + cutout.width / 2,
        originY + cutout.y + cutout.depth / 2,
        solidSurfaceZ - effectiveDepth,
      ])
    );
  }
  if (memberShapes.length === 0) return null;

  let fused = memberShapes.length === 1 ? memberShapes[0] : unwrap(fuseAll(memberShapes));

  // Determine group scoop radius and cut depth from built members only
  const groupScoopRadius = Math.max(...builtMembers.map((c) => c.scoopRadius ?? 0));
  const groupCutDepth = Math.min(...builtDepths);
  const minDim = Math.min(...builtMembers.map((c) => Math.min(c.width, c.depth)));
  const maxScoop = Math.min(groupCutDepth, minDim / 2) - 0.01;
  const scoopR = Math.min(groupScoopRadius, Math.max(0, maxScoop));

  if (scoopR > 0) {
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
      fused = applyAdaptiveScoop(fused, groupScoopEdges, scoopR, memberAABBs);
    }
  }

  return fused;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

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

  if (cutoutShapes.length === 0) return null;

  const fusedResult = fuseAllOrNull(cutoutShapes);
  if (!fusedResult) return null;

  // Clip cutout union to bin interior so cutouts extending past walls don't
  // cut through them. The clip boundary covers from floor to the solid surface.
  const clipBoundary = box(innerW, innerD, solidSurfaceZ, { at: [0, 0, solidSurfaceZ / 2] });
  return unwrap(intersect(fusedResult, clipBoundary));
}
