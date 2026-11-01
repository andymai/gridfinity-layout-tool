/**
 * Plane-slice measurement of a magnet bore. A bounding box cannot see a bore
 * profile and a ruled wall carries vertices only at its ends, so this cuts
 * every triangle edge with the plane and reads the wall radius where it
 * crosses. The rib count is the n-rib cosine that fits best: counting local
 * maxima of a tessellated ring is off by one either way.
 */
import { expect } from 'vitest';
import {
  MAGNET_CHAMFER_MM,
  MAGNET_CRUSH_RIB_COUNT,
  MAGNET_CRUSH_RIB_DEPTH_MM,
} from '@/shared/generation/magnetHoleStyle';

export interface SliceableMesh {
  readonly vertices: ArrayLike<number>;
  readonly indices: ArrayLike<number>;
}

export interface PolarPoint {
  readonly r: number;
  readonly theta: number;
}

/** Plane-z crossings of every triangle edge within `maxR` of (cx, cy), in polar form about it. */
export function sliceAround(
  { vertices, indices }: SliceableMesh,
  cx: number,
  cy: number,
  z: number,
  maxR: number
): PolarPoint[] {
  const points: PolarPoint[] = [];
  const edge = (a: number, b: number): void => {
    const za = vertices[a + 2];
    const zb = vertices[b + 2];
    if (za === zb || z < Math.min(za, zb) || z > Math.max(za, zb)) return;
    const t = (z - za) / (zb - za);
    const dx = vertices[a] + t * (vertices[b] - vertices[a]) - cx;
    const dy = vertices[a + 1] + t * (vertices[b + 1] - vertices[a + 1]) - cy;
    const r = Math.hypot(dx, dy);
    if (r <= maxR) points.push({ r, theta: Math.atan2(dy, dx) });
  };
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  return points;
}

function zSpan(
  { vertices }: SliceableMesh,
  cx: number,
  cy: number,
  rLo: number,
  rHi: number
): { zMin: number; zMax: number } {
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const r = Math.hypot(vertices[i] - cx, vertices[i + 1] - cy);
    if (r > rHi || r < rLo) continue;
    zMin = Math.min(zMin, vertices[i + 2]);
    zMax = Math.max(zMax, vertices[i + 2]);
  }
  return { zMin, zMax };
}

export function boreMidZ(mesh: SliceableMesh, cx: number, cy: number, radius: number): number {
  const lo = radius - MAGNET_CRUSH_RIB_DEPTH_MM - 0.1;
  const { zMin, zMax } = zSpan(mesh, cx, cy, lo, radius + 0.05);
  return (zMin + zMax) / 2;
}

export function holeZSpan(
  mesh: SliceableMesh,
  cx: number,
  cy: number,
  radius: number
): { zMin: number; zMax: number } {
  const lo = radius - MAGNET_CRUSH_RIB_DEPTH_MM - 0.1;
  return zSpan(mesh, cx, cy, lo, radius + MAGNET_CHAMFER_MM + 0.05);
}

export function ribWaveError(points: readonly PolarPoint[], radius: number, n: number): number {
  const half = MAGNET_CRUSH_RIB_DEPTH_MM / 2;
  const sum = points.reduce(
    (acc, { r, theta }) => acc + Math.abs(r - (radius - half + half * Math.cos(n * theta))),
    0
  );
  return sum / Math.max(1, points.length);
}

function largestAngularGap(points: readonly PolarPoint[]): number {
  const thetas = points.map((p) => p.theta).sort((a, b) => a - b);
  if (thetas.length === 0) return 2 * Math.PI;
  let gap = thetas[0] + 2 * Math.PI - thetas[thetas.length - 1];
  for (let i = 1; i < thetas.length; i++) gap = Math.max(gap, thetas[i] - thetas[i - 1]);
  return gap;
}

/** The plane meets a wall all the way round the hole: the bore exists. */
function expectBoreExists(points: readonly PolarPoint[], label: string): void {
  expect(points.length, `${label}: the plane crosses a bore wall`).toBeGreaterThanOrEqual(
    MAGNET_CRUSH_RIB_COUNT * 4
  );
  expect(largestAngularGap(points), `${label}: the wall closes round the hole`).toBeLessThan(
    Math.PI / 8
  );
}

function radiusRange(points: readonly PolarPoint[]): { rMin: number; rMax: number } {
  let rMin = Infinity;
  let rMax = 0;
  for (const { r } of points) {
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
  }
  return { rMin, rMax };
}

export function expectRibbedSection(
  points: readonly PolarPoint[],
  radius: number,
  label: string
): void {
  expectBoreExists(points, label);
  const { rMin, rMax } = radiusRange(points);
  expect(rMax, `${label}: peaks on the bore`).toBeGreaterThan(radius - 0.05);
  expect(rMax, `${label}: peaks stop at the bore`).toBeLessThan(radius + 0.05);
  expect(rMin, `${label}: troughs intrude`).toBeLessThan(radius - MAGNET_CRUSH_RIB_DEPTH_MM + 0.07);
  expect(rMin, `${label}: troughs stop at rib depth`).toBeGreaterThan(
    radius - MAGNET_CRUSH_RIB_DEPTH_MM - 0.07
  );
  const fit = ribWaveError(points, radius, MAGNET_CRUSH_RIB_COUNT);
  expect(fit, `${label}: follows the ${MAGNET_CRUSH_RIB_COUNT}-rib wave`).toBeLessThan(0.06);
  for (const n of [4, 6, 7, 9, 10, 12]) {
    expect(ribWaveError(points, radius, n), `${label}: is not a ${n}-rib wave`).toBeGreaterThan(
      fit * 2
    );
  }
}

export function expectPlainSection(
  points: readonly PolarPoint[],
  radius: number,
  label: string
): void {
  expectBoreExists(points, label);
  const { rMin, rMax } = radiusRange(points);
  expect(rMin, `${label}: round bore`).toBeGreaterThan(radius - 0.05);
  expect(rMax, `${label}: round bore`).toBeLessThan(radius + 0.05);
}

/**
 * A slice `depth` inside a 45 degree chamfered mouth reads that much narrower
 * than the rim. The floor allows a draft cone's chords (an 18-gon sags 0.055mm).
 */
export function expectChamferedSection(
  points: readonly PolarPoint[],
  radius: number,
  depth: number,
  label: string
): void {
  expectBoreExists(points, label);
  const expected = radius + MAGNET_CHAMFER_MM - depth;
  const { rMin, rMax } = radiusRange(points);
  expect(rMax, `${label}: mouth opens on the chamfer`).toBeGreaterThan(expected - 0.03);
  expect(rMax, `${label}: mouth stops at the chamfer`).toBeLessThan(expected + 0.03);
  expect(rMin, `${label}: mouth is round`).toBeGreaterThan(expected - 0.07);
}
