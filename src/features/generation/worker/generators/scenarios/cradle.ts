import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';

const SOLID_BASE = { ...DEFAULT_BIN_PARAMS.base, solid: true };

/** 2x1 interior at the default wall (84 − 0.5 − 2.4 by 42 − 0.5 − 2.4). */
const INNER_W = 81.1;
const INNER_D = 39.1;

/** The tessellated arc lies within this of the true one (mm). */
const ARC_TOLERANCE_MM = 0.3;

/**
 * 2x1x4 solid block with one cradle 60 wide and 12 deep across X, running the
 * full interior depth and centred, so its arc meets the fill 30mm either side
 * of x = 0. Radius (30² + 12²) / 24 = 43.5.
 */
function block(extra: Partial<Cutout> = {}): Partial<BinParams> {
  return {
    style: 'solid',
    width: 2,
    depth: 1,
    height: 4,
    base: SOLID_BASE,
    cutouts: [
      makeCutout({
        shape: 'rectangle',
        x: (INNER_W - 60) / 2,
        y: 0,
        width: 60,
        depth: INNER_D,
        cutDepth: 12,
        cradle: true,
        ...extra,
      }),
    ],
  };
}

/** Rise of an arc of `radius` at `u` off its lowest point. */
function rise(radius: number, u: number): number {
  return radius - Math.sqrt(radius * radius - u * u);
}

/** Highest surface over a column: the fill, a floor, or the wall or lip top. */
function columnTopZ(mesh: MeshData, x: number, y: number): number {
  const crossings = columnCrossings(mesh, x, y);
  return crossings.length > 0 ? crossings[crossings.length - 1] : Number.NEGATIVE_INFINITY;
}

/** Beside the 60-wide cradle, in the strip of fill it leaves at each end. */
const FILL_PROBE: [number, number] = [36, 0];

function fillTop(mesh: MeshData, [x, y]: [number, number] = FILL_PROBE): number {
  return columnTopZ(mesh, x, y);
}

function expectArc(
  mesh: MeshData,
  at: (u: number) => [number, number],
  depth: number,
  radius: number,
  us: readonly number[],
  fillAt: [number, number] = FILL_PROBE
): void {
  const lowest = fillTop(mesh, fillAt) - depth;
  for (const u of us) {
    const [x, y] = at(u);
    const expected = lowest + rise(radius, u);
    expect(Math.abs(columnTopZ(mesh, x, y) - expected), `arc at ${u}`).toBeLessThan(
      ARC_TOLERANCE_MM
    );
  }
}

/** A wall scanned just inside its outer face stands to the rim at every `at`. */
function expectWallWhole(mesh: MeshData, at: (p: number) => [number, number], ps: number[]): void {
  const bb = boundingBox(mesh.vertices);
  for (const p of ps) {
    const [x, y] = at(p);
    expect(columnTopZ(mesh, x, y), `wall whole at ${p}`).toBeGreaterThan(bb.maxZ - 1.5);
  }
}

const ACROSS = [0, 10, -10, 20, -20, 27, -27];

export const cradle: ScenarioCase[] = [
  defineScenario('cradle', '2x1x4 cradle floor follows its arc between whole walls', {
    params: block(),
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      expectArc(result, (u) => [u, 0], 12, 43.5, ACROSS);
      expectWallWhole(result, (x) => [x, bb.minY + 0.6], [-20, 0, 20]);
      expectWallWhole(result, (x) => [x, bb.maxY - 0.6], [-20, 0, 20]);
    },
  }),
  defineScenario('cradle', '2x1x4 cradle open front and back carries its arc through both walls', {
    params: block({ openSides: [{ side: 'front' }, { side: 'back' }] }),
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      // The wall is cut on the floor's own arc, so no step stands where they meet.
      expectArc(result, (u) => [u, bb.minY + 0.6], 12, 43.5, ACROSS);
      expectArc(result, (u) => [u, bb.maxY - 0.6], 12, 43.5, ACROSS);
      expectWallWhole(result, (x) => [x, bb.minY + 0.6], [-35, 35]);
      expectWallWhole(result, (x) => [x, bb.maxY - 0.6], [-35, 35]);
    },
  }),
  defineScenario('cradle', '2x1x4 cradle turned 90° opens only the walls at its ends', {
    params: block({
      // 30 across and the full interior width long, turned so it runs along X.
      x: INNER_W / 2 - 15,
      y: INNER_D / 2 - INNER_W / 2,
      width: 30,
      depth: INNER_W,
      cutDepth: 10,
      rotation: 90,
      openSides: [{ side: 'left' }, { side: 'right' }, { side: 'front' }],
    }),
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      // (15² + 10²) / 20
      const radius = 16.25;
      // The turned cradle spans the whole length, so the fill is beside it.
      const fill: [number, number] = [0, 17.5];
      const vs = [0, 6, -6, 12, -12];
      expectArc(result, (v) => [bb.minX + 0.6, v], 10, radius, vs, fill);
      expectArc(result, (v) => [bb.maxX - 0.6, v], 10, radius, vs, fill);
      expectWallWhole(result, (x) => [x, bb.minY + 0.6], [-20, 0, 20]);
    },
  }),
  defineScenario('cradle', '2x1x4 cradle deeper than half its width is a half round', {
    params: block({ x: (INNER_W - 20) / 2, width: 20, cutDepth: 16 }),
    customAssert: (result) => {
      expectArc(result, (u) => [u, 0], 16, 10, [0, 6, -6, 9, -9]);
      // Above the half round the sides stand straight up to the fill.
      const lowest = fillTop(result) - 16;
      expect(columnTopZ(result, 9.95, 0)).toBeLessThan(lowest + 10);
    },
  }),
  defineScenario('cradle', '2x1x4 tunnel cradle keeps the wall above its arc', {
    params: block({ openSides: [{ side: 'front', tunnel: true }] }),
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      expectWallWhole(result, (x) => [x, bb.minY + 0.6], [-20, 0, 20]);
      const floor = fillTop(result) - 12;
      for (const u of [0, 20]) {
        const hits = columnCrossings(result, u, bb.minY + 0.6);
        const expected = floor + rise(43.5, u);
        expect(
          hits.some((z) => Math.abs(z - expected) < ARC_TOLERANCE_MM),
          `tunnel floor at ${u}`
        ).toBe(true);
      }
    },
  }),
  defineScenario('cradle', '2x1x4 cradle ignores a stored scoop, chamfer and lean', {
    params: block({ scoopRadiusW: 6, scoopRadiusD: 6, chamferWidth: 2, leanDeg: 20 }),
    customAssert: (result) => {
      expectArc(result, (u) => [u, 0], 12, 43.5, ACROSS);
      // Beside the cradle the fill runs flat to the arc's edge, with no flare.
      expect(columnTopZ(result, 31, 0)).toBeCloseTo(fillTop(result), 1);
    },
  }),
];
