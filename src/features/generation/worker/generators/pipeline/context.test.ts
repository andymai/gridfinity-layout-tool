import { describe, it, expect } from 'vitest';
import { createInitialContext } from './context';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
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

  // GH #1445 — bin generator was using the Gridfinity 7mm default for height
  // even when the user set a custom heightUnitMm, so exports had the wrong
  // Z dimension. The dimensions flowing through the pipeline (and into the
  // shellKey cache) must reflect the user-configured unit.
  it('should use params.heightUnitMm instead of hardcoded 7mm', () => {
    const customHeightUnit = 10; // ≠ GRIDFINITY.HEIGHT_UNIT (7mm)
    const heightUnits = 3;
    const ctx = createInitialContext(
      createTestParams({ height: heightUnits, heightUnitMm: customHeightUnit })
    );
    const dim = ctx.dimensions;
    expect(dim.totalHeight).toBe(heightUnits * customHeightUnit);
    expect(dim.wallHeight).toBe(heightUnits * customHeightUnit - GRIDFINITY.SOCKET_HEIGHT);
  });

  it('produces different shellKeys for different heightUnitMm values', () => {
    const ctxDefault = createInitialContext(createTestParams({ heightUnitMm: 7 }));
    const ctxCustom = createInitialContext(createTestParams({ heightUnitMm: 10 }));
    // Cache key discriminates on heightUnitMm via quantized wallHeight,
    // so the two solids don't collide in the shape cache.
    expect(ctxDefault.dimensions.shellKey).not.toBe(ctxCustom.dimensions.shellKey);
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

  describe('halfSockets flag in dimensions', () => {
    it('stays off for an unset user toggle on a 1u-aligned L preset mask', () => {
      // 3×3 L-shape at 1u resolution — no half-bin detail.
      const cellMask = {
        cols: 6,
        rows: 6,
        cells: [
          // row 0 (bottom)
          1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0,
          // remaining rows — all filled
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        ] as (0 | 1)[],
      };
      const ctx = createInitialContext(createTestParams({ width: 3, depth: 3, cellMask }));
      expect(ctx.dimensions.halfSockets).toBe(false);
    });

    it('leaves halfSockets off when mask has half-bin detail but user opt-in is off', () => {
      // 2×2 bin (4×4 mask) with one half-cell cleared — mixed 1u block.
      // The socket builder does a per-cell dispatch for mask-mixed 1u cells,
      // so the global dimensions.halfSockets flag only reflects the user
      // toggle. It stays false here.
      const cells = new Array<0 | 1>(16).fill(1);
      cells[3] = 0;
      const cellMask = { cols: 4, rows: 4, cells };
      const ctx = createInitialContext(createTestParams({ width: 2, depth: 2, cellMask }));
      expect(ctx.dimensions.halfSockets).toBe(false);
    });

    it('respects the user opt-in flag on a rectangular bin', () => {
      const ctx = createInitialContext(
        createTestParams({
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            halfSockets: true,
          },
        })
      );
      expect(ctx.dimensions.halfSockets).toBe(true);
    });

    it('never enables halfSockets on a flat-base bin', () => {
      const ctx = createInitialContext(
        createTestParams({
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            style: 'flat',
            stackingLip: false,
            halfSockets: true,
          },
        })
      );
      expect(ctx.dimensions.halfSockets).toBe(false);
    });
  });
});
