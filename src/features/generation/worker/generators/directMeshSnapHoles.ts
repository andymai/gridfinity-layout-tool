/**
 * Snap-hole marker emitter for the direct (preview-only) baseplate mesh.
 *
 * Renders a shallow cylindrical pocket from the slab top down a few mm.
 * This is an *indication* of where the snap-clip prong holes are — the
 * BREP path produces the geometrically correct through-holes that ship in
 * the exported STL.
 *
 * Implementation parallels addMagnetHoles: cancel face on the slab top,
 * cylinder walls down to the marker depth, floor face. No bottom-plate
 * cancel — the marker is intentionally not a through-hole, since the
 * direct mesh is replaced by BREP within ~1s.
 */

import type { MeshBuilder } from './directMeshBuilder';
import { CANCEL_EPSILON, CIRCLE_SEGMENTS } from './directMeshBuilder';
import { circlePoints } from './directMeshShapes';

/** Visual-only marker depth (mm). Shallower than slab thickness so it
 *  reads as a hole indicator without disturbing the bottom face. */
const MARKER_DEPTH = 2.5;

export function addSnapHoleMarker(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  holeRadius: number,
  slabTopZ: number
): void {
  const zTop = slabTopZ;
  const zBot = Math.max(0, slabTopZ - MARKER_DEPTH);
  const circlePts = circlePoints(holeRadius, CIRCLE_SEGMENTS);

  // Cancel face just below slab top (hides plate face from below).
  {
    const cancelZ = zTop - CANCEL_EPSILON;
    const center = mb.pushVertex(cx, cy, cancelZ, 0, 0, -1);
    const verts: number[] = [];
    for (const pt of circlePts) {
      verts.push(mb.pushVertex(pt[0] + cx, pt[1] + cy, cancelZ, 0, 0, -1));
    }
    const nPts = verts.length;
    for (let i = 0; i < nPts; i++) {
      const j = (i + 1) % nPts;
      mb.pushTriangle(center, verts[j], verts[i]);
    }
  }

  // Cylinder walls (smooth shading via shared ring vertices).
  const wallTop = new Array<number>(CIRCLE_SEGMENTS);
  const wallBot = new Array<number>(CIRCLE_SEGMENTS);
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const px = circlePts[i][0] + cx;
    const py = circlePts[i][1] + cy;
    wallTop[i] = mb.pushVertex(px, py, zTop, 0, 0, 0);
    wallBot[i] = mb.pushVertex(px, py, zBot, 0, 0, 0);
  }
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const j = (i + 1) % CIRCLE_SEGMENTS;
    mb.pushQuad(wallTop[j], wallTop[i], wallBot[i], wallBot[j]);
  }

  // Floor disk at the marker depth.
  {
    const center = mb.pushVertex(cx, cy, zBot, 0, 0, 1);
    const verts: number[] = [];
    for (const pt of circlePts) {
      verts.push(mb.pushVertex(pt[0] + cx, pt[1] + cy, zBot, 0, 0, 1));
    }
    const nPts = verts.length;
    for (let i = 0; i < nPts; i++) {
      const j = (i + 1) % nPts;
      mb.pushTriangle(center, verts[i], verts[j]);
    }
  }
}
