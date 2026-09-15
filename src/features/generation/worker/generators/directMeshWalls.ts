/**
 * Vertical wall emitters for direct baseplate mesh.
 *
 * - addPocketWalls: the baseplate pocket profile, walked down from
 *   Z=totalHeight (full cell size) to the floor at Z=floorDepth (inset by
 *   POCKET_INSET_BOT). Optionally caps the bottom when magnets are enabled (otherwise
 *   the pocket is through-cut).
 *
 * - addOuterWalls: vertical walls following the outer slab profile from
 *   Z=totalHeight down to Z=0.
 *
 * Both share perimeter rings across adjacent quads so `computeVertexNormals` +
 * `toCreasedNormals(35°)` produces smooth shading across rounded corners while
 * keeping crisp creases at arc→flat transitions and at each profile break.
 */

import { POCKET_INSET_BOT, POCKET_PROFILE, pocketCornerRadius } from './generatorTypes';
import type { MeshBuilder } from './directMeshBuilder';
import { CORNER_SEGMENTS } from './directMeshBuilder';
import { roundedRectPoints } from './directMeshShapes';

/**
 * Floors for a pocket section's size and corner radius.
 *
 * `roundedRectPoints` drops to four square corners below a 0.01mm radius, so a
 * section that falls through either floor would come back with a different
 * vertex count than the ring above it and the wall quads would pair up wrong.
 */
const MIN_SECTION_MM = 0.2;
const MIN_SECTION_RADIUS_MM = 0.1;

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

  // One ring per profile breakpoint. Collapsing these to just the opening and
  // the floor renders the pocket as a plain cone — no vertical band, no
  // 45-degree seat — which is the shape a bin cannot drop into.
  const rings = POCKET_PROFILE.map(([depth, inset]) => ({
    z: totalHeight - depth,
    pts: roundedRectPoints(
      Math.max(cellW_mm - 2 * inset, MIN_SECTION_MM),
      Math.max(cellD_mm - 2 * inset, MIN_SECTION_MM),
      Math.max(cornerR - inset, MIN_SECTION_RADIUS_MM),
      CORNER_SEGMENTS
    ),
  }));

  const n = rings[0].pts.length;

  // Build each perimeter ring once and share its vertex indices with the bands
  // above and below. Normals are intentionally zeroed; they'll be overwritten
  // by `computeVertexNormals` downstream.
  const indices = rings.map(({ z, pts }) => {
    const ring = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      ring[i] = mb.pushVertex(pts[i][0] + cx, pts[i][1] + cy, z, 0, 0, 0);
    }
    return ring;
  });

  // Wall quads band by band.
  // Inward-facing winding from inside the pocket: top_{i+1}, top_i, bot_i, bot_{i+1}.
  for (let b = 0; b + 1 < indices.length; b++) {
    const upper = indices[b];
    const lower = indices[b + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      mb.pushQuad(upper[j], upper[i], lower[i], lower[j]);
    }
  }

  const botPts = rings[rings.length - 1].pts;
  const botW = cellW_mm - 2 * POCKET_INSET_BOT;
  const botD = cellD_mm - 2 * POCKET_INSET_BOT;
  const zBot = floorDepth;

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
