/**
 * Interior feature builders for Gridfinity bins.
 *
 * Generates compartment divider walls, insert cavities, solid-mode cutouts,
 * label tabs with gusset supports, and finger scoop ramps.
 *
 * All features are built at Z=0 (bin floor level) and extend upward to
 * wallHeight. The caller (binGenerator orchestrator) positions them within
 * the assembled bin shell via boolean operations.
 */

import {
  draw,
  drawRoundedRectangle,
  drawRectangle,
  drawCircle,
  drawEllipse,
  unwrap,
  fuseAll,
  translate,
  fuse,
  fillet,
  intersect,
  rotate,
  edgeFinder,
  getBounds,
  isOk,
  curveLength,
} from 'brepjs';
import type { Shape3D, Edge, Drawing } from 'brepjs';
import type { BinParams, PathPoint, WallCutoutShape } from '@/shared/types/bin';
import { MIN_PATH_POINTS } from '@/shared/types/bin';
import { sketch } from './generatorTypes';
import {
  resolveScoopRadius,
  computeLipOffset,
  computeInteriorHeight,
} from '@/shared/utils/scoopCalculations';

// ─── Lip Constants (needed for scoop calculations) ───────────────────────────

import { LIP_HEIGHT, LIP_SMALL_TAPER, LIP_TAPER_WIDTH } from './generatorTypes';

// ─── AABB Type ──────────────────────────────────────────────────────────────

/** Axis-aligned bounding box in XY. */
interface AABB {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Fuse an array of shapes into one, returning null if the array is empty. */
function fuseAllOrNull(shapes: Shape3D[]): Shape3D | null {
  if (shapes.length === 0) return null;
  if (shapes.length === 1) return shapes[0];
  return unwrap(fuseAll(shapes));
}

/** Build a positioned wall segment solid. */
function buildWallSegment(w: number, d: number, height: number, x: number, y: number): Shape3D {
  const wall = sketch(drawRectangle(w, d), 'XY').extrude(height);
  return translate(wall, [x, y, 0]);
}

/**
 * Find consecutive wall segments along a boundary line.
 * Returns array of [start, end) index pairs where walls are needed.
 */
function findWallSegments(
  count: number,
  needsWall: (i: number) => boolean
): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  let segStart: number | null = null;

  for (let i = 0; i < count; i++) {
    if (needsWall(i)) {
      if (segStart === null) segStart = i;
    } else if (segStart !== null) {
      segments.push([segStart, i]);
      segStart = null;
    }
  }
  if (segStart !== null) {
    segments.push([segStart, count]);
  }
  return segments;
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
 * Build the 2D insert profile (Drawing) for a given insert shape.
 * All profiles are centered at the origin.
 */
function makeInsertProfile(
  shape: string,
  width: number,
  depth: number,
  cornerRadius: number
): Drawing {
  switch (shape) {
    case 'circle':
    case 'hexagon':
      // Hexagon approximated with circle (polygon support TBD)
      return drawCircle(width / 2);
    case 'rounded-rect': {
      const maxR = Math.min(width, depth) / 2 - 0.01;
      return drawRoundedRectangle(width, depth, Math.min(cornerRadius, maxR));
    }
    case 'slot':
      return drawRoundedRectangle(width, depth, Math.min(width, depth) / 2);
    case 'rectangle':
    default:
      return drawRectangle(width, depth);
  }
}

/**
 * Build a 45deg right-triangle profile for label tab gusset supports.
 * The triangle has its right angle at the origin, with legs extending
 * to (0, leg) and (-leg, leg).
 */
function buildGussetProfile(leg: number): Drawing {
  return draw([0, leg]).lineTo([-leg, leg]).lineTo([0, 0]).close();
}

/**
 * Find the bounding row/column range of a compartment by its ID.
 * Returns null if the compartment ID is not found in the grid.
 */
function findCompartmentBounds(
  compId: number,
  cols: number,
  rows: number,
  cells: readonly number[]
): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  let minCol = cols;
  let maxCol = -1;
  let minRow = rows;
  let maxRow = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r * cols + c] === compId) {
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
      }
    }
  }
  if (maxCol === -1) return null;
  return { minCol, maxCol, minRow, maxRow };
}

// ─── Compartment Walls ───────────────────────────────────────────────────────

/**
 * Build compartment divider walls inside the bin.
 *
 * Uses the compartment grid to derive wall segments: walls appear at
 * boundaries between cells with different compartment IDs. This supports
 * non-uniform compartment layouts (merged cells have no wall between them).
 *
 * Positioned from Z=0 (floor) to Z=wallHeight.
 */
export function buildCompartmentWalls(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D | null {
  const { cols, rows, thickness, cells } = params.compartments;

  // Single compartment = no walls needed
  if (cols <= 1 && rows <= 1) return null;
  if (new Set(cells).size <= 1) return null;

  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Effective free space per cell after accounting for internal divider thickness
  const effectiveCellW = (innerW - (cols - 1) * thickness) / cols;
  const effectiveCellD = (innerD - (rows - 1) * thickness) / rows;

  // Safety net: skip wall generation if cells are too small for viable geometry
  if (effectiveCellW < thickness * 2 || effectiveCellD < thickness * 2) return null;

  const wallSegments: Shape3D[] = [];

  // Vertical walls: between column boundaries
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const xPos = -innerW / 2 + colBoundary * cellW;
    const segments = findWallSegments(rows, (row) => {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];
      return leftId !== rightId;
    });

    for (const [start, end] of segments) {
      const segLength = (end - start) * cellD;
      const yCenter = -innerD / 2 + (start + (end - start) / 2) * cellD;
      wallSegments.push(buildWallSegment(thickness, segLength, wallHeight, xPos, yCenter));
    }
  }

  // Horizontal walls: between row boundaries
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const yPos = -innerD / 2 + rowBoundary * cellD;
    const segments = findWallSegments(cols, (col) => {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];
      return topId !== bottomId;
    });

    for (const [start, end] of segments) {
      const segLength = (end - start) * cellW;
      const xCenter = -innerW / 2 + (start + (end - start) / 2) * cellW;
      wallSegments.push(buildWallSegment(segLength, thickness, wallHeight, xCenter, yPos));
    }
  }

  return fuseAllOrNull(wallSegments);
}

// ─── Insert Cuts ─────────────────────────────────────────────────────────────

/**
 * Build insert cavity cuts.
 */
export function buildInsertCuts(params: BinParams): Shape3D | null {
  if (params.inserts.length === 0) return null;

  const insertShapes: Shape3D[] = [];

  for (const insert of params.inserts) {
    // Guard: skip inserts with degenerate dimensions that would crash WASM
    if (insert.cutDepth <= 0 || insert.width <= 0 || insert.depth <= 0) continue;

    const profile = makeInsertProfile(
      insert.shape,
      insert.width,
      insert.depth,
      insert.cornerRadius
    );
    const solid = sketch(profile, 'XY').extrude(insert.cutDepth);
    insertShapes.push(translate(solid, [insert.x, insert.y, 0]));
  }

  return fuseAllOrNull(insertShapes);
}

// ─── Cutout Builder (Solid Mode Only) ────────────────────────────────────────

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
        shape = sketch(drawCircle(rx), 'XY').extrude(cutout.cutDepth);
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
        shape = sketch(drawRectangle(cutout.width, cutout.depth), 'XY').extrude(cutout.cutDepth);
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
        shape = sketch(drawRectangle(cutout.width, cutout.depth), 'XY').extrude(cutout.cutDepth);
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

// ─── Adaptive Fillet Constants ───────────────────────────────────────────────

/** Find edges near a target Z height within XY bounds, with tolerance margins. */
function findBottomEdges(
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
function applyFilletWithFallback(shape: Shape3D, edges: readonly Edge[], radius: number): Shape3D {
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
  const radiusCallback = (edge: Edge): number | null => {
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
    sketch(drawRectangle(cutout.width, cutout.depth), 'XY').extrude(cutout.cutDepth);

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
const BEZIER_SEGMENTS = 12;

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
  const clipBoundary = sketch(drawRectangle(innerW, innerD), 'XY', 0).extrude(solidSurfaceZ);
  return unwrap(intersect(fusedResult, clipBoundary));
}

// ─── Label Tab Builder ───────────────────────────────────────────────────────

/**
 * Build label tabs for every compartment.
 *
 * Each tab is a flat shelf with support structure. Bracket style uses thin 45deg
 * triangular gussets (less filament, still strong). Solid style uses a
 * continuous 45deg triangle prism (maximum strength, still FDM-printable).
 *
 * Structure per compartment:
 *   - Flat shelf plate: tabWidth x tabDepth x wallThickness at the top
 *   - N interior gussets: 45deg right-triangle supports, each divider-thickness
 *     wide, placed evenly between the walls that already support the shelf ends.
 *     Gusset count keeps unsupported span <=10mm (conservative FDM bridge limit).
 *
 * Tabs are placed on the back edge of each compartment -- the outer back wall
 * for the rearmost row, or a row divider wall for interior rows. Merged cells
 * get a single tab at the back of the merged group.
 *
 * Tab width is auto-capped to compartment column width when the configured
 * width exceeds available space.
 *
 * @param params - Bin parameters (label config, compartments)
 * @param innerW - Interior width in mm (outer - 2 x wallThickness)
 * @param innerD - Interior depth in mm
 * @param wallHeight - Wall height in mm (Z extent from floor to wall top)
 * @param wallThickness - Bin wall thickness in mm (used for shelf thickness)
 */
export function buildLabelTabs(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): Shape3D | null {
  if (!params.label.enabled) return null;

  const { cols, rows, thickness, cells } = params.compartments;
  const tabDepth = params.label.depth;
  const widthPercent = params.label.width; // 1-100%
  const alignment = params.label.alignment;
  const wt = wallThickness;
  const gt = thickness; // gusset thickness = compartment divider thickness

  // 45deg triangle envelope: height = depth
  const tabHeight = tabDepth;

  // Safety: tab must fit within wall height
  if (tabHeight > wallHeight || tabHeight <= 0) return null;

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const allTabs: Shape3D[] = [];

  // Iterate per-row, grouping consecutive same-compartment columns that share
  // a back edge at this row. This produces one tab spanning merged columns
  // instead of separate per-column tabs with incorrect divider deductions.
  for (let row = 0; row < rows; row++) {
    const isLastRow = row === rows - 1;
    let col = 0;

    while (col < cols) {
      const cellId = cells[row * cols + col];
      const nextRowCellId = isLastRow ? undefined : cells[(row + 1) * cols + col];

      // Check if this cell has a back edge (last row, or different compId behind)
      const hasBackEdge = isLastRow || cellId !== nextRowCellId;
      if (!hasBackEdge) {
        col++;
        continue;
      }

      // Find extent of consecutive same-compId columns with back edges at this row
      let groupEnd = col + 1;
      while (groupEnd < cols) {
        const gCellId = cells[row * cols + groupEnd];
        const gNextRowCellId = isLastRow ? undefined : cells[(row + 1) * cols + groupEnd];
        if (gCellId !== cellId || !(isLastRow || gCellId !== gNextRowCellId)) break;
        groupEnd++;
      }

      const groupCols = groupEnd - col;
      const groupMinCol = col;
      const groupMaxCol = groupEnd - 1;

      // Compute available width for the column group.
      // Deduct thickness only at boundaries with actual divider walls --
      // merged columns share no divider, so no deduction between them.
      const groupLeft = -innerW / 2 + groupMinCol * cellW;
      const groupRight = groupLeft + groupCols * cellW;

      const hasLeftWall = groupMinCol === 0 || cells[row * cols + (groupMinCol - 1)] !== cellId;
      const hasRightWall =
        groupMaxCol === cols - 1 || cells[row * cols + (groupMaxCol + 1)] !== cellId;

      const leftDeduction =
        groupMinCol > 0 && cells[row * cols + (groupMinCol - 1)] !== cellId ? thickness / 2 : 0;
      const rightDeduction =
        groupMaxCol < cols - 1 && cells[row * cols + (groupMaxCol + 1)] !== cellId
          ? thickness / 2
          : 0;

      const availableLeft = groupLeft + leftDeduction;
      const availableRight = groupRight - rightDeduction;
      const availableWidth = availableRight - availableLeft;

      // Compute tab width from percentage of available group width
      const tabWidth = (availableWidth * widthPercent) / 100;
      if (tabWidth <= 0) {
        col = groupEnd;
        continue;
      }

      // Compute X offset based on alignment within the group
      let tabXStart: number;
      if (alignment === 'left') {
        tabXStart = availableLeft;
      } else if (alignment === 'right') {
        tabXStart = availableRight - tabWidth;
      } else {
        const availableCenter = (availableLeft + availableRight) / 2;
        tabXStart = availableCenter - tabWidth / 2;
      }

      // Y position: back edge of this row
      const backEdgeY = -innerD / 2 + (row + 1) * cellD;

      // -- Determine which ends touch a wall --
      const fullWidth = tabWidth >= availableWidth - 0.01;
      const touchesLeft = (fullWidth || alignment === 'left') && hasLeftWall;
      const touchesRight = (fullWidth || alignment === 'right') && hasRightWall;

      // -- Shelf: flat plate with rounded front corners on free ends --
      // XY footprint extruded along Z for wallThickness.
      // Only front corners (away from back wall) are rounded on free ends.
      const cornerR = 1; // mm
      let pen = draw([0, 0]).lineTo([tabWidth, 0]).lineTo([tabWidth, -tabDepth]);
      if (!touchesRight) pen = pen.customCorner(cornerR);
      pen = pen.lineTo([0, -tabDepth]);
      if (!touchesLeft) pen = pen.customCorner(cornerR);
      const shelf = sketch(pen.close(), 'XY', tabHeight - wt).extrude(wt);

      // -- Gussets: 45deg triangular supports under the shelf --
      // Free ends get edge gussets for structural support.
      // Interior gussets keep unsupported span <=10mm (FDM bridge limit).
      const gussetLeg = tabHeight - wt;
      const maxSpan = 10; // mm

      let tabSolid: Shape3D = shelf;

      // Guard: if gussetLeg <= 0 (tabHeight <= wallThickness), there's no room
      // for support structure. Skip gusset/solid generation to avoid degenerate geometry.
      if (gussetLeg > 0) {
        // Collect all gusset X positions (left edge of each gusset)
        const gussetPositions: number[] = [];

        // Edge gussets at free ends
        if (!touchesLeft) gussetPositions.push(0);
        if (!touchesRight) gussetPositions.push(tabWidth - gt);

        // Interior gussets between the outermost supports
        const leftSupport = touchesLeft ? 0 : gt;
        const rightSupport = touchesRight ? tabWidth : tabWidth - gt;
        const interiorSpan = rightSupport - leftSupport;
        const numInterior = Math.max(0, Math.ceil(interiorSpan / maxSpan) - 1);
        for (let g = 0; g < numInterior; g++) {
          const center = leftSupport + (interiorSpan * (g + 1)) / (numInterior + 1);
          gussetPositions.push(center - gt / 2);
        }

        const gussetProfile = buildGussetProfile(gussetLeg);

        if (params.label.support === 'solid') {
          // Solid style: single continuous 45deg right-triangle prism under the shelf
          const solidSupport = sketch(gussetProfile, 'YZ', 0).extrude(tabWidth);
          tabSolid = unwrap(fuse(tabSolid, solidSupport));
        } else if (gussetPositions.length > 0) {
          // Bracket style: discrete triangular gussets at edges + every <=10mm
          const gussetShapes: Shape3D[] = gussetPositions.map((gx) => {
            const gusset = sketch(gussetProfile, 'YZ', 0).extrude(gt);
            return translate(gusset, [gx, 0, 0]);
          });

          tabSolid = unwrap(fuse(tabSolid, unwrap(fuseAll(gussetShapes))));
        }
      }

      // Position: X at alignment offset, Y at compartment back edge, Z at tab base
      tabSolid = translate(tabSolid, [tabXStart, backEdgeY, wallHeight - tabHeight]);

      allTabs.push(tabSolid);

      col = groupEnd;
    }
  }

  return fuseAllOrNull(allTabs);
}

// ─── Finger Scoop Builder ────────────────────────────────────────────────────

/**
 * Build finger scoop ramps that curve from the bin floor up to the front wall.
 *
 * Each scoop is a solid ramp with a concave quarter-cylinder inner surface,
 * fused into the bin interior at the front edge of each compartment. The
 * ramp fills the wall-floor junction and the concave curve helps slide
 * items out of the bin.
 *
 * Scoops are placed at the front edge of every compartment row.
 * For merged compartments spanning multiple columns, a single scoop spans
 * the full merged width.
 *
 * When the bin has a stacking lip and the scoop is at the outer front wall
 * (row 0), the scoop is offset inward by the lip overhang so its top edge
 * meets the lip's protruding inner face, providing a smooth exit path.
 *
 * @param params - Bin parameters (scoop config, compartments)
 * @param innerW - Interior width in mm (outer - 2 x wallThickness)
 * @param innerD - Interior depth in mm
 * @param wallHeight - Full wall height in mm (box body Z extent)
 * @param wallThickness - Outer wall thickness in mm
 * @returns Fused ramp shape, or null if no scoops were built
 */
export function buildScoopRamps(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): Shape3D | null {
  if (!params.scoop.enabled) return null;
  if (params.style !== 'standard') return null;

  const hasLip = params.base.stackingLip;
  const interiorHeight = computeInteriorHeight(wallHeight, hasLip, LIP_SMALL_TAPER);

  const { cols, rows, cells } = params.compartments;

  const cellW = innerW / cols;
  const cellD = innerD / rows;

  const processedCompartments = new Set<number>();
  const scoopShapes: Shape3D[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const compId = cells[row * cols + col];
      if (processedCompartments.has(compId)) continue;
      processedCompartments.add(compId);

      const bounds = findCompartmentBounds(compId, cols, rows, cells);
      if (!bounds) continue;

      const { minCol, maxCol, minRow, maxRow } = bounds;
      const compCols = maxCol - minCol + 1;
      const compRows = maxRow - minRow + 1;
      const compW = compCols * cellW;
      const compD = compRows * cellD;

      const isMinRow = minRow === 0;
      const lipOffset = computeLipOffset(hasLip, isMinRow, LIP_TAPER_WIDTH, wallThickness);
      const radius = resolveScoopRadius(
        params.scoop.radius,
        compW,
        compD,
        isMinRow,
        hasLip,
        wallHeight,
        interiorHeight,
        lipOffset
      );
      if (radius === 0) continue;

      // Build scoop ramp solid.
      // Profile in YZ plane: draw([u, v]) where u->Y (depth), v->Z (height).
      //
      // Without lip offset (lipOffset = 0):
      //   (0, 0) -> (0, R) -> arc -> (R, 0) -> close
      //
      // With lip offset (lo), extends to wallHeight so scoop meets lip:
      //   (0, 0) -> (0, wH) -> (lo, wH) -> (lo, R) -> arc -> (lo+R, 0) -> close
      //   Goes up the wall to wallHeight, across to the lip's inner face,
      //   down to arc start at R, then curves to floor. Fills solid.
      const segments = 24;
      const points: [number, number][] = [];
      // Start at wall/floor corner
      points.push([0, 0]);
      if (lipOffset > 0) {
        // Up the wall to wallHeight (lip base), across to lip inner face
        points.push([0, wallHeight]);
        points.push([lipOffset, wallHeight]);
        // Down to arc start (only needed when radius < wallHeight)
        if (radius < wallHeight) {
          points.push([lipOffset, radius]);
        }
      } else {
        // Standard: up the wall to scoop height
        points.push([0, radius]);
      }
      // Concave arc from (lipOffset, radius) to (lipOffset + radius, 0)
      for (let i = 1; i < segments; i++) {
        const angle = (Math.PI / 2) * (i / segments);
        const arcY = lipOffset + radius * (1 - Math.cos(angle));
        const arcZ = radius * (1 - Math.sin(angle));
        points.push([arcY, arcZ]);
      }
      // Floor, lipOffset + radius away from wall
      points.push([lipOffset + radius, 0]);

      // Draw the profile (will be sketched on YZ and extruded along X)
      let pen = draw(points[0]);
      for (let i = 1; i < points.length; i++) {
        pen = pen.lineTo(points[i]);
      }
      const profile = pen.close();

      // Sketch on YZ plane and extrude along X for the compartment width
      let scoopSolid = sketch(profile, 'YZ', -compW / 2).extrude(compW);

      // Fillet the two longitudinal edges where the ramp meets the wall and floor.
      // Before translation, the scoop solid spans X=[-compW/2, +compW/2] with
      // Y=[lipOffset, lipOffset+radius], Z=[0, radius]. The sharp edges are:
      //   - Top-of-ramp: (Y~lipOffset, Z~radius) -- ramp meets wall/lip
      //   - Floor-of-ramp: (Y~lipOffset+radius, Z~0) -- ramp meets bin floor
      const filletR = Math.min(2, radius / 4);
      if (filletR >= 0.5) {
        const smoothEdges = edgeFinder()
          .when((e) => {
            const b = getBounds(e);
            // Edge must run along X (span most of the compartment width)
            if (b.xMax - b.xMin < compW * 0.5) return false;
            // Top-of-ramp edge: Y~lipOffset, Z~radius
            const isTop =
              Math.abs(b.yMin - lipOffset) < 0.5 &&
              Math.abs(b.yMax - lipOffset) < 0.5 &&
              Math.abs(b.zMin - radius) < 0.5 &&
              Math.abs(b.zMax - radius) < 0.5;
            // Floor-of-ramp edge: Y~lipOffset+radius, Z~0
            const floorY = lipOffset + radius;
            const isFloor =
              Math.abs(b.yMin - floorY) < 0.5 &&
              Math.abs(b.yMax - floorY) < 0.5 &&
              Math.abs(b.zMin) < 0.5 &&
              Math.abs(b.zMax) < 0.5;
            return isTop || isFloor;
          })
          .findAll(scoopSolid);
        if (smoothEdges.length > 0) {
          scoopSolid = applyFilletWithFallback(scoopSolid, smoothEdges, filletR);
        }
      }

      // Position: center X at compartment center, Y at front edge of compartment
      const compCenterX = -innerW / 2 + (minCol + compCols / 2) * cellW;
      const frontEdgeY = -innerD / 2 + minRow * cellD;

      scoopShapes.push(translate(scoopSolid, [compCenterX, frontEdgeY, 0]));
    }
  }

  return fuseAllOrNull(scoopShapes);
}

// ─── Wall Cutout Builder ──────────────────────────────────────────────────────

/** Auto-compute corner radius: 15% of the smaller dimension, clamped to [0.5, 5] mm. */
function autoCornerRadius(cutWidth: number, cutHeight: number): number {
  return Math.max(0.5, Math.min(5, Math.min(cutWidth * 0.15, cutHeight * 0.15)));
}

/** Funnel taper ratio: bottom width is 60% of top width. */
const FUNNEL_TAPER_RATIO = 0.6;

/**
 * Build a 2D cutout profile (Drawing) for the given shape.
 *
 * The profile is centered at the origin in 2D space (X = horizontal, Y = vertical).
 * Total height includes overshoot above the wall top.
 *
 * @param cutoutShape - Shape style
 * @param cutWidth - Horizontal span of the cutout in mm
 * @param userCutHeight - User-visible height (depth from wall top) in mm
 * @param overshoot - Extra height above wall top for clean boolean cuts
 */
function buildCutoutProfile(
  cutoutShape: WallCutoutShape,
  cutWidth: number,
  userCutHeight: number,
  overshoot: number
): Drawing {
  const totalHeight = userCutHeight + overshoot;

  switch (cutoutShape) {
    case 'scoop': {
      // Semicircle arc clamped by available height (floor boundary).
      // When cutWidth/2 > userCutHeight, the arc becomes a shallow circular
      // segment instead of a full semicircle.
      const hw = cutWidth / 2;
      const sagitta = Math.min(hw, userCutHeight);
      const topY = totalHeight / 2;
      const arcCenterY = topY - overshoot; // Y where the flat top meets the arc
      return draw([-hw, topY])
        .lineTo([hw, topY])
        .lineTo([hw, arcCenterY])
        .sagittaArc(-cutWidth, 0, sagitta)
        .close();
    }

    case 'funnel': {
      // Tapered U: wider at top, narrower at bottom with rounded corners.
      const cornerR = autoCornerRadius(cutWidth, userCutHeight);
      const safeR = Math.min(cornerR, cutWidth / 2 - 0.01, userCutHeight / 2 - 0.01);

      const topHW = cutWidth / 2;
      const bottomHW = (cutWidth * FUNNEL_TAPER_RATIO) / 2;
      const topY = totalHeight / 2;
      const bottomY = -totalHeight / 2;

      // Draw trapezoid: top-left -> top-right -> bottom-right -> bottom-left -> close
      let pen = draw([-topHW, topY]).lineTo([topHW, topY]).lineTo([bottomHW, bottomY]);
      if (safeR > 0.1) pen = pen.customCorner(safeR);
      pen = pen.lineTo([-bottomHW, bottomY]);
      if (safeR > 0.1) pen = pen.customCorner(safeR);
      return pen.close();
    }

    default: {
      // U-shape: rounded rectangle (existing behavior)
      const cornerR = autoCornerRadius(cutWidth, userCutHeight);
      const safeR = Math.min(cornerR, cutWidth / 2 - 0.01, userCutHeight / 2 - 0.01);
      if (safeR > 0.1) {
        return drawRoundedRectangle(cutWidth, totalHeight, safeR);
      }
      return drawRectangle(cutWidth, totalHeight);
    }
  }
}

/**
 * Build a single cutout solid from a 2D profile, extruded and positioned.
 *
 * @returns Positioned Shape3D ready for boolean subtraction
 */
function buildSingleCutout(
  cutoutShape: WallCutoutShape,
  cutWidth: number,
  userCutHeight: number,
  overshoot: number,
  extrudeDepth: number,
  wallHeight: number,
  position: { x: number; y: number; rotateZ: number }
): Shape3D {
  const profile = buildCutoutProfile(cutoutShape, cutWidth, userCutHeight, overshoot);

  // Sketch on XZ plane: X = horizontal span, Z = vertical height.
  // Extrusion goes along -Y (through the wall).
  let shape = sketch(profile, 'XZ').extrude(extrudeDepth);

  // Center extrusion around Y=0 so the cut straddles the wall face.
  shape = translate(shape, [0, extrudeDepth / 2, 0]);

  if (position.rotateZ !== 0) {
    shape = rotate(shape, position.rotateZ, { axis: [0, 0, 1] });
  }

  // Position: bottom of visible cutout at (wallHeight - userCutHeight),
  // shape center is offset upward by overshoot/2 from the visual center
  const cutZ = wallHeight - userCutHeight / 2 + overshoot / 2;
  return translate(shape, [position.x, position.y, cutZ]);
}

/**
 * Build wall cutout cuts for all enabled sides and interior divider walls.
 *
 * Supports multiple cutout shapes: u-shape (rectangular notch with rounded corners),
 * scoop (semicircle), and funnel (tapered U with wider top, narrower bottom).
 */
export function buildWallCutoutCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
): Shape3D | null {
  if (!params.walls.enabled) return null;

  const wallThickness = params.wallThickness;
  const cutShapes: Shape3D[] = [];
  const cutoutShape = params.walls.shape;

  const resolveEffective = (side: 'front' | 'back' | 'left' | 'right' | 'interior') => {
    const cfg = params.walls[side];
    return cfg.enabled
      ? { effectiveWidth: cfg.width, effectiveDepth: cfg.depth }
      : { effectiveWidth: 0, effectiveDepth: 0 };
  };

  const maxThickness = Math.max(wallThickness, params.compartments.thickness);
  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const extrudeDepth = (maxThickness + lipOverhang) * 2 + 1;
  const overshoot = (hasLip ? LIP_HEIGHT : 0) + 2;

  const sides: Array<{
    key: 'front' | 'back' | 'left' | 'right';
    wallSpan: number;
    x: number;
    y: number;
    rotateZ: number;
  }> = [
    { key: 'front', wallSpan: innerW, x: 0, y: -innerD / 2, rotateZ: 0 },
    { key: 'back', wallSpan: innerW, x: 0, y: innerD / 2, rotateZ: 0 },
    { key: 'left', wallSpan: innerD, x: -innerW / 2, y: 0, rotateZ: 90 },
    { key: 'right', wallSpan: innerD, x: innerW / 2, y: 0, rotateZ: 90 },
  ];

  for (const side of sides) {
    const { effectiveWidth, effectiveDepth } = resolveEffective(side.key);
    if (effectiveWidth <= 0 || effectiveDepth <= 0) continue;

    const cutWidth = side.wallSpan * (effectiveWidth / 100);
    const interiorHeight = wallHeight - wallThickness;
    const userCutHeight = interiorHeight * (effectiveDepth / 100);
    if (cutWidth < 0.1 || userCutHeight < 0.1) continue;

    cutShapes.push(
      buildSingleCutout(cutoutShape, cutWidth, userCutHeight, overshoot, extrudeDepth, wallHeight, {
        x: side.x,
        y: side.y,
        rotateZ: side.rotateZ,
      })
    );
  }

  // Interior divider walls
  if (params.walls.interior.enabled) {
    const { effectiveWidth, effectiveDepth } = resolveEffective('interior');
    if (effectiveWidth > 0 && effectiveDepth > 0) {
      const { cols, rows, cells } = params.compartments;
      if (cols > 1 || rows > 1) {
        const cellW = innerW / cols;
        const cellD = innerD / rows;
        const interiorH = wallHeight - wallThickness;

        const addDividerCutouts = (
          boundaryCount: number,
          segCount: number,
          getCellIds: (boundary: number, i: number) => [number, number],
          getPosition: (
            boundary: number,
            start: number,
            end: number
          ) => { x: number; y: number; rotateZ: number },
          segCellSize: number
        ): void => {
          for (let boundary = 1; boundary < boundaryCount; boundary++) {
            const segments = findWallSegments(segCount, (i) => {
              const [id1, id2] = getCellIds(boundary, i);
              return id1 !== id2;
            });

            for (const [start, end] of segments) {
              const segLength = (end - start) * segCellSize;
              const cutW = segLength * (effectiveWidth / 100);
              const cutH = interiorH * (effectiveDepth / 100);
              if (cutW < 0.1 || cutH < 0.1) continue;

              cutShapes.push(
                buildSingleCutout(
                  cutoutShape,
                  cutW,
                  cutH,
                  overshoot,
                  extrudeDepth,
                  wallHeight,
                  getPosition(boundary, start, end)
                )
              );
            }
          }
        };

        // Vertical divider walls (between columns)
        addDividerCutouts(
          cols,
          rows,
          (boundary, row) => [cells[row * cols + (boundary - 1)], cells[row * cols + boundary]],
          (boundary, start, end) => ({
            x: -innerW / 2 + boundary * cellW,
            y: -innerD / 2 + (start + (end - start) / 2) * cellD,
            rotateZ: 90,
          }),
          cellD
        );

        // Horizontal divider walls (between rows)
        addDividerCutouts(
          rows,
          cols,
          (boundary, col) => [cells[(boundary - 1) * cols + col], cells[boundary * cols + col]],
          (boundary, start, end) => ({
            x: -innerW / 2 + (start + (end - start) / 2) * cellW,
            y: -innerD / 2 + boundary * cellD,
            rotateZ: 0,
          }),
          cellW
        );
      }
    }
  }

  return fuseAllOrNull(cutShapes);
}
