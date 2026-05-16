import type { MeshBuilder } from './directMeshBuilder';
import { CANCEL_EPSILON } from './directMeshBuilder';

// Fast preview marker for a rabbit-clip socket — a shallow rectangular pocket
// on the slab top. BREP replaces this with the real pocketed cut within ~1 s,
// so a full-depth, properly-shaped marker would be wasted effort.
const MARKER_DEPTH = 2.5;

/**
 * Add a rectangular socket marker to the mesh in the XY plane.
 *
 * @param cx       Socket centre X (mm)
 * @param cy       Socket centre Y (mm)
 * @param length   Socket extent along the seam-normal axis (mm)
 * @param width    Socket extent along the seam-parallel axis (mm)
 * @param rotZ     Rotation in degrees about Z (so length aligns with seam normal)
 * @param slabTopZ World Z of the slab top
 */
export function addSnapSocketMarker(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  length: number,
  width: number,
  rotZ: number,
  slabTopZ: number
): void {
  const zTop = slabTopZ;
  const zBot = Math.max(0, slabTopZ - MARKER_DEPTH);

  const halfL = length / 2;
  const halfW = width / 2;
  const cos = Math.cos((rotZ * Math.PI) / 180);
  const sin = Math.sin((rotZ * Math.PI) / 180);
  // 4 corners (in local frame: ±halfW along X, ±halfL along Y), rotated
  const local: ReadonlyArray<[number, number]> = [
    [-halfW, -halfL],
    [halfW, -halfL],
    [halfW, halfL],
    [-halfW, halfL],
  ];
  const corners = local.map(([lx, ly]): [number, number] => [
    cx + lx * cos - ly * sin,
    cy + lx * sin + ly * cos,
  ]);

  // Top cap (open downward; CANCEL_EPSILON below zTop so it overrides the slab top)
  {
    const cancelZ = zTop - CANCEL_EPSILON;
    const v: number[] = corners.map(([px, py]) => mb.pushVertex(px, py, cancelZ, 0, 0, -1));
    mb.pushQuad(v[0], v[3], v[2], v[1]);
  }

  // Side walls (4 quads)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const [ax, ay] = corners[i];
    const [bx, by] = corners[j];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const a = mb.pushVertex(ax, ay, zTop, nx, ny, 0);
    const b = mb.pushVertex(bx, by, zTop, nx, ny, 0);
    const c = mb.pushVertex(bx, by, zBot, nx, ny, 0);
    const d = mb.pushVertex(ax, ay, zBot, nx, ny, 0);
    mb.pushQuad(a, b, c, d);
  }

  // Pocket floor
  {
    const v: number[] = corners.map(([px, py]) => mb.pushVertex(px, py, zBot, 0, 0, 1));
    mb.pushQuad(v[0], v[1], v[2], v[3]);
  }
}
