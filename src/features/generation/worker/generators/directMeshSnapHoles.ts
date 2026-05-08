import type { MeshBuilder } from './directMeshBuilder';
import { CANCEL_EPSILON, CIRCLE_SEGMENTS } from './directMeshBuilder';
import { circlePoints } from './directMeshShapes';

// Shallow visual indicator only — BREP replaces this with the real through-hole
// within ~1s, so a full-depth cut is unnecessary.
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
