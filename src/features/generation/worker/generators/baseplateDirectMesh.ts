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
import type { MeshData } from '../../bridge/types';
import {
  SOCKET_HEIGHT,
  forEachCell,
  checkCancelled,
  PLATE_CORNER_RADIUS,
  MAGNET_FLOOR,
  MAGNET_OFFSETS,
  INSET_BOT,
  pocketCornerRadius,
} from './generatorTypes';
import type { ProgressFn, CellInfo, ForEachCellOptions } from './generatorTypes';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Number of line segments per rounded corner arc */
const CORNER_SEGMENTS = 4;

/** Number of segments for magnet hole circle approximation */
const CIRCLE_SEGMENTS = 16;

// ─── Mesh Builder ───────────────────────────────────────────────────────────

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

// ─── Geometry Utilities ─────────────────────────────────────────────────────

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

// ─── Pocket Mesh Generation ─────────────────────────────────────────────────

/**
 * Add pocket inner walls for one cell.
 *
 * Tapered walls from Z=totalHeight (full cell size) to Z=floorDepth (inset by INSET_BOT).
 * When floorDepth > 0 (magnets enabled), a solid floor is added at Z=floorDepth.
 * When floorDepth = 0 (no magnets), the pocket is through-cut (no floor).
 *
 * Walls face INWARD (normals point toward cell center = into the pocket).
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

  // Tapered wall quads from top to bottom of pocket.
  // Normals point INWARD (toward pocket center).
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;

    const tx0 = topPts[i][0] + cx,
      ty0 = topPts[i][1] + cy;
    const tx1 = topPts[j][0] + cx,
      ty1 = topPts[j][1] + cy;
    const bx0 = botPts[i][0] + cx,
      by0 = botPts[i][1] + cy;
    const bx1 = botPts[j][0] + cx,
      by1 = botPts[j][1] + cy;

    // From outside the solid (= inside the pocket), CCW is: top1, top0, bot0, bot1
    mb.pushFlatQuad(tx1, ty1, zTop, tx0, ty0, zTop, bx0, by0, zBot, bx1, by1, zBot);
  }

  // Pocket floor: when floorDepth > 0 (magnets enabled), cap the pocket bottom
  // with a solid face at Z=floorDepth facing UP into the pocket.
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

// ─── Outer Perimeter Walls ──────────────────────────────────────────────────

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

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;

    const x0 = outerPts[i][0] + offsetX,
      y0 = outerPts[i][1] + offsetY;
    const x1 = outerPts[j][0] + offsetX,
      y1 = outerPts[j][1] + offsetY;

    // CCW from outside: top_i, top_j, bot_j, bot_i
    mb.pushFlatQuad(x0, y0, zTop, x1, y1, zTop, x1, y1, zBot, x0, y0, zBot);
  }
}

// ─── Top Face ───────────────────────────────────────────────────────────────

/**
 * Add the top face of the slab (Z=totalHeight).
 *
 * The top face is the outer perimeter minus the pocket top openings.
 * For the waffle grid, the top face is just the wall material between pockets.
 *
 * Pocket top openings ARE the full cell size (no inset at top).
 * So between adjacent pockets, there is ZERO wall width at the top face.
 * The only top-face material is the padding perimeter around the grid.
 * We generate that as a strip polygon.
 */
function addTopFace(
  mb: MeshBuilder,
  outerPts: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number,
  gridUnitMm: number,
  gridW: number,
  gridD: number,
  totalHeight: number
): void {
  const z = totalHeight;
  const nx = 0,
    ny = 0,
    nz = 1;

  // If there's no padding beyond the grid, the pocket openings tile the entire
  // top face, leaving nothing to fill.
  const gridHalfW = (gridW * gridUnitMm) / 2;
  const gridHalfD = (gridD * gridUnitMm) / 2;

  // If the outer profile matches the grid boundary, skip top face
  // (pockets fill the entire top). This is the common case with no padding.
  const hasPadding = outerPts.some((pt) => {
    const x = pt[0] + offsetX;
    const y = pt[1] + offsetY;
    return (
      x < -gridHalfW + offsetX - 0.01 ||
      x > gridHalfW + offsetX + 0.01 ||
      y < -gridHalfD + offsetY - 0.01 ||
      y > gridHalfD + offsetY + 0.01
    );
  });

  if (!hasPadding) return;

  // With padding: fan triangulate the outer polygon at Z=totalHeight.
  // Since pockets tile perfectly on the grid portion, we only have material
  // where padding exists. The pocket walls obscure the top face from any
  // viewing angle, so minor overdraw is acceptable for preview.
  const center = mb.pushVertex(offsetX, offsetY, z, nx, ny, nz);

  const outerVerts: number[] = [];
  for (const pt of outerPts) {
    outerVerts.push(mb.pushVertex(pt[0] + offsetX, pt[1] + offsetY, z, nx, ny, nz));
  }

  const nOuter = outerVerts.length;
  for (let i = 0; i < nOuter; i++) {
    const j = (i + 1) % nOuter;
    mb.pushTriangle(center, outerVerts[i], outerVerts[j]);
  }
}

// ─── Bottom Face (Z=0) ─────────────────────────────────────────────────────

/**
 * Add the bottom face of the slab (Z=0).
 *
 * When throughCut is true (no magnets): waffle grid — solid everywhere EXCEPT
 * inside pocket bottom openings (pocket cancellation holes punched via
 * upward-facing polygons).
 *
 * When magnets are enabled (throughCut=false): the bottom face is fully solid.
 * The slab extends below the pockets, so no cancellation is needed.
 */
function addBottomFace(
  mb: MeshBuilder,
  outerPts: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number,
  cells: ReadonlyArray<CellInfo>,
  gridUnitMm: number,
  throughCut: boolean
): void {
  const z = 0;

  // 1. Full outer polygon at Z=0, facing DOWN (normal = 0,0,-1)
  {
    const nx = 0,
      ny = 0,
      nz = -1;
    const centroidX = offsetX;
    const centroidY = offsetY;
    const center = mb.pushVertex(centroidX, centroidY, z, nx, ny, nz);

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

  // 2. Punch pocket bottom holes in the bottom face (through-cut only).
  // When magnets are enabled, the slab extends below the pockets so the
  // bottom face is fully solid — no cancellation needed.
  if (throughCut) {
    const nx = 0,
      ny = 0,
      nz = 1;

    for (const cell of cells) {
      const cellW_mm = cell.widthUnits * gridUnitMm;
      const cellD_mm = cell.depthUnits * gridUnitMm;
      const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
      const botR = Math.max(cornerR - INSET_BOT, 0.1);
      const botW = cellW_mm - 2 * INSET_BOT;
      const botD = cellD_mm - 2 * INSET_BOT;

      if (botW < 0.2 || botD < 0.2) continue;

      const pts = roundedRectPoints(botW, botD, botR, CORNER_SEGMENTS);
      const center = mb.pushVertex(cell.centerX, cell.centerY, z, nx, ny, nz);

      const verts: number[] = [];
      for (const pt of pts) {
        verts.push(mb.pushVertex(pt[0] + cell.centerX, pt[1] + cell.centerY, z, nx, ny, nz));
      }

      const nPts = verts.length;
      for (let i = 0; i < nPts; i++) {
        const j = (i + 1) % nPts;
        mb.pushTriangle(center, verts[i], verts[j]);
      }
    }
  }
}

// ─── Magnet Hole Geometry ───────────────────────────────────────────────────

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
 * For each magnet position in a full cell:
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

    // 1. Cancel circle at Z=floorDepth facing DOWN — punches hole in pocket floor
    {
      const nx = 0,
        ny = 0,
        nz = -1;
      const center = mb.pushVertex(mx, my, zTop, nx, ny, nz);
      const verts: number[] = [];
      for (const pt of circlePts) {
        verts.push(mb.pushVertex(pt[0] + mx, pt[1] + my, zTop, nx, ny, nz));
      }
      const nPts = verts.length;
      // Facing -Z: CW from above → center, v_{j}, v_{i}
      for (let i = 0; i < nPts; i++) {
        const j = (i + 1) % nPts;
        mb.pushTriangle(center, verts[j], verts[i]);
      }
    }

    // 2. Cylinder wall from Z=floorDepth to Z=MAGNET_FLOOR (inward-facing)
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      const j = (i + 1) % CIRCLE_SEGMENTS;
      const px0 = circlePts[i][0] + mx,
        py0 = circlePts[i][1] + my;
      const px1 = circlePts[j][0] + mx,
        py1 = circlePts[j][1] + my;

      // Inward-facing: from inside the cylinder looking outward.
      // Circle goes CCW from +Z, so inward quad: top_j, top_i, bot_i, bot_j
      mb.pushFlatQuad(px1, py1, zTop, px0, py0, zTop, px0, py0, zBot, px1, py1, zBot);
    }

    // 3. Floor circle at Z=MAGNET_FLOOR facing UP — magnet sits on this
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

// ─── Public API ─────────────────────────────────────────────────────────────

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
  } = params;

  const mb = new MeshBuilder();

  // Slab dimensions — taller when magnets require a solid floor
  const floorDepth = magnetHoles ? MAGNET_FLOOR + magnetDepth : 0;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const maxRadius = Math.min(totalW, totalD) / 2 - 0.1;
  const cornerR = Math.min(PLATE_CORNER_RADIUS, maxRadius);

  // Slab center offset for asymmetric padding (grid stays at origin)
  const slabOffsetX = (paddingRight - paddingLeft) / 2;
  const slabOffsetY = (paddingBack - paddingFront) / 2;

  const cellOpts: ForEachCellOptions = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };

  // Collect all cells
  const cells: CellInfo[] = [];
  forEachCell(width, depth, (cell) => cells.push(cell), cellOpts);

  onProgress('base', 0.1);
  checkCancelled(signal);

  // 1. Outer perimeter profile (with selective corner rounding for split baseplates)
  const outerPts = roundedRectPointsSelective(totalW, totalD, cornerR, CORNER_SEGMENTS, edges);

  // 2. Outer perimeter walls (Z=totalHeight to Z=0)
  addOuterWalls(mb, outerPts, slabOffsetX, slabOffsetY, totalHeight);

  onProgress('base', 0.2);
  checkCancelled(signal);

  // 3. Pocket inner walls for each cell
  for (const cell of cells) {
    const cellW_mm = cell.widthUnits * gridUnitMm;
    const cellD_mm = cell.depthUnits * gridUnitMm;
    addPocketWalls(mb, cell.centerX, cell.centerY, cellW_mm, cellD_mm, totalHeight, floorDepth);
  }

  onProgress('base', 0.5);
  checkCancelled(signal);

  // 4. Top face (Z=totalHeight) — only visible with padding
  addTopFace(mb, outerPts, slabOffsetX, slabOffsetY, gridUnitMm, width, depth, totalHeight);

  onProgress('base', 0.6);
  checkCancelled(signal);

  // 5. Bottom face (Z=0) — waffle grid holes for through-cut, solid when magnets
  const throughCut = !magnetHoles;
  addBottomFace(mb, outerPts, slabOffsetX, slabOffsetY, cells, gridUnitMm, throughCut);

  onProgress('base', 0.7);
  checkCancelled(signal);

  // 6. Magnet holes (when enabled, only for full-size cells)
  if (magnetHoles) {
    const magnetRadius = magnetDiameter / 2;
    for (const cell of cells) {
      if (cell.widthUnits < 1 || cell.depthUnits < 1) continue;
      addMagnetHoles(mb, cell.centerX, cell.centerY, magnetRadius, floorDepth);
    }
  }

  onProgress('base', 0.9);
  checkCancelled(signal);

  const result = mb.build();
  onProgress('base', 1);

  return result;
}
