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

  it('produces versioned shellKey with v7 prefix including the lightweight flag', () => {
    const ctx = createInitialContext(createTestParams());

    // shellKey uses buildCacheKey with v7 prefix, gridUnitMm, quantized floats,
    // a `lightweight` flag, a 'rect' mask segment (no cellMask), a 'none'
    // compartments segment, and a trailing overhang segment ('0' when there's no
    // overhang). v7 bumped from v6 when the lightweight flag was added.
    const expected = [
      'v7',
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
      false, // stackingLip
      false, // solid
      false, // lightweight
      'rect',
      'none', // compartments segment
      '0', // overhang segment (no overhang)
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

  it('includes overhang expansion in innerW/innerD', () => {
    const noOverhang = createInitialContext(createTestParams({ width: 2, depth: 2 }));
    const withOverhang = createInitialContext(
      createTestParams({
        width: 2,
        depth: 2,
        overhang: { left: 5, right: 5, front: 4, back: 4 },
      })
    );
    // outerW stays nominal (socket footprint unchanged)
    expect(withOverhang.dimensions.outerW).toBeCloseTo(noOverhang.dimensions.outerW);
    // innerW must grow by addW (10mm) so interior features use the full space
    expect(withOverhang.dimensions.innerW).toBeCloseTo(noOverhang.dimensions.innerW + 10, 5);
    expect(withOverhang.dimensions.innerD).toBeCloseTo(noOverhang.dimensions.innerD + 8, 5);
  });

  it('innerW/innerD are unchanged with zero overhang', () => {
    const ctx = createInitialContext(
      createTestParams({
        overhang: { left: 0, right: 0, front: 0, back: 0 },
      })
    );
    const baseline = createInitialContext(createTestParams());
    expect(ctx.dimensions.innerW).toBeCloseTo(baseline.dimensions.innerW, 5);
    expect(ctx.dimensions.innerD).toBeCloseTo(baseline.dimensions.innerD, 5);
  });

  it('innerOffsetX/Y are zero for symmetric overhang', () => {
    const ctx = createInitialContext(
      createTestParams({ overhang: { left: 5, right: 5, front: 4, back: 4 } })
    );
    expect(ctx.dimensions.innerOffsetX).toBe(0);
    expect(ctx.dimensions.innerOffsetY).toBe(0);
  });

  it('innerOffsetX/Y are zero with no overhang', () => {
    const ctx = createInitialContext(createTestParams());
    expect(ctx.dimensions.innerOffsetX).toBe(0);
    expect(ctx.dimensions.innerOffsetY).toBe(0);
  });

  it('innerOffsetX/Y reflect asymmetric overhang cavity shift', () => {
    // right=6, left=0  → offsetX = (6-0)/2 = 3  (cavity shifts toward +X)
    // back=4,  front=0 → offsetY = (4-0)/2 = 2
    const ctx = createInitialContext(
      createTestParams({ overhang: { left: 0, right: 6, front: 0, back: 4 } })
    );
    expect(ctx.dimensions.innerOffsetX).toBeCloseTo(3, 5);
    expect(ctx.dimensions.innerOffsetY).toBeCloseTo(2, 5);
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

  describe('partial divider height routing', () => {
    const fourCompartments = (overrides?: Partial<BinParams['compartments']>) =>
      createTestParams({
        width: 4,
        depth: 4,
        compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3], ...overrides },
      });

    it('bakes rectangular compartments into the shell at full (auto) height', () => {
      const ctx = createInitialContext(fourCompartments());
      expect(ctx.dimensions.compartmentsBakedIntoShell).toBe(true);
    });

    it('routes a numeric (partial) divider height to the additive wall path', () => {
      // The cut-based shell can't express a divider that stops short of the
      // rim, so a partial height must disable the bake-into-shell path.
      const ctx = createInitialContext(fourCompartments({ dividerHeight: 8 }));
      expect(ctx.dimensions.compartmentsBakedIntoShell).toBe(false);
    });

    it("keeps the cut path for an explicit 'auto' divider height", () => {
      const ctx = createInitialContext(fourCompartments({ dividerHeight: 'auto' }));
      expect(ctx.dimensions.compartmentsBakedIntoShell).toBe(true);
    });

    it('keeps the cut path when a numeric height clamps up to the full interior height', () => {
      // No-lip 4x4x3 bin: wallHeight 16 == full interior height. A numeric value
      // at/above that is effectively full, so it should NOT pay for the slower
      // additive path or bust the cut-path cache bucket.
      const ctx = createInitialContext(fourCompartments({ dividerHeight: 999 }));
      expect(ctx.dimensions.interiorHeight).toBe(16);
      expect(ctx.dimensions.compartmentsBakedIntoShell).toBe(true);
    });

    it('routes compartments to the additive path when an exterior collar is present', () => {
      // The collar builds the shell taller than the interior; the cut path would
      // extend dividers to the raised rim, so a collar must force the additive
      // (short divider) path so dividers stay at the nominal interior height.
      const baked = createInitialContext(fourCompartments());
      expect(baked.dimensions.compartmentsBakedIntoShell).toBe(true);

      const withCollar = createInitialContext({
        ...fourCompartments(),
        extraWallHeightMm: 10,
      });
      expect(withCollar.dimensions.compartmentsBakedIntoShell).toBe(false);
    });
  });

  describe('exterior-wall collar (extraWallHeightMm)', () => {
    it('defaults to a zero collar and leaves wall/interior height nominal', () => {
      const dim = createInitialContext(createTestParams()).dimensions;
      expect(dim.collarHeight).toBe(0);
      expect(dim.wallHeight).toBe(16); // 3u * 7 - 5 socket, unchanged
    });

    it('resolves collarHeight without inflating the nominal wall/interior height', () => {
      // The whole point of the collar: features anchor to the ORIGINAL plane,
      // so wallHeight / interiorHeight must NOT grow with the collar. Only
      // shellStage adds it to the box + lip extrusion.
      const baseline = createInitialContext(createTestParams()).dimensions;
      const collared = createInitialContext(createTestParams({ extraWallHeightMm: 12 })).dimensions;
      expect(collared.collarHeight).toBe(12);
      expect(collared.wallHeight).toBe(baseline.wallHeight);
      expect(collared.interiorHeight).toBe(baseline.interiorHeight);
      expect(collared.totalHeight).toBe(baseline.totalHeight);
    });

    it('clamps a negative collar to zero', () => {
      const dim = createInitialContext(createTestParams({ extraWallHeightMm: -5 })).dimensions;
      expect(dim.collarHeight).toBe(0);
    });

    it('collapses a non-finite collar to zero (no NaN into the shell)', () => {
      const dim = createInitialContext(createTestParams({ extraWallHeightMm: NaN })).dimensions;
      expect(dim.collarHeight).toBe(0);
    });

    it('discriminates the shellKey by collar height, leaving collarless keys unchanged', () => {
      const noCollar = createInitialContext(createTestParams()).dimensions;
      const noCollarAgain = createInitialContext(createTestParams()).dimensions;
      const collared = createInitialContext(createTestParams({ extraWallHeightMm: 8 })).dimensions;
      // Collarless key is stable (no churn) and distinct from the collared key.
      expect(noCollar.shellKey).toBe(noCollarAgain.shellKey);
      expect(collared.shellKey).not.toBe(noCollar.shellKey);
      // Appended segment only — collarless key carries no `collar` marker.
      expect(noCollar.shellKey).not.toContain('collar');
      expect(collared.shellKey).toContain('collar');
    });
  });
});
