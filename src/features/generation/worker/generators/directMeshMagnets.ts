/**
 * Magnet hole emitter for direct baseplate mesh.
 *
 * Each magnet hole is a blind pocket cut downward from the pocket floor
 * (Z=floorDepth) by magnetDepth, leaving a retaining floor below it. The hole
 * depth is anchored to magnetDepth (not the total floor) so it matches the
 * BREP cutter exactly — a thicker solidFloor just leaves more material below
 * the magnet, it never deepens the hole.
 *
 * Pattern (per magnet position):
 *   - Cancel disc at Z=floorDepth-CANCEL_EPSILON facing -Z — punches a hole
 *     in the existing pocket floor mesh (avoids z-fighting). Its rim is the
 *     mouth: the chamfer's outer edge when one applies, else the bore.
 *   - Optional chamfer band from the mouth ring down to the bore ring.
 *   - Bore wall ring shared across adjacent quads for smooth shading; the
 *     ring follows the crush-rib wave when the style asks for it.
 *   - Floor disc at Z=floorDepth-magnetDepth facing +Z — magnet sits on this.
 */

import type { MeshBuilder } from './directMeshBuilder';
import { CANCEL_EPSILON, CIRCLE_SEGMENTS } from './directMeshBuilder';
import { circlePoints } from './directMeshShapes';
import type { MagnetHoleStyle } from '@/shared/generation/magnetHoleStyle';
import {
  MAGNET_CHAMFER_MM,
  PLAIN_MAGNET_HOLE,
  magnetBoreProfile,
  magnetBoreSegments,
} from '@/shared/generation/magnetHoleStyle';

type Ring = ReadonlyArray<readonly [number, number]>;

function addDisc(
  mb: MeshBuilder,
  mx: number,
  my: number,
  z: number,
  ring: Ring,
  facingUp: boolean
): void {
  const nz = facingUp ? 1 : -1;
  const center = mb.pushVertex(mx, my, z, 0, 0, nz);
  const verts = ring.map((pt) => mb.pushVertex(pt[0] + mx, pt[1] + my, z, 0, 0, nz));
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (facingUp) mb.pushTriangle(center, verts[i], verts[j]);
    else mb.pushTriangle(center, verts[j], verts[i]);
  }
}

/** Inward-facing band between two rings of equal length at two heights. */
function addBand(
  mb: MeshBuilder,
  mx: number,
  my: number,
  topRing: Ring,
  zTop: number,
  bottomRing: Ring,
  zBot: number
): void {
  const n = topRing.length;
  const top = new Array<number>(n);
  const bot = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    top[i] = mb.pushVertex(topRing[i][0] + mx, topRing[i][1] + my, zTop, 0, 0, 0);
    bot[i] = mb.pushVertex(bottomRing[i][0] + mx, bottomRing[i][1] + my, zBot, 0, 0, 0);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Inward-facing winding (from inside the hole looking outward):
    mb.pushQuad(top[j], top[i], bot[i], bot[j]);
  }
}

/** Emit a single blind magnet hole at absolute (mx, my). */
export function addMagnetHoleAt(
  mb: MeshBuilder,
  mx: number,
  my: number,
  magnetRadius: number,
  floorDepth: number,
  magnetDepth: number,
  style: MagnetHoleStyle = PLAIN_MAGNET_HOLE
): void {
  const zTop = floorDepth; // pocket floor level (magnet hole opens here)
  const zBot = floorDepth - magnetDepth; // retaining floor the magnet sits on
  const segments = magnetBoreSegments(style, CIRCLE_SEGMENTS);
  const bore = magnetBoreProfile(magnetRadius, style, segments);
  const mouth = style.chamfer ? circlePoints(magnetRadius + MAGNET_CHAMFER_MM, segments) : bore;

  // Cancel face slightly below the pocket floor to avoid z-fighting.
  addDisc(mb, mx, my, zTop - CANCEL_EPSILON, mouth, false);

  let boreTopZ = zTop;
  if (style.chamfer) {
    boreTopZ = zTop - MAGNET_CHAMFER_MM;
    addBand(mb, mx, my, mouth, zTop, bore, boreTopZ);
  }
  addBand(mb, mx, my, bore, boreTopZ, bore, zBot);

  // Floor disc the magnet rests on.
  addDisc(mb, mx, my, zBot, bore, true);
}
