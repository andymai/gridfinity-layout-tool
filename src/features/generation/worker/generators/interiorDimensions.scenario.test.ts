/**
 * The Dimensions panel's "Inside" readout against the solid the kernel builds.
 *
 * `binInteriorDimensions()` derives the cavity from constants so it updates
 * before any mesh exists. This measures the real build: the floor top is the
 * highest surface over a plain patch of floor, the wall top is the mesh's top face
 * (lip off), and the inner wall faces are where a column first rises above the
 * floor.
 *
 *   pnpm run test:run -- src/features/generation/worker/generators/interiorDimensions.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox, columnCrossings } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/features/bin-designer/types';
import { binInteriorDimensions } from '@/features/bin-designer/utils/interiorDimensions';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

// Off the centre axes, where a slotted bin cuts its divider grooves, and off
// the diagonals planar faces are fan-triangulated along.
const PROBE_X = 9.7;
const PROBE_Y = 6.1;
// A column this far above the floor is standing in a wall, not in a corner fillet.
const WALL_RISE_MM = 5;
const STEP_MM = 0.02;

function params(extra: Partial<BinParams> = {}, base: Partial<BinParams['base']> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    ...extra,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false, ...base },
  };
}

function highest(crossings: number[]): number {
  const top = crossings[crossings.length - 1];
  if (top === undefined) throw new Error('probe column missed the mesh');
  return top;
}

function measureInside(p: BinParams): { widthMm: number; heightMm: number } {
  const mesh = getGenerateBin()(p);
  const floorTop = highest(columnCrossings(mesh, PROBE_X, PROBE_Y));
  const wallTop = boundingBox(mesh.vertices).maxZ;

  const expected = binInteriorDimensions(p);
  const start = (expected?.widthMm ?? 0) / 2 - 2;
  let wallX = start;
  while (highest(columnCrossings(mesh, wallX, PROBE_Y)) < floorTop + WALL_RISE_MM) {
    wallX += STEP_MM;
    if (wallX > boundingBox(mesh.vertices).maxX) throw new Error('never reached the wall');
  }
  return { widthMm: 2 * wallX, heightMm: wallTop - floorTop };
}

describe('inside dimensions match generated geometry', () => {
  const cases: Array<[string, BinParams]> = [
    ['socketed bin', params()],
    ['flat base', params({}, { style: 'flat' })],
    ['low-profile feet', params({}, { lowProfile: true })],
    ['detachable feet', params({}, { feet: 'detachable' })],
    ['exterior-wall collar', params({ extraWallHeightMm: 9 })],
    ['wall thicker than the spec floor', params({ wallThickness: 3 })],
    ['taller height unit', params({ heightUnitMm: 9 })],
    ['slotted flat bin with a floor groove', params({ style: 'slotted' }, { style: 'flat' })],
  ];

  it.each(cases)('%s', (_name, p) => {
    const inside = binInteriorDimensions(p);
    expect(inside).not.toBeNull();
    const measured = measureInside(p);
    expect(measured.heightMm).toBeCloseTo(inside?.heightMm ?? NaN, 1);
    expect(measured.widthMm).toBeCloseTo(inside?.widthMm ?? NaN, 1);
  });
});
