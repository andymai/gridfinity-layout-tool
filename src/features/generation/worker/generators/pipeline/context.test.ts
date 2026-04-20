import { describe, it, expect } from 'vitest';
import { createInitialContext } from './context';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

// Source from DEFAULT_BIN_PARAMS so the fixture tracks the real BinParams
// shape automatically. Tests below expect a no-lip baseline, so override
// base.stackingLip off; all other fields flow through the defaults.
function createTestParams(overrides?: Partial<BinParams>): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    ...overrides,
  };
}

describe('createInitialContext', () => {
  it('derives correct dimensions for a plain 2x2x3 bin', () => {
    const ctx = createInitialContext(createTestParams());
    const dim = ctx.dimensions;

    expect(dim.outerW).toBeCloseTo(83.5); // 2*42 - 0.5
    expect(dim.outerD).toBeCloseTo(83.5);
    expect(dim.innerW).toBeCloseTo(81.1); // 83.5 - 2*1.2
    expect(dim.innerD).toBeCloseTo(81.1);
    expect(dim.totalHeight).toBe(21); // 3 * 7
    expect(dim.wallHeight).toBe(16); // 21 - 5 (SOCKET_HEIGHT)
    expect(dim.isFlat).toBe(false);
    expect(dim.solid).toBe(false);
    expect(dim.isSlotted).toBe(false);
    expect(dim.hasLip).toBe(false);
    expect(dim.withMagnet).toBe(false);
    expect(dim.withScrew).toBe(false);
  });

  it('derives flat floor dimensions', () => {
    const ctx = createInitialContext(
      createTestParams({
        base: {
          style: 'flat',
          stackingLip: false,
          halfSockets: false,
          solid: false,
          magnetDiameter: 6,
          magnetDepth: 2,
          screwDiameter: 3,
        },
      })
    );
    expect(ctx.dimensions.isFlat).toBe(true);
    expect(ctx.dimensions.wallHeight).toBe(21); // No socket deduction for flat
  });

  it('produces versioned shellKey with v5 prefix including gridUnitMm', () => {
    const ctx = createInitialContext(createTestParams());

    // shellKey uses buildCacheKey with v5 prefix, gridUnitMm, and quantized floats
    // forExport is no longer in the key since shell geometry is identical for preview/export.
    // Final segment is 'rect' when no cellMask is in use; mask hash otherwise.
    const expected = [
      'v5',
      2,
      2,
      42, // gridUnitMm
      false,
      false,
      false,
      false,
      6.5,
      2,
      3,
      16,
      1.2,
      false,
      false,
      'rect',
    ].join('|');

    expect(ctx.dimensions.shellKey).toBe(expected);
  });

  it('initializes context with empty targets and null solid/mesh', () => {
    const ctx = createInitialContext(createTestParams());
    expect(ctx.solid).toBeNull();
    expect(ctx.mesh).toBeNull();
    expect(ctx.fuseTargets).toEqual([]);
    expect(ctx.cutTargets).toEqual([]);
    expect(ctx.originToTag.size).toBe(0);
  });

  it('should use params.gridUnitMm instead of hardcoded 42mm', () => {
    const ctx = createInitialContext(createTestParams({ gridUnitMm: 50 }));
    const dim = ctx.dimensions;
    // outerW should be 2 * 50 - 0.5, not 2 * 42 - 0.5
    expect(dim.outerW).toBeCloseTo(99.5);
    expect(dim.outerD).toBeCloseTo(99.5);
    expect(dim.maxDimension).toBeCloseTo(100);
  });

  it('computes interiorHeight with lip deduction', () => {
    const ctx = createInitialContext(
      createTestParams({
        base: {
          style: 'plain',
          stackingLip: true,
          halfSockets: false,
          solid: false,
          magnetDiameter: 6,
          magnetDepth: 2,
          screwDiameter: 3,
        },
      })
    );
    expect(ctx.dimensions.hasLip).toBe(true);
    // interiorHeight = wallHeight - LIP_SMALL_TAPER (0.7)
    expect(ctx.dimensions.interiorHeight).toBeCloseTo(15.3);
  });
});
