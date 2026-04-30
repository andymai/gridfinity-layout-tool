/**
 * Direct mesh generation for Gridfinity baseplates.
 *
 * Generates baseplate geometry procedurally by computing vertices and triangles
 * mathematically, without BREP boolean operations. This avoids the 2-15+ second
 * latency of the brepjs pipeline (solid modeling, boolean fuse/cut, tessellation).
 *
 * The output is geometrically equivalent to the simplified BREP version
 * (buildSimplifiedPocketCutter) — a waffle-grid slab with tapered pockets,
 * optional magnet holes, and a rounded outer perimeter.
 *
 * Coordinate system (matches baseplateGenerator.ts):
 * - Z=0: bottom face of baseplate
 * - Z=totalHeight: top face / pocket opening
 * - Without magnets: pockets through-cut (no floor)
 * - With magnets: slab is taller by (MAGNET_FLOOR + magnetDepth); pockets
 *   stop at SOCKET_HEIGHT depth, leaving a solid continuous floor. Magnet
 *   holes are blind cylindrical pockets cut downward from the pocket floor
 *   into the solid floor, leaving a thin retaining floor (MAGNET_FLOOR)
 *   at the bottom. Magnets are dropped in from the pocket side
 * - Grid centered at XY origin; slab offset by padding
 */

import type { BaseplateParams } from '@/shared/types/bin';
import { CONSTRAINTS } from '@/core/constants';
import { resolveCornerRadii } from './generatorConstants';
import type { MeshData } from '../../bridge/types';
import {
  SOCKET_HEIGHT,
  forEachCell,
  checkCancelled,
  MAGNET_FLOOR,
  MAGNET_OFFSETS,
  INSET_BOT,
  pocketCornerRadius,
  NUB_DIAMETER,
  NUB_DEPTH,
  HOLE_DIAMETER,
  HOLE_DEPTH,
  NUB_CIRCLE_SEGMENTS,
  computeConnectorPositions,
} from './generatorTypes';
import type { ProgressFn, CellInfo, ForEachCellOptions } from './generatorTypes';
/**
 * Line segments per rounded-corner quarter-arc.
 *
 * Tuned to roughly match BREP's preview-tessellation density (tolerance 0.5mm,
 * angular 45°), which yields ~8 segments per quarter on a 4mm corner radius.
 * Matching keeps the direct-mesh and BREP visually congruent so the swap on
 * line 145 (`hasDirectPreview`) doesn't pop. Used for both the slab perimeter
 * and the per-pocket arcs — the latter must agree with the gusset arcs in
 * {@link addCellCornerGussets} so the top-face lattice meets the pocket walls
 * without a seam.
 */
const CORNER_SEGMENTS = 8;

/** Number of segments for magnet hole circle approximation */
const CIRCLE_SEGMENTS = 16;

/**
 * Tiny offset (mm) applied to cancellation faces to prevent z-fighting.
 * Cancel faces are nudged toward the solid interior so the depth buffer
 * can distinguish them from the faces they visually punch through.
 */
const CANCEL_EPSILON = 0.05;
class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly norms: number[] = [];
  private readonly idx: number[] = [];

  /** Add a vertex with position and normal. Returns the vertex index. */
  pushVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    const index = this.positions.length / 3;
    this.positions.push(x, y, z);
    this.norms.push(nx, ny, nz);
    return index;
  }

  /** Add a triangle by 3 vertex indices (CCW winding from outside). */
  pushTriangle(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /**
   * Add a quad by 4 vertex indices (CCW winding from outside).
   * Vertices must be in order: a-b-c-d forming a planar quad.
   * Splits into triangles (a,b,c) and (a,c,d).
   */
  pushQuad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c, a, c, d);
  }

  /**
   * Add a flat-shaded triangle with computed face normal.
   * Duplicates vertices so each triangle has its own normal.
   */
  pushFlatTriangle(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
  ): void {
    const [nx, ny, nz] = faceNormal(x0, y0, z0, x1, y1, z1, x2, y2, z2);
    const a = this.pushVertex(x0, y0, z0, nx, ny, nz);
    const b = this.pushVertex(x1, y1, z1, nx, ny, nz);
    const c = this.pushVertex(x2, y2, z2, nx, ny, nz);
    this.pushTriangle(a, b, c);
  }

  /**
   * Add a flat-shaded quad (4 corners, CCW winding from outside).
   * Duplicates vertices for flat shading.
   */
  pushFlatQuad(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    x3: number,
    y3: number,
    z3: number
  ): void {
    const [nx, ny, nz] = faceNormal(x0, y0, z0, x1, y1, z1, x2, y2, z2);
    const a = this.pushVertex(x0, y0, z0, nx, ny, nz);
    const b = this.pushVertex(x1, y1, z1, nx, ny, nz);
    const c = this.pushVertex(x2, y2, z2, nx, ny, nz);
    const d = this.pushVertex(x3, y3, z3, nx, ny, nz);
    this.pushQuad(a, b, c, d);
  }

  /** Build the final MeshData. */
  build(): MeshData {
    return {
      vertices: new Float32Array(this.positions),
      normals: new Float32Array(this.norms),
      indices: new Uint32Array(this.idx),
      edgeVertices: new Float32Array(0),
      triangleCount: this.idx.length / 3,
    };
  }
}
/** Compute face normal for a CCW triangle. */
function faceNormal(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
): [number, number, number] {
  const ex = x1 - x0,
    ey = y1 - y0,
    ez = z1 - z0;
  const fx = x2 - x0,
    fy = y2 - y0,
    fz = z2 - z0;
  const nx = ey * fz - ez * fy;
  const ny = ez * fx - ex * fz;
  const nz = ex * fy - ey * fx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Generate points for a rounded rectangle centered at origin.
 * Returns CCW points when viewed from +Z looking down.
 *
 * Corner layout:
 *   3──────2    (back-left, back-right)
 *   │      │
 *   0──────1    (front-left, front-right)
 *
 * Path starts at front-left corner, goes right (CCW from outside = +Z).
 */
function roundedRectPoints(
  w: number,
  d: number,
  r: number,
  segments: number
): ReadonlyArray<readonly [number, number]> {
  const hw = w / 2;
  const hd = d / 2;
  const clampedR = Math.min(r, hw - 0.01, hd - 0.01);
  const effectiveR = Math.max(clampedR, 0);

  if (effectiveR < 0.01) {
    // Sharp corners
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
  }

  const pts: Array<[number, number]> = [];

  // Corner centers and start angles (CCW)
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [-hw + effectiveR, -hd + effectiveR, Math.PI], // front-left: 180° to 270°
    [hw - effectiveR, -hd + effectiveR, (3 * Math.PI) / 2], // front-right: 270° to 360°
    [hw - effectiveR, hd - effectiveR, 0], // back-right: 0° to 90°
    [-hw + effectiveR, hd - effectiveR, Math.PI / 2], // back-left: 90° to 180°
  ];

  for (const [cx, cy, startAngle] of corners) {
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * (Math.PI / 2);
      pts.push([cx + effectiveR * Math.cos(angle), cy + effectiveR * Math.sin(angle)]);
    }
  }

  return pts;
}

/**
 * Generate points for a rounded rectangle with selective corner rounding.
 * Only exterior corners (where both adjacent edges are exterior) get rounded.
 */
function roundedRectPointsSelective(
  w: number,
  d: number,
  r: number,
  segments: number,
  edges?: BaseplateParams['edges']
): ReadonlyArray<readonly [number, number]> {
  if (
    !edges ||
    (edges.left === 'exterior' &&
      edges.right === 'exterior' &&
      edges.front === 'exterior' &&
      edges.back === 'exterior')
  ) {
    return roundedRectPoints(w, d, r, segments);
  }

  const hw = w / 2;
  const hd = d / 2;
  const clampedR = Math.min(r, hw - 0.01, hd - 0.01);
  const effectiveR = Math.max(clampedR, 0);

  // Determine which corners are rounded
  const roundFL = edges.left === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundFR = edges.right === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundBR = edges.right === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;
  const roundBL = edges.left === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;

  const pts: Array<[number, number]> = [];

  // Corner data: [cx, cy, startAngle, shouldRound]
  const corners: ReadonlyArray<readonly [number, number, number, boolean]> = [
    [-hw + effectiveR, -hd + effectiveR, Math.PI, roundFL],
    [hw - effectiveR, -hd + effectiveR, (3 * Math.PI) / 2, roundFR],
    [hw - effectiveR, hd - effectiveR, 0, roundBR],
    [-hw + effectiveR, hd - effectiveR, Math.PI / 2, roundBL],
  ];

  // Sharp corner positions
  const sharpCorners: ReadonlyArray<readonly [number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];

  for (let c = 0; c < 4; c++) {
    const [cx, cy, startAngle, shouldRound] = corners[c];
    if (shouldRound) {
      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (i / segments) * (Math.PI / 2);
        pts.push([cx + effectiveR * Math.cos(angle), cy + effectiveR * Math.sin(angle)]);
      }
    } else {
      pts.push([sharpCorners[c][0], sharpCorners[c][1]]);
    }
  }

  return pts;
}
/**
 * Add pocket inner walls for one cell.
 *
 * Tapered walls from Z=totalHeight (full cell size) to Z=floorDepth (inset by INSET_BOT).
 * When floorDepth > 0 (magnets enabled), a solid floor is added at Z=floorDepth.
 * When floorDepth = 0 (no magnets), the pocket is through-cut (no floor).
 *
 * Walls face INWARD (normals point toward cell center = into the pocket). Adjacent
 * quads along the rounded-corner arcs share their perimeter vertices so that
 * `useMeshGeometry`'s `computeVertexNormals` + `toCreasedNormals(35°)` produces
 * smooth shading across each quarter-arc while preserving crisp creases at the
 * corner→edge transitions and at the pocket rim.
 */
function addPocketWalls(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  cellW_mm: number,
  cellD_mm: number,
  totalHeight: number,
  floorDepth: number
): void {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const botR = Math.max(cornerR - INSET_BOT, 0.1);

  // Top profile at Z = totalHeight (full cell size)
  const topPts = roundedRectPoints(cellW_mm, cellD_mm, cornerR, CORNER_SEGMENTS);
  // Bottom profile at Z = floorDepth (inset by INSET_BOT)
  const botW = cellW_mm - 2 * INSET_BOT;
  const botD = cellD_mm - 2 * INSET_BOT;
  const botPts = roundedRectPoints(botW, botD, botR, CORNER_SEGMENTS);

  const zTop = totalHeight;
  const zBot = floorDepth;

  const n = topPts.length;

  // Build top + bottom perimeter rings once and share vertex indices across
  // the adjacent wall quads. Normals are intentionally zeroed; they'll be
  // overwritten by `computeVertexNormals` downstream.
  const topRing = new Array<number>(n);
  const botRing = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    topRing[i] = mb.pushVertex(topPts[i][0] + cx, topPts[i][1] + cy, zTop, 0, 0, 0);
    botRing[i] = mb.pushVertex(botPts[i][0] + cx, botPts[i][1] + cy, zBot, 0, 0, 0);
  }

  // Tapered wall quads from top to bottom of pocket.
  // Inward-facing winding from inside the pocket: top_{i+1}, top_i, bot_i, bot_{i+1}.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    mb.pushQuad(topRing[j], topRing[i], botRing[i], botRing[j]);
  }

  // Pocket floor: when floorDepth > 0 (magnets enabled), cap the pocket bottom
  // with a solid face at Z=floorDepth facing UP into the pocket. Floor vertices
  // are emitted separately from the wall ring so the 90° crease at the floor
  // edge stays crisp (different normals: wall tilts inward+up, floor is flat +Z).
  if (floorDepth > 0) {
    const nx = 0,
      ny = 0,
      nz = 1;
    if (botW >= 0.2 && botD >= 0.2) {
      const center = mb.pushVertex(cx, cy, zBot, nx, ny, nz);
      const verts: number[] = [];
      for (const pt of botPts) {
        verts.push(mb.pushVertex(pt[0] + cx, pt[1] + cy, zBot, nx, ny, nz));
      }
      const nPts = verts.length;
      for (let i = 0; i < nPts; i++) {
        const j = (i + 1) % nPts;
        mb.pushTriangle(center, verts[i], verts[j]);
      }
    }
  }
}
/**
 * Add outer perimeter walls.
 *
 * Vertical walls from Z=totalHeight down to Z=0 following the outer profile.
 * Normals point OUTWARD (away from slab center).
 *
 * The outer profile goes CCW from +Z view. Outward-facing walls from a CCW
 * profile: for edge (i, i+1), the outward quad is top_i, top_{i+1}, bot_{i+1}, bot_i.
 */
function addOuterWalls(
  mb: MeshBuilder,
  outerPts: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number,
  totalHeight: number
): void {
  const n = outerPts.length;
  const zTop = totalHeight;
  const zBot = 0;

  // Shared top + bottom rings — adjacent wall quads reuse the same vertex
  // indices so `computeVertexNormals` averages face normals across the rounded
  // slab corners (smooth shading) while the 35° crease threshold keeps the
  // arc→flat-edge tangent points crisp where the dihedral exceeds threshold.
  const topRing = new Array<number>(n);
  const botRing = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const x = outerPts[i][0] + offsetX;
    const y = outerPts[i][1] + offsetY;
    topRing[i] = mb.pushVertex(x, y, zTop, 0, 0, 0);
    botRing[i] = mb.pushVertex(x, y, zBot, 0, 0, 0);
  }

  // CCW from outside: top_i, top_j, bot_j, bot_i.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    mb.pushQuad(topRing[i], topRing[j], botRing[j], botRing[i]);
  }
}
/**
 * Add a horizontal slab face (Z=z) facing ±Z, covering the slab outline minus
 * the pocket openings.
 *
 * The face is composed of two pieces:
 *   1. **Padding ring** between the outer perimeter and the grid bounding
 *      rectangle (skipped when there's no padding).
 *   2. **Per-cell corner gussets** — the small fillet-complement regions
 *      between each pocket's rounded corner and its cell's sharp corner.
 *      Adjacent cells' gussets meet at shared corners and tile the full
 *      inter-pocket lattice, so no inter-cell strips need to be emitted
 *      separately.
 *
 * Splitting along the cell boundaries (rather than emitting one giant
 * polygon-with-holes) avoids needing a triangulator and keeps the math
 * closed-form. Equivalent to BREP's `outer_face − ⋃(pocket_openings)`.
 *
 * `faceUp` selects the normal direction: `true` for the top face (+Z),
 * `false` for the through-cut bottom mirror (-Z, with reversed winding).
 */
function addPlateFace(
  mb: MeshBuilder,
  outerPts: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number,
  gridUnitMm: number,
  gridW: number,
  gridD: number,
  cells: ReadonlyArray<CellInfo>,
  z: number,
  faceUp: boolean
): void {
  const nz = faceUp ? 1 : -1;
  const gridHalfW = (gridW * gridUnitMm) / 2;
  const gridHalfD = (gridD * gridUnitMm) / 2;

  // Padding ring is needed only when the outer perimeter actually extends
  // beyond the grid bounding box (i.e. there is non-zero padding on at least
  // one side). The grid is centered at the origin; the slab is offset by
  // (offsetX, offsetY) when padding is asymmetric.
  const hasPadding = outerPts.some((pt) => {
    const x = pt[0] + offsetX;
    const y = pt[1] + offsetY;
    return (
      x < -gridHalfW - 0.01 || x > gridHalfW + 0.01 || y < -gridHalfD - 0.01 || y > gridHalfD + 0.01
    );
  });

  if (hasPadding) {
    addRingFace(mb, outerPts, offsetX, offsetY, gridHalfW, gridHalfD, z, 0, 0, nz, faceUp);
  }

  for (const cell of cells) {
    addCellCornerGussets(
      mb,
      cell.centerX,
      cell.centerY,
      cell.widthUnits * gridUnitMm,
      cell.depthUnits * gridUnitMm,
      z,
      faceUp,
      outerPts,
      offsetX,
      offsetY
    );
  }
}

/**
 * Even-odd ray cast for point-in-polygon. The polygon is given in local
 * coordinates with a translation offset — slab outer profiles are kept in
 * grid-relative form so the same `outerPts` array drives outer walls,
 * padding ring, and gusset clipping.
 */
function pointInPolygon(
  px: number,
  py: number,
  polygon: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0] + offsetX;
    const yi = polygon[i][1] + offsetY;
    const xj = polygon[j][0] + offsetX;
    const yj = polygon[j][1] + offsetY;
    if (yi > py !== yj > py) {
      const xCross = ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (px < xCross) inside = !inside;
    }
  }
  return inside;
}

/**
 * Emit the four per-corner fillet-complement gussets for one cell.
 *
 * Each pocket opening is a rounded rectangle inset from the cell's sharp
 * corner by `pocketCornerRadius`. The triangular-ish region between the
 * sharp corner and the rounded arc is solid material on the slab's top
 * (and bottom, in through-cut mode). Adjacent cells' gussets share their
 * cell-corner vertices, so emitting them per-cell produces a coherent
 * lattice across the whole grid without overlap or gaps.
 *
 * Each gusset is triangulated as a fan from the cell corner to the arc
 * samples — valid because the cell corner sees the entire arc with no
 * occlusion (the gusset is convex from that anchor).
 */
function addCellCornerGussets(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  cellW_mm: number,
  cellD_mm: number,
  z: number,
  faceUp: boolean,
  slabOuter: ReadonlyArray<readonly [number, number]>,
  slabOffsetX: number,
  slabOffsetY: number
): void {
  const r = pocketCornerRadius(cellW_mm, cellD_mm);
  if (r < 0.01) return;

  const hw = cellW_mm / 2;
  const hd = cellD_mm / 2;
  const nz = faceUp ? 1 : -1;

  // For each cell corner: anchor (sharp corner), arc center, and the angle at
  // which the rounded-rect's CCW arc *ends* at that corner. The gusset is
  // bounded by walking the arc backwards from that endpoint.
  const corners: ReadonlyArray<readonly [number, number, number, number, number]> = [
    // [cornerX, cornerY, arcCenterX, arcCenterY, arcEndAngle]
    [cx - hw, cy - hd, cx - hw + r, cy - hd + r, (3 * Math.PI) / 2], // front-left
    [cx + hw, cy - hd, cx + hw - r, cy - hd + r, 2 * Math.PI], // front-right
    [cx + hw, cy + hd, cx + hw - r, cy + hd - r, Math.PI / 2], // back-right
    [cx - hw, cy + hd, cx - hw + r, cy + hd - r, Math.PI], // back-left
  ];

  /**
   * Skip the gusset when the cell corner falls outside the slab outline.
   *
   * This happens at *grid-corner cells with no padding* — the slab outer
   * arc and the pocket arc share the same center and radius (both default
   * to SOCKET_CORNER_RADIUS), so the cell rectangle's corner sticks out
   * past the rounded slab boundary into empty space. Without this check
   * we'd emit a triangle of "ghost material" hanging off the slab.
   *
   * We test a point nudged slightly inward (toward the cell center) so a
   * corner *exactly* on a flat slab edge — paddingLeft=0 with a flush
   * grid-edge cell, for example — still counts as inside and gets its
   * gusset, since the slab edge there is the same as the cell edge and
   * the gusset is genuine material.
   */
  const insetEps = 0.1;
  for (const [cornerX, cornerY, arcCx, arcCy, arcEndAngle] of corners) {
    const dx = cx - cornerX;
    const dy = cy - cornerY;
    const len = Math.hypot(dx, dy) || 1;
    const probeX = cornerX + (dx / len) * insetEps;
    const probeY = cornerY + (dy / len) * insetEps;
    if (!pointInPolygon(probeX, probeY, slabOuter, slabOffsetX, slabOffsetY)) continue;

    const anchor = mb.pushVertex(cornerX, cornerY, z, 0, 0, nz);
    const arcVerts: number[] = [];
    // Walk arc from end angle backward by π/2 — keeps gusset CCW from +Z.
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const angle = arcEndAngle - (i / CORNER_SEGMENTS) * (Math.PI / 2);
      const ax = arcCx + r * Math.cos(angle);
      const ay = arcCy + r * Math.sin(angle);
      arcVerts.push(mb.pushVertex(ax, ay, z, 0, 0, nz));
    }
    for (let i = 0; i < CORNER_SEGMENTS; i++) {
      if (faceUp) {
        mb.pushTriangle(anchor, arcVerts[i], arcVerts[i + 1]);
      } else {
        mb.pushTriangle(anchor, arcVerts[i + 1], arcVerts[i]);
      }
    }
  }
}

/**
 * Generate a ring mesh between an outer polygon and an inner axis-aligned
 * rectangle at a fixed Z. Each outer point is projected onto the nearest
 * edge of the inner rectangle, and quads are formed between consecutive
 * outer-inner pairs.
 *
 * The inner rectangle is in the **grid frame** (centered at the origin), not
 * the slab frame — the grid stays at the origin while the slab shifts under
 * asymmetric padding (slabOffsetX/Y). Clamping to the slab-shifted rectangle
 * was a bug that placed the padding ring's inner edge in the wrong spot
 * whenever paddingLeft ≠ paddingRight or paddingFront ≠ paddingBack.
 */
function addRingFace(
  mb: MeshBuilder,
  outerPts: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number,
  innerHalfW: number,
  innerHalfD: number,
  z: number,
  fnx: number,
  fny: number,
  fnz: number,
  faceUp: boolean
): void {
  const n = outerPts.length;

  const outerVerts: number[] = [];
  const innerVerts: number[] = [];

  for (const pt of outerPts) {
    const ox = pt[0] + offsetX;
    const oy = pt[1] + offsetY;
    const ix = Math.max(-innerHalfW, Math.min(innerHalfW, ox));
    const iy = Math.max(-innerHalfD, Math.min(innerHalfD, oy));
    outerVerts.push(mb.pushVertex(ox, oy, z, fnx, fny, fnz));
    innerVerts.push(mb.pushVertex(ix, iy, z, fnx, fny, fnz));
  }

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (faceUp) {
      mb.pushQuad(outerVerts[i], outerVerts[j], innerVerts[j], innerVerts[i]);
    } else {
      mb.pushQuad(outerVerts[i], innerVerts[i], innerVerts[j], outerVerts[j]);
    }
  }
}
/**
 * Add the bottom face of the slab (Z=0), facing DOWN.
 *
 * Only generated when magnets are enabled (solid floor below pockets).
 * Through-cut baseplates have open pocket bottoms — no bottom face needed,
 * which avoids the z-fighting caused by the old cancellation mesh approach.
 */
function addSolidBottomFace(
  mb: MeshBuilder,
  outerPts: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number
): void {
  const z = 0;
  const nx = 0,
    ny = 0,
    nz = -1;
  const center = mb.pushVertex(offsetX, offsetY, z, nx, ny, nz);

  const outerVerts: number[] = [];
  for (const pt of outerPts) {
    outerVerts.push(mb.pushVertex(pt[0] + offsetX, pt[1] + offsetY, z, nx, ny, nz));
  }

  const nOuter = outerVerts.length;
  for (let i = 0; i < nOuter; i++) {
    const j = (i + 1) % nOuter;
    mb.pushTriangle(center, outerVerts[j], outerVerts[i]);
  }
}
/**
 * Generate circle points (CCW from +Z) centered at origin.
 */
function circlePoints(radius: number, segments: number): ReadonlyArray<readonly [number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    pts.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return pts;
}

/**
 * Add magnet holes for one cell, opening from the pocket floor (top side).
 *
 * Each magnet hole is a blind cylindrical pocket cut downward from the pocket
 * floor (Z=floorDepth) into the solid floor. The hole extends down by
 * magnetDepth, leaving a thin floor (MAGNET_FLOOR) at the bottom to retain
 * the magnet. Magnets are dropped in from the pocket side.
 *
 * For each magnet position in a full cell (4 corners at ±13mm from center):
 * - Cancel circle at Z=floorDepth facing DOWN — punches hole in pocket floor
 * - Cylinder wall from Z=floorDepth to Z=MAGNET_FLOOR (inward-facing)
 * - Floor circle at Z=MAGNET_FLOOR facing UP — the magnet sits on this
 */
function addMagnetHoles(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  magnetRadius: number,
  floorDepth: number
): void {
  const zTop = floorDepth; // pocket floor level (magnet hole opens here)
  const zBot = MAGNET_FLOOR; // thin floor that retains the magnet

  const circlePts = circlePoints(magnetRadius, CIRCLE_SEGMENTS);

  for (const [dx, dy] of MAGNET_OFFSETS) {
    const mx = cx + dx;
    const my = cy + dy;

    // Offset by CANCEL_EPSILON below the pocket floor to avoid z-fighting.
    {
      const cancelZ = zTop - CANCEL_EPSILON;
      const nx = 0,
        ny = 0,
        nz = -1;
      const center = mb.pushVertex(mx, my, cancelZ, nx, ny, nz);
      const verts: number[] = [];
      for (const pt of circlePts) {
        verts.push(mb.pushVertex(pt[0] + mx, pt[1] + my, cancelZ, nx, ny, nz));
      }
      const nPts = verts.length;
      // Facing -Z: CW from above → center, v_{j}, v_{i}
      for (let i = 0; i < nPts; i++) {
        const j = (i + 1) % nPts;
        mb.pushTriangle(center, verts[j], verts[i]);
      }
    }

    // Cylinder walls — share top/bottom ring vertices across adjacent quads so
    // the magnet hole reads as a smooth cylinder (vs. the prior 16-segment
    // facets the per-quad face normals produced).
    const wallTop = new Array<number>(CIRCLE_SEGMENTS);
    const wallBot = new Array<number>(CIRCLE_SEGMENTS);
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      const px = circlePts[i][0] + mx;
      const py = circlePts[i][1] + my;
      wallTop[i] = mb.pushVertex(px, py, zTop, 0, 0, 0);
      wallBot[i] = mb.pushVertex(px, py, zBot, 0, 0, 0);
    }
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      const j = (i + 1) % CIRCLE_SEGMENTS;
      // Inward-facing winding (from inside the cylinder looking outward):
      // top_{j}, top_{i}, bot_{i}, bot_{j}.
      mb.pushQuad(wallTop[j], wallTop[i], wallBot[i], wallBot[j]);
    }

    {
      const nx = 0,
        ny = 0,
        nz = 1;
      const center = mb.pushVertex(mx, my, zBot, nx, ny, nz);
      const verts: number[] = [];
      for (const pt of circlePts) {
        verts.push(mb.pushVertex(pt[0] + mx, pt[1] + my, zBot, nx, ny, nz));
      }
      const nPts = verts.length;
      // Facing +Z: CCW from above → center, v_{i}, v_{j}
      for (let i = 0; i < nPts; i++) {
        const j = (i + 1) % nPts;
        mb.pushTriangle(center, verts[i], verts[j]);
      }
    }
  }
}
/**
 * Add a cylindrical nub (male protrusion) at a wall face.
 *
 * The nub protrudes outward from the wall surface along the normal direction.
 * Circle lies in the plane perpendicular to the normal.
 */
function addConnectorNub(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  cz: number,
  nx: number,
  ny: number,
  nz: number,
  radius: number,
  depth: number
): void {
  // Tangent vectors perpendicular to the outward normal
  const [ux, uy, uz, vx, vy, vz] = tangentVectors(nx, ny);

  const tipX = cx + nx * depth;
  const tipY = cy + ny * depth;
  const tipZ = cz + nz * depth;

  // Generate circle points at base, tip (cylinder wall normals), and tip cap (face normal).
  // All three rings share the same XY offsets, so we compute them once per segment.
  const baseVerts: number[] = [];
  const tipVerts: number[] = [];
  const tipCapVerts: number[] = [];

  for (let i = 0; i < NUB_CIRCLE_SEGMENTS; i++) {
    const angle = (i / NUB_CIRCLE_SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Radial direction in the tangent plane
    const rnx = cos * ux + sin * vx;
    const rny = cos * uy + sin * vy;
    const rnz = cos * uz + sin * vz;

    const dx = radius * rnx;
    const dy = radius * rny;
    const dz = radius * rnz;

    baseVerts.push(mb.pushVertex(cx + dx, cy + dy, cz + dz, rnx, rny, rnz));
    tipVerts.push(mb.pushVertex(tipX + dx, tipY + dy, tipZ + dz, rnx, rny, rnz));
    tipCapVerts.push(mb.pushVertex(tipX + dx, tipY + dy, tipZ + dz, nx, ny, nz));
  }

  // Cylinder wall quads (outward-facing)
  for (let i = 0; i < NUB_CIRCLE_SEGMENTS; i++) {
    const j = (i + 1) % NUB_CIRCLE_SEGMENTS;
    // CCW from outside: base_i, tip_i, tip_j, base_j
    mb.pushQuad(baseVerts[i], tipVerts[i], tipVerts[j], baseVerts[j]);
  }

  // Tip cap (fan, normal = outward direction)
  const tipCenter = mb.pushVertex(tipX, tipY, tipZ, nx, ny, nz);
  for (let i = 0; i < NUB_CIRCLE_SEGMENTS; i++) {
    const j = (i + 1) % NUB_CIRCLE_SEGMENTS;
    mb.pushTriangle(tipCenter, tipCapVerts[i], tipCapVerts[j]);
  }
}

/**
 * Add a cylindrical hole (female indentation) at a wall face.
 *
 * Uses the same cancellation pattern as magnet holes: a cancel face punches
 * through the existing wall, cylinder walls go inward, and a floor closes it.
 */
function addConnectorHole(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  cz: number,
  nx: number,
  ny: number,
  nz: number,
  radius: number,
  depth: number
): void {
  const [ux, uy, uz, vx, vy, vz] = tangentVectors(nx, ny);

  // Hole goes inward (opposite to outward normal)
  const floorX = cx - nx * depth;
  const floorY = cy - ny * depth;
  const floorZ = cz - nz * depth;

  // Generate circle points
  const circlePts: Array<[number, number, number]> = [];
  for (let i = 0; i < NUB_CIRCLE_SEGMENTS; i++) {
    const angle = (i / NUB_CIRCLE_SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    circlePts.push([
      radius * (cos * ux + sin * vx),
      radius * (cos * uy + sin * vy),
      radius * (cos * uz + sin * vz),
    ]);
  }

  // Offset inward by CANCEL_EPSILON (opposite to normal) to avoid z-fighting.
  {
    const cancelCx = cx - nx * CANCEL_EPSILON;
    const cancelCy = cy - ny * CANCEL_EPSILON;
    const cancelCz = cz - nz * CANCEL_EPSILON;
    const center = mb.pushVertex(cancelCx, cancelCy, cancelCz, nx, ny, nz);
    const verts: number[] = [];
    for (const [dx, dy, dz] of circlePts) {
      verts.push(mb.pushVertex(cancelCx + dx, cancelCy + dy, cancelCz + dz, nx, ny, nz));
    }
    // Facing outward: CW from outside (reverse winding to cancel existing wall)
    for (let i = 0; i < NUB_CIRCLE_SEGMENTS; i++) {
      const j = (i + 1) % NUB_CIRCLE_SEGMENTS;
      mb.pushTriangle(center, verts[j], verts[i]);
    }
  }

  // Cylinder walls — share surface/floor ring vertices across adjacent quads
  // so the connector hole appears as a smooth cylinder rather than a faceted
  // prism.
  const surfRing = new Array<number>(NUB_CIRCLE_SEGMENTS);
  const floorRing = new Array<number>(NUB_CIRCLE_SEGMENTS);
  for (let i = 0; i < NUB_CIRCLE_SEGMENTS; i++) {
    const [dx, dy, dz] = circlePts[i];
    surfRing[i] = mb.pushVertex(cx + dx, cy + dy, cz + dz, 0, 0, 0);
    floorRing[i] = mb.pushVertex(floorX + dx, floorY + dy, floorZ + dz, 0, 0, 0);
  }
  for (let i = 0; i < NUB_CIRCLE_SEGMENTS; i++) {
    const j = (i + 1) % NUB_CIRCLE_SEGMENTS;
    // Inward-facing winding from inside the cylinder looking outward:
    // surf_{j}, surf_{i}, floor_{i}, floor_{j}.
    mb.pushQuad(surfRing[j], surfRing[i], floorRing[i], floorRing[j]);
  }

  {
    const center = mb.pushVertex(floorX, floorY, floorZ, nx, ny, nz);
    const verts: number[] = [];
    for (const [dx, dy, dz] of circlePts) {
      verts.push(mb.pushVertex(floorX + dx, floorY + dy, floorZ + dz, nx, ny, nz));
    }
    for (let i = 0; i < NUB_CIRCLE_SEGMENTS; i++) {
      const j = (i + 1) % NUB_CIRCLE_SEGMENTS;
      mb.pushTriangle(center, verts[i], verts[j]);
    }
  }
}

/**
 * Compute two orthogonal tangent vectors for an axis-aligned normal.
 * Returns [ux,uy,uz, vx,vy,vz] such that u × v = (nx, ny, 0),
 * ensuring correct cylinder winding for both positive and negative normals.
 */
function tangentVectors(nx: number, ny: number): [number, number, number, number, number, number] {
  if (Math.abs(nx) > 0.9) {
    const s = Math.sign(nx);
    return [0, s, 0, 0, 0, 1]; // u=±Y, v=Z → u×v aligns with nx
  }
  if (Math.abs(ny) > 0.9) {
    const s = Math.sign(ny);
    return [-s, 0, 0, 0, 0, 1]; // u=∓X, v=Z → u×v = (0, s, 0) aligns with ny
  }
  return [1, 0, 0, 0, 1, 0]; // Normal along Z (fallback)
}
/**
 * Generate baseplate mesh data procedurally without BREP boolean operations.
 *
 * Produces a waffle-grid slab with tapered pockets, optional magnet holes in a
 * solid floor, and a rounded outer perimeter. Targets <50ms for any grid size.
 */
export function generateBaseplateDirect(
  params: BaseplateParams,
  onProgress: ProgressFn,
  signal?: AbortSignal
): MeshData {
  // Guard against NaN/negative/infinite values that would produce degenerate geometry
  if (
    !Number.isFinite(params.width) ||
    params.width <= 0 ||
    !Number.isFinite(params.depth) ||
    params.depth <= 0
  ) {
    throw new Error(`Invalid baseplate dimensions: ${params.width}x${params.depth}`);
  }
  if (params.width > CONSTRAINTS.GRID_MAX || params.depth > CONSTRAINTS.GRID_MAX) {
    throw new Error(
      `Baseplate dimensions ${params.width}x${params.depth} exceed maximum ${CONSTRAINTS.GRID_MAX}`
    );
  }

  onProgress('base', 0);
  checkCancelled(signal);

  const {
    width,
    depth,
    gridUnitMm,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    edges,
    connectorNubs,
  } = params;

  const mb = new MeshBuilder();

  // Slab dimensions — taller when magnets require a solid floor
  const floorDepth = magnetHoles ? MAGNET_FLOOR + magnetDepth : 0;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const maxRadius = Math.min(totalW, totalD) / 2 - 0.1;
  const resolved = resolveCornerRadii(params, maxRadius);
  const cornerR = Math.min(Math.max(resolved.tl, resolved.tr, resolved.bl, resolved.br), maxRadius);

  // Slab center offset for asymmetric padding (grid stays at origin)
  const slabOffsetX = (paddingRight - paddingLeft) / 2;
  const slabOffsetY = (paddingBack - paddingFront) / 2;

  const cellOpts: ForEachCellOptions = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };

  // Collect all cells
  const cells: CellInfo[] = [];
  forEachCell(width, depth, (cell) => cells.push(cell), cellOpts);

  onProgress('base', 0.1);
  checkCancelled(signal);

  const outerPts = roundedRectPointsSelective(totalW, totalD, cornerR, CORNER_SEGMENTS, edges);

  addOuterWalls(mb, outerPts, slabOffsetX, slabOffsetY, totalHeight);

  onProgress('base', 0.2);
  checkCancelled(signal);

  for (const cell of cells) {
    const cellW_mm = cell.widthUnits * gridUnitMm;
    const cellD_mm = cell.depthUnits * gridUnitMm;
    addPocketWalls(mb, cell.centerX, cell.centerY, cellW_mm, cellD_mm, totalHeight, floorDepth);
  }

  onProgress('base', 0.5);
  checkCancelled(signal);

  addPlateFace(
    mb,
    outerPts,
    slabOffsetX,
    slabOffsetY,
    gridUnitMm,
    width,
    depth,
    cells,
    totalHeight,
    true
  );

  onProgress('base', 0.6);
  checkCancelled(signal);

  // Bottom: magnet variants get a fully-closed slab bottom (the floor under the
  // pockets is solid, so a single fan from the slab center is correct). Through-
  // cut variants mirror the top lattice instead — the slab is solid only between
  // pockets, and a flat bottom face there closes the slab band visible from
  // below.
  if (magnetHoles) {
    addSolidBottomFace(mb, outerPts, slabOffsetX, slabOffsetY);
  } else {
    addPlateFace(mb, outerPts, slabOffsetX, slabOffsetY, gridUnitMm, width, depth, cells, 0, false);
  }

  onProgress('base', 0.7);
  checkCancelled(signal);

  if (magnetHoles) {
    const magnetRadius = magnetDiameter / 2;
    for (const cell of cells) {
      if (cell.widthUnits < 1 || cell.depthUnits < 1) continue;
      addMagnetHoles(mb, cell.centerX, cell.centerY, magnetRadius, floorDepth);
    }
  }

  if (connectorNubs && edges) {
    const nubRadius = NUB_DIAMETER / 2;
    const holeRadius = HOLE_DIAMETER / 2;
    const connPositions = computeConnectorPositions(
      width,
      depth,
      gridUnitMm,
      totalHeight,
      totalW,
      totalD,
      slabOffsetX,
      slabOffsetY,
      edges,
      params.invertDovetails
    );
    for (const pos of connPositions) {
      if (pos.isMale) {
        addConnectorNub(mb, pos.cx, pos.cy, pos.cz, pos.nx, pos.ny, 0, nubRadius, NUB_DEPTH);
      } else {
        addConnectorHole(mb, pos.cx, pos.cy, pos.cz, pos.nx, pos.ny, 0, holeRadius, HOLE_DEPTH);
      }
    }
  }

  onProgress('base', 0.9);
  checkCancelled(signal);

  const result = mb.build();
  onProgress('base', 1);

  return result;
}
