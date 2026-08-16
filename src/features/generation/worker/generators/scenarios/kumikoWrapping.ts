/**
 * Kumiko wrapped-lattice wall pattern scenarios (mitsukude).
 *
 * The wrapped path is asserted two ways:
 *   - volume: the lattice must remove material vs the solid-walled twin
 *     (`assertRemovesMaterial`, shared with the stamp pattern scenarios)
 *   - wrap proof: the CORNER regions must gain mesh complexity vs the solid
 *     twin — flat-panel-only output leaves corners untouched, so a corner
 *     vertex-count ratio distinguishes a real wrap from the fallback.
 *
 * Volume/structural assertions are used instead of triangleCount snapshots —
 * robust to tessellation drift (see wallPatterns.ts).
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { DEFAULT_PATTERN_SCALE } from '@/shared/types/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';
import type { BinParams } from '@/shared/types/bin';
import { deriveDimensions } from '../pipeline/context';
import { TOP_KEEP_OUT, BOTTOM_SOLID_SKIRT } from '../wallPatterns';
import { SOCKET_HEIGHT, BOX_CORNER_RADIUS } from '../generatorConstants';
import { scaleFactor } from '../patterns/patternScale';
import { generateKumikoLattice, KUMIKO_BASE_CELL_SIZE } from '../patterns/kumiko/segmentLattice';
import { MITSUKUDE_DEF } from '../patterns/kumiko/mitsukude';
import { assertRemovesMaterial } from './wallPatterns';

export const ALL_SIDES_OFF = {
  ...DEFAULT_BIN_PARAMS.walls,
  enabled: false,
  front: DISABLED_WALL_CUTOUT,
  back: DISABLED_WALL_CUTOUT,
  left: DISABLED_WALL_CUTOUT,
  right: DISABLED_WALL_CUTOUT,
  interior: DISABLED_WALL_CUTOUT,
} as const;

/**
 * Count mesh vertices inside the four corner regions above the socket
 * (z > 12mm clears socket + bottom keep-out on h ≥ 4 bins).
 */
function countCornerVertices(mesh: MeshData, widthU: number, depthU: number): number {
  const outerW = widthU * 42 - 0.5;
  const outerD = depthU * 42 - 0.5;
  const r = 3.75;
  const xEdge = outerW / 2 - r;
  const yEdge = outerD / 2 - r;
  const { vertices } = mesh;
  let count = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i] ?? 0;
    const y = vertices[i + 1] ?? 0;
    const z = vertices[i + 2] ?? 0;
    if (z < 12) continue;
    if (Math.abs(x) > xEdge && Math.abs(y) > yEdge) count++;
  }
  return count;
}

/** The wrap must open the corners: corner mesh complexity grows vs solid. */
function assertCornersWrapped(widthU: number, depthU: number) {
  return (patterned: MeshData, solid: MeshData): void => {
    assertRemovesMaterial(patterned, solid);
    const patternedCorners = countCornerVertices(patterned, widthU, depthU);
    const solidCorners = countCornerVertices(solid, widthU, depthU);
    expect(
      patternedCorners,
      `corners look untouched (patterned=${patternedCorners}, solid=${solidCorners}) — lattice did not wrap`
    ).toBeGreaterThan(solidCorners * 2);
  };
}

/**
 * Per-side selection: with only the front wall picked, no corner has
 * BOTH its walls selected, so every corner slab is skipped and the corners must
 * come out as solid as the un-patterned twin — while the front wall still opens.
 */
function assertOnlyFrontWrapped(widthU: number, depthU: number) {
  return (patterned: MeshData, solid: MeshData): void => {
    assertRemovesMaterial(patterned, solid);
    const patternedCorners = countCornerVertices(patterned, widthU, depthU);
    const solidCorners = countCornerVertices(solid, widthU, depthU);
    expect(
      patternedCorners,
      `corners were cut (patterned=${patternedCorners}, solid=${solidCorners}) — a corner slab survived with only one of its walls selected`
    ).toBeLessThan(solidCorners * 2);
  };
}

/** Closest distance from a point to a triangle (Ericson, Real-Time Collision Detection). */
function pointTriangleDistance(
  p: readonly number[],
  a: readonly number[],
  b: readonly number[],
  c: readonly number[]
): number {
  const sub = (u: readonly number[], v: readonly number[]): number[] => [
    u[0] - v[0],
    u[1] - v[1],
    u[2] - v[2],
  ];
  const dot = (u: readonly number[], v: readonly number[]): number =>
    u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  const dist = (q: readonly number[]): number => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  if (d1 <= 0 && d2 <= 0) return dist(a);
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return dist(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const t = d1 / (d1 - d3);
    return dist([a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return dist(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const t = d2 / (d2 - d6);
    return dist([a[0] + ac[0] * t, a[1] + ac[1] * t, a[2] + ac[2] * t]);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const t = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return dist([b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t, b[2] + (c[2] - b[2]) * t]);
  }
  const sum = va + vb + vc;
  // Degenerate (zero-area) triangle: barycentric weights are undefined, so
  // fall back to the nearest vertex instead of dividing by ~0.
  if (Math.abs(sum) < 1e-12) return Math.min(dist(a), dist(b), dist(c));
  const denom = 1 / sum;
  const v = vb * denom;
  const w = vc * denom;
  return dist([
    a[0] + ab[0] * v + ac[0] * w,
    a[1] + ab[1] * v + ac[1] * w,
    a[2] + ab[2] * v + ac[2] * w,
  ]);
}

/**
 * Min distance from a point to any triangle of an indexed mesh, with an
 * early exit once a triangle within `closeEnough` is found — callers only
 * need "is the surface within threshold", not the exact minimum.
 */
function distanceToMesh(mesh: MeshData, p: readonly number[], closeEnough: number): number {
  const { vertices, indices } = mesh;
  let min = Infinity;
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t] * 3;
    const ib = indices[t + 1] * 3;
    const ic = indices[t + 2] * 3;
    const d = pointTriangleDistance(
      p,
      [vertices[ia], vertices[ia + 1], vertices[ia + 2]],
      [vertices[ib], vertices[ib + 1], vertices[ib + 2]],
      [vertices[ic], vertices[ic + 1], vertices[ic + 2]]
    );
    if (d < min) min = d;
    if (min <= closeEnough) return min;
  }
  return min;
}

/**
 * Both diagonal families must survive the corner wrap: for every point where
 * a lattice diagonal crosses a corner arc, the outer wall surface must carry
 * strut material. Guards the falling-diagonal family specifically — a
 * mis-wound corner helix (the occt-wasm left-handed flag is a no-op) sweeps
 * those struts to the mirrored angular span, so the wedge cut swallows the
 * real strut location and the pattern reads as clipped with holes.
 */
function assertCornerDiagonalsPresent(mesh: MeshData, params: BinParams): void {
  const dims = deriveDimensions(params, false);
  const wallThickness = params.wallThickness;
  const outerW = dims.innerW + 2 * wallThickness;
  const outerD = dims.innerD + 2 * wallThickness;
  const r = Math.min(BOX_CORNER_RADIUS, Math.min(outerW, outerD) / 2 - 0.1);
  const flatW = outerW - 2 * r;
  const flatD = outerD - 2 * r;
  const arc = (Math.PI / 2) * r;
  const perimeter = 2 * flatW + 2 * flatD + 4 * arc;
  const bottomKeepOut = wallThickness + BOTTOM_SOLID_SKIRT;
  const bandHeight = dims.interiorHeight - TOP_KEEP_OUT - bottomKeepOut;
  const bandZ0 = SOCKET_HEIGHT + bottomKeepOut;
  const scale = params.wallPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const lattice = generateKumikoLattice(
    MITSUKUDE_DEF,
    { perimeter, bandHeight },
    KUMIKO_BASE_CELL_SIZE * scaleFactor(scale)
  );

  const corners = [
    { name: 'FR', u0: flatW, cx: outerW / 2 - r, cy: -outerD / 2 + r, theta0: -Math.PI / 2 },
    { name: 'BR', u0: flatW + arc + flatD, cx: outerW / 2 - r, cy: outerD / 2 - r, theta0: 0 },
    {
      name: 'BL',
      u0: 2 * flatW + 2 * arc + flatD,
      cx: -outerW / 2 + r,
      cy: outerD / 2 - r,
      theta0: Math.PI / 2,
    },
    {
      name: 'FL',
      u0: 2 * flatW + 3 * arc + 2 * flatD,
      cx: -outerW / 2 + r,
      cy: -outerD / 2 + r,
      theta0: Math.PI,
    },
  ];

  const missing: string[] = [];
  for (const corner of corners) {
    for (const frac of [0.3, 0.5, 0.7]) {
      const u = corner.u0 + arc * frac;
      for (const seg of lattice.segments) {
        const du = seg.b[0] - seg.a[0];
        const dz = seg.b[1] - seg.a[1];
        if (Math.abs(du) < 0.15 || Math.abs(dz) < 0.15) continue;
        for (const shift of [-perimeter, 0, perimeter]) {
          const ua = seg.a[0] + shift;
          const ub = seg.b[0] + shift;
          if (u < Math.min(ua, ub) || u > Math.max(ua, ub)) continue;
          const z = seg.a[1] + ((u - ua) / du) * dz;
          if (z < 1.5 || z > bandHeight - 1.5) continue;
          const theta = corner.theta0 + (u - corner.u0) / r;
          const p = [corner.cx + r * Math.cos(theta), corner.cy + r * Math.sin(theta), bandZ0 + z];
          const d = distanceToMesh(mesh, p, 0.4);
          if (d > 0.4) {
            const family = dz / du > 0 ? 'rising' : 'falling';
            missing.push(
              `${corner.name} ${family} diagonal absent at u=${u.toFixed(1)} z=${z.toFixed(1)} (surface ${d.toFixed(2)}mm away)`
            );
          }
        }
      }
    }
  }
  expect(missing, missing.join('\n')).toEqual([]);
}

// How a pattern reaches corners, and which walls it covers.
export const kumikoWrapping: ScenarioCase[] = [
  defineScenario('kumiko', 'mitsukude keeps both diagonal families on corners (1×1×4, bold)', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 1,
      depth: 1,
      height: 4,
      wallThickness: 1.2,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 1 },
      walls: ALL_SIDES_OFF,
    },
    customAssert: assertCornerDiagonalsPresent,
  }),
  defineScenario('kumiko', 'asanoha wraps a 1×1×6 bin including corners', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 1,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern: 'asanoha', scale: 0.5 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { enabled: false, pattern: 'asanoha', scale: 0.5 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertCornersWrapped(1, 1),
    },
  }),
  defineScenario('kumiko', 'mitsukude wraps a 1×1×6 bin including corners', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 1,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { enabled: false, pattern: 'mitsukude', scale: 0.5 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertCornersWrapped(1, 1),
    },
  }),
  defineScenario('kumiko', 'mitsukude on the front wall only leaves the corners solid (#2966)', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 1,
      depth: 1,
      height: 6,
      wallPattern: {
        enabled: true,
        pattern: 'mitsukude',
        scale: 0.5,
        sides: { left: false, right: false, front: true, back: false },
      },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { enabled: false, pattern: 'mitsukude', scale: 0.5 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertOnlyFrontWrapped(1, 1),
    },
  }),
  defineScenario('kumiko', 'mitsukude carves 3×3×5 walls', {
    assert: 'structural',
    timeout: 180_000,
    params: {
      width: 3,
      depth: 3,
      height: 5,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 3,
        depth: 3,
        height: 5,
        wallPattern: { enabled: false, pattern: 'mitsukude', scale: 0.5 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertRemovesMaterial,
    },
  }),
];
