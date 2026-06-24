/**
 * Vertical wall emitters for direct baseplate mesh.
 *
 * - addPocketWalls: tapered walls from Z=totalHeight (full cell size) down to
 *   Z=floorDepth (inset by INSET_BOT). Optionally caps the bottom at
 *   Z=floorDepth when magnets are enabled (otherwise the pocket is through-cut).
 *
 * - addOuterWalls: vertical walls following the outer slab profile from
 *   Z=totalHeight down to Z=0.
 *
 * Both share top + bottom perimeter rings across adjacent quads so
 * `computeVertexNormals` + `toCreasedNormals(35°)` produces smooth shading
 * across rounded corners while keeping crisp creases at arc→flat transitions.
 */

import { INSET_BOT, pocketCornerRadius } from './generatorTypes';
import type { MeshBuilder } from './directMeshBuilder';
import { CORNER_SEGMENTS } from './directMeshBuilder';
import { roundedRectPoints } from './directMeshShapes';

export function addPocketWalls(
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

  const topPts = roundedRectPoints(cellW_mm, cellD_mm, cornerR, CORNER_SEGMENTS);
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
  // edge stays crisp.
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
 * Outer perimeter walls — vertical walls from Z=zTop down to Z=zBot
 * following the outer profile. Normals point OUTWARD (away from slab center).
 *
 * `zBot` defaults to 0 (baseplate slab bottom). The bin body passes the socket
 * height so its outer wall starts at the socket interface, not Z=0.
 */
export function addOuterWalls(
  mb: MeshBuilder,
  outerPts: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number,
  zTop: number,
  zBot = 0
): void {
  const n = outerPts.length;

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
