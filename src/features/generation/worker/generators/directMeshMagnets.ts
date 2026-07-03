/**
 * Magnet hole emitter for direct baseplate mesh.
 *
 * Each magnet hole is a blind cylindrical pocket cut downward from the pocket
 * floor (Z=floorDepth) into the solid floor below. The hole extends down by
 * magnetDepth, leaving a thin retaining floor (MAGNET_FLOOR) at the bottom.
 *
 * Pattern (per magnet position):
 *   - Cancel circle at Z=floorDepth-CANCEL_EPSILON facing -Z — punches a hole
 *     in the existing pocket floor mesh (avoids z-fighting).
 *   - Cylinder wall ring shared across adjacent quads for smooth shading.
 *   - Floor circle at Z=MAGNET_FLOOR facing +Z — magnet sits on this.
 */

import { MAGNET_FLOOR } from './generatorTypes';
import type { MeshBuilder } from './directMeshBuilder';
import { CANCEL_EPSILON, CIRCLE_SEGMENTS } from './directMeshBuilder';
import { circlePoints } from './directMeshShapes';

/** Emit a single blind magnet hole at absolute (mx, my). */
export function addMagnetHoleAt(
  mb: MeshBuilder,
  mx: number,
  my: number,
  magnetRadius: number,
  floorDepth: number
): void {
  const zTop = floorDepth; // pocket floor level (magnet hole opens here)
  const zBot = MAGNET_FLOOR; // thin floor that retains the magnet
  const circlePts = circlePoints(magnetRadius, CIRCLE_SEGMENTS);

  // Cancel face slightly below the pocket floor to avoid z-fighting.
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

  // Floor circle the magnet rests on.
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
