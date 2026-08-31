/**
 * Scenario test: finger scoop ramps stay inside the outer wall (#4033).
 *
 * The ramp is a square-cornered prism pushed into the surrounding walls to weld
 * it (#4014). At the bin's rounded outer corners a square corner driven
 * diagonally into the wall overshoots the outer arc and pokes out of the bin
 * ("scoops cut through outside"). scoopRampBuilder clips the ramp to the rounded
 * cavity footprint to prevent that; this proves nothing pokes past the true
 * outer footprint across a range of wall thicknesses, lips, sides and styles
 * (the default 1.2 mm wall used to breach because the clip only ran below
 * ~1.10 mm).
 *
 * Cross-kernel:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --project=generators scoopContainment
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { BOX_CORNER_RADIUS } from './generatorConstants';

const GRID = 42;
const TOL = 0.5;

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

/** Count ramp mesh vertices lying outside the true rounded outer footprint. */
async function verticesOutsideOuterWall(params: BinParams): Promise<number> {
  const { drawRoundedRectangle, cut, mesh, unwrap } = await import('brepjs');
  const { sketch } = await import('./meshUtils');
  const { buildScoopRamps } = await import('./scoopRampBuilder');

  const wt = params.wallThickness;
  const outerW = params.width * GRID - TOL;
  const outerD = params.depth * GRID - TOL;
  const innerW = outerW - 2 * wt;
  const innerD = outerD - 2 * wt;
  const wallHeight = params.height * params.heightUnitMm;

  const ramp = buildScoopRamps(params, innerW, innerD, wallHeight, wt);
  if (!ramp) return 0;

  const footprint = sketch(
    drawRoundedRectangle(outerW, outerD, BOX_CORNER_RADIUS),
    'XY',
    -1
  ).extrude(wallHeight + 2);
  try {
    const outside = unwrap(cut(ramp as never, footprint));
    try {
      const m = mesh(outside, { tolerance: 0.02, angularTolerance: 8, cache: false });
      return m.vertices.length / 3;
    } catch {
      return 0; // empty intersection: nothing outside
    }
  } finally {
    (ramp as { delete(): void }).delete();
  }
}

const scoop = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
  ...over,
});

describe('scoop ramps stay inside the outer wall', () => {
  const cases: [string, BinParams][] = [
    ['default 1.2mm wall, lip, curved (the reported case)', scoop()],
    ['no lip', scoop({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } })],
    [
      'straight style',
      scoop({ scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, style: 'straight' } }),
    ],
    [
      'side scoop (left)',
      scoop({ scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'left' } }),
    ],
    ['thin 0.95mm wall (clip already active)', scoop({ wallThickness: 0.95 })],
    ['thicker 2.0mm wall', scoop({ wallThickness: 2.0 })],
  ];

  for (const [name, params] of cases) {
    it(
      name,
      async () => {
        expect(await verticesOutsideOuterWall(params)).toBe(0);
      },
      120_000
    );
  }
});
