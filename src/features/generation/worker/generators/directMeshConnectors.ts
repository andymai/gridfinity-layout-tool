/**
 * Connector nub (male) and connector hole (female) emitters for direct
 * baseplate mesh.
 *
 * Both build a cylinder oriented by an axis-aligned wall normal, using
 * `tangentVectors(nx, ny)` to get an orthogonal frame for sweeping the
 * circle profile.
 *
 * Holes use the cancellation pattern: a cancel face inset by CANCEL_EPSILON
 * punches the existing wall mesh, then cylinder walls go inward, then a
 * floor closes the hole. This mirrors the magnet-hole approach.
 */

import { NUB_CIRCLE_SEGMENTS } from './generatorTypes';
import type { MeshBuilder } from './directMeshBuilder';
import { CANCEL_EPSILON, tangentVectors } from './directMeshBuilder';

/**
 * Add a cylindrical nub (male protrusion) at a wall face.
 *
 * The nub protrudes outward from the wall surface along the normal direction.
 * Circle lies in the plane perpendicular to the normal.
 */
export function addConnectorNub(
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

  const tipX = cx + nx * depth;
  const tipY = cy + ny * depth;
  const tipZ = cz + nz * depth;

  // Generate circle points at base, tip (cylinder wall normals), and tip cap (face normal).
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
export function addConnectorHole(
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
