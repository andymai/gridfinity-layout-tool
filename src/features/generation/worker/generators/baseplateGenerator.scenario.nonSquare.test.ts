// @vitest-environment node
/**
 * Geometry validation for non-square baseplates.
 *
 * A non-square grid gives the depth (Y) axis a different cell pitch than the
 * width (X) axis (`gridUnitMmY !== gridUnitMm`), so a drawer that isn't an exact
 * multiple of 42mm packs tighter. Only the cell pitch stretches on Y — round
 * features (magnets, corners) stay isotropic. The plate's outer extent must be
 * `width·gridUnitMm × depth·gridUnitMmY`, and an explicit Y pitch equal to X
 * must reproduce the square plate exactly.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const NO_OP = (): void => {};
const U = 42;
const UY = 22; // narrower depth pitch (e.g. a 42×22 grid)

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 4,
  depth: 6,
  gridUnitMm: U,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  ...overrides,
});

describe('non-square baseplate geometry', () => {
  it(
    'produces a valid plate with the correct non-square outer extent',
    { timeout: 240_000 },
    () => {
      const gen = getGenerateBaseplate();
      const result = gen(defaults({ gridUnitMmY: UY }), NO_OP, true);
      assertStructurallyValid(result, 'non-square 4x6 @ 42x22');

      const bb = boundingBox(result.vertices);
      const width = bb.maxX - bb.minX;
      const depth = bb.maxY - bb.minY;
      // width = 4·42 = 168, depth = 6·22 = 132 (no padding). Tolerance covers the
      // coplanar nudge and float noise.
      expect(width).toBeGreaterThan(4 * U - 1);
      expect(width).toBeLessThan(4 * U + 1);
      expect(depth).toBeGreaterThan(6 * UY - 1);
      expect(depth).toBeLessThan(6 * UY + 1);
      // The depth pitch is smaller, so a 4×6 non-square plate is wider than deep —
      // the opposite of the 4×6 square plate (which would be 168 × 252).
      expect(width).toBeGreaterThan(depth);
    }
  );

  it('with magnets stays valid on a non-square grid', { timeout: 240_000 }, () => {
    const gen = getGenerateBaseplate();
    const result = gen(defaults({ gridUnitMmY: UY, magnetHoles: true }), NO_OP, true);
    assertStructurallyValid(result, 'non-square + magnets');
    expect(result.triangleCount).toBeGreaterThan(0);
  });

  it('an explicit Y pitch equal to X reproduces the square plate', { timeout: 240_000 }, () => {
    const gen = getGenerateBaseplate();
    const square = gen(defaults(), NO_OP, true);
    const explicitSquare = gen(defaults({ gridUnitMmY: U }), NO_OP, true);
    // Same pitch on both axes ⇒ identical geometry.
    expect(explicitSquare.triangleCount).toBe(square.triangleCount);
    const a = boundingBox(square.vertices);
    const b = boundingBox(explicitSquare.vertices);
    expect(b.maxX - b.minX).toBeCloseTo(a.maxX - a.minX, 3);
    expect(b.maxY - b.minY).toBeCloseTo(a.maxY - a.minY, 3);
  });
});
