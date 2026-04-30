/**
 * Horizontal face emitters for direct baseplate mesh.
 *
 * - addPlateFace: top/bottom slab face = padding ring + per-cell corner gussets.
 *   Splitting along the cell boundaries (rather than emitting one giant
 *   polygon-with-holes) avoids needing a triangulator and keeps the math
 *   closed-form. Equivalent to BREP's `outer_face − ⋃(pocket_openings)`.
 *
 * - addRingFace: ring between an outer rounded perimeter and an axis-aligned
 *   inner rectangle. The inner rectangle is in the **grid frame** (origin),
 *   not the slab frame — clamping to the slab-shifted rectangle was a bug
 *   that placed the padding ring's inner edge in the wrong spot whenever
 *   padding was asymmetric.
 *
 * - addCellCornerGussets: emits the four per-corner fillet-complement gussets
 *   for one cell. Adjacent cells' gussets share their cell-corner vertices,
 *   so emitting them per-cell tiles the full inter-pocket lattice.
 *
 * - addSolidBottomFace: closed bottom face for magnet variants (the floor
 *   under the pockets is solid). Through-cut variants mirror the top lattice
 *   via addPlateFace(z=0, faceUp=false) instead — a single fan would leave
 *   open pocket bottoms and cause z-fighting.
 */

import { pocketCornerRadius } from './generatorTypes';
import type { CellInfo } from './generatorTypes';
import type { MeshBuilder } from './directMeshBuilder';
import { CORNER_SEGMENTS } from './directMeshBuilder';
import { pointInPolygon } from './directMeshShapes';

export function addPlateFace(
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
  // beyond the grid bounding box.
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
 * Emit the four per-corner fillet-complement gussets for one cell.
 *
 * Each pocket opening is a rounded rectangle inset from the cell's sharp
 * corner by `pocketCornerRadius`. The triangular-ish region between the
 * sharp corner and the rounded arc is solid material on the slab's top
 * (and bottom, in through-cut mode). Each gusset is triangulated as a fan
 * from the cell corner to the arc samples — valid because the cell corner
 * sees the entire arc with no occlusion.
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
    [cx - hw, cy - hd, cx - hw + r, cy - hd + r, (3 * Math.PI) / 2], // front-left
    [cx + hw, cy - hd, cx + hw - r, cy - hd + r, 2 * Math.PI], // front-right
    [cx + hw, cy + hd, cx + hw - r, cy + hd - r, Math.PI / 2], // back-right
    [cx - hw, cy + hd, cx - hw + r, cy + hd - r, Math.PI], // back-left
  ];

  /**
   * Skip the gusset when the cell corner falls outside the slab outline.
   *
   * Happens at *grid-corner cells with no padding* — the slab outer arc and
   * the pocket arc share the same center and radius, so the cell rectangle's
   * corner sticks out past the rounded slab boundary into empty space.
   *
   * Test a point nudged slightly inward (toward the cell center) so a corner
   * exactly on a flat slab edge still counts as inside.
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
 * Closed bottom face (Z=0, facing -Z) for magnet variants.
 * The floor under the pockets is solid, so a single fan from the slab center
 * is correct. Through-cut variants instead mirror the top lattice.
 */
export function addSolidBottomFace(
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
