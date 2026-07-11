// @vitest-environment node
/**
 * Geometry validation for baseplate magnet placement on an oversized grid
 * (gridUnitMm > 42, GitHub discussion #2525).
 *
 * Magnets are edge-anchored a constant 8mm from each cell edge rather than pinned
 * ±13mm from center, so on a 50mm grid they sit at ±17mm and stay corner-aligned
 * as the cell grows. This locks that a magnet-bearing oversized baseplate still
 * cuts to a valid, finite solid (no torn mesh from magnets drifting into walls).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const NO_OP = (): void => {};

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 3,
  depth: 3,
  gridUnitMm: 50,
  magnetHoles: true,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: false,
  ...overrides,
});

describe('baseplate oversized-grid magnet geometry (#2525)', () => {
  it('generates a valid 3×3 magnet baseplate at gridUnitMm=50', () => {
    const gen = getGenerateBaseplate();
    const result = gen(defaults(), NO_OP, true);

    assertStructurallyValid(result, 'oversized magnet baseplate');
    expect(result.triangleCount).toBeGreaterThan(0);

    const bb = boundingBox(result.vertices);
    for (const value of Object.values(bb)) expect(Number.isFinite(value)).toBe(true);

    expect(result.triangleCount).toMatchSnapshot();
  });
});
