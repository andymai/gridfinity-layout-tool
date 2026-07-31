// @vitest-environment node
/**
 * Placement tests for the selectable scoop wall (issue #3039).
 *
 * The scenario snapshots only pin `triangleCount`, which cannot tell these
 * apart: on a square bin the four sides are congruent, so a scoop welded to the
 * wrong wall snapshots identically. These tests assert against the real kernel
 * that material actually leaves the requested wall.
 *
 * The ramp is a fused solid whose curved face tessellates into 24 arc segments,
 * so it dominates the vertex distribution near whichever wall it sits on. The
 * mesh's vertex centroid therefore shifts *toward* the scooped wall, which is
 * what these tests key on. Front/back are the -Y/+Y walls, left/right -X/+X.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import type { ScoopSide } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

interface Centroid {
  readonly x: number;
  readonly y: number;
}

function scoopedCentroid(
  side: ScoopSide | undefined,
  overrides: Partial<BinParams> = {}
): Centroid {
  const generateBin = getGenerateBin();
  const params = buildParams({
    scoop: { enabled: true, radius: 'auto' as const, ...(side ? { side } : {}) },
    ...overrides,
  });
  const result = generateBin(params, undefined, false);

  let sumX = 0;
  let sumY = 0;
  const count = result.vertices.length / 3;
  for (let i = 0; i < result.vertices.length; i += 3) {
    sumX += result.vertices[i];
    sumY += result.vertices[i + 1];
  }
  return { x: sumX / count, y: sumY / count };
}

describe('scoop side placement', () => {
  it('pulls the centroid toward the scooped wall, per side', () => {
    const front = scoopedCentroid('front');
    const back = scoopedCentroid('back');
    const left = scoopedCentroid('left');
    const right = scoopedCentroid('right');

    // The shift is several mm; the cross-axis bound below is deliberately far
    // looser because OCCT's tessellation is not rotation-invariant at the
    // vertex level, so a rotated ramp drifts a fraction of a mm off-axis.
    const CROSS_AXIS_TOLERANCE_MM = 0.5;

    // Front sits on -Y, back on +Y, and neither shifts the bin sideways.
    expect(front.y).toBeLessThan(-1);
    expect(back.y).toBeGreaterThan(1);
    expect(Math.abs(front.x)).toBeLessThan(CROSS_AXIS_TOLERANCE_MM);
    expect(Math.abs(back.x)).toBeLessThan(CROSS_AXIS_TOLERANCE_MM);

    // Left sits on -X, right on +X.
    expect(left.x).toBeLessThan(-1);
    expect(right.x).toBeGreaterThan(1);
    expect(Math.abs(left.y)).toBeLessThan(CROSS_AXIS_TOLERANCE_MM);
    expect(Math.abs(right.y)).toBeLessThan(CROSS_AXIS_TOLERANCE_MM);
  });

  it('is symmetric: opposite walls mirror each other about the bin center', () => {
    const front = scoopedCentroid('front');
    const back = scoopedCentroid('back');
    const left = scoopedCentroid('left');
    const right = scoopedCentroid('right');

    expect(front.y).toBeCloseTo(-back.y, 4);
    expect(left.x).toBeCloseTo(-right.x, 4);

    // A square bin's front/left scoops are the same cut a quarter turn apart,
    // so the offset magnitude must match across axes.
    expect(Math.abs(front.y)).toBeCloseTo(Math.abs(left.x), 4);
  });

  it('defaults to the front wall when no side is stored', () => {
    // Designs saved before the side was selectable carry no `side` key.
    const legacy = scoopedCentroid(undefined);
    const front = scoopedCentroid('front');

    expect(legacy.x).toBeCloseTo(front.x, 6);
    expect(legacy.y).toBeCloseTo(front.y, 6);
  });

  it('scoops the long wall of a long skinny bin (#3039)', () => {
    // The reporter's case: a 6x1 bin whose only useful scoop wall is the long one.
    const long = { width: 6, depth: 1 };
    const back = scoopedCentroid('back', long);
    const front = scoopedCentroid('front', long);

    expect(front.y).toBeLessThan(0);
    expect(back.y).toBeGreaterThan(0);
    expect(front.y).toBeCloseTo(-back.y, 4);
  });

  it('produces non-degenerate geometry on every side', () => {
    const generateBin = getGenerateBin();
    for (const side of ['front', 'back', 'left', 'right'] as const) {
      const result = generateBin(
        buildParams({ scoop: { enabled: true, radius: 'auto' as const, side } }),
        undefined,
        false
      );
      expect(result.triangleCount, side).toBeGreaterThan(0);
      expect(result.vertices.length, side).toBeGreaterThan(0);
      expect(Array.from(result.vertices).every(Number.isFinite), side).toBe(true);
    }
  });
});
