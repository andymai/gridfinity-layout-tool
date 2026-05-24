import { describe, it, expect } from 'vitest';
import {
  validateBinParams,
  computeMinCellSize,
  validateCompartmentSizes,
  maxCompartmentsForInner,
} from '@/features/bin-designer/utils/validation';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import type { BinParams } from '@/features/bin-designer/types';
import { expectOk, expectErr } from '@/test/testUtils';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('validateBinParams', () => {
  it('should pass for default params', () => {
    const result = validateBinParams(DEFAULT_BIN_PARAMS);
    expectOk(result);
  });

  describe('dimension ranges', () => {
    it('should reject width below minimum', () => {
      const result = validateBinParams(makeParams({ width: 0.25 }));
      const error = expectErr(result);
      expect(error.code).toBe('DIMENSION_OUT_OF_RANGE');
      expect(error.field).toBe('width');
    });

    it('should reject width above maximum', () => {
      const result = validateBinParams(makeParams({ width: 17 }));
      const error = expectErr(result);
      expect(error.code).toBe('DIMENSION_OUT_OF_RANGE');
    });

    it('should reject depth below minimum', () => {
      const result = validateBinParams(makeParams({ depth: 0 }));
      expectErr(result);
    });

    it('should reject depth above maximum', () => {
      const result = validateBinParams(makeParams({ depth: 17 }));
      expectErr(result);
    });

    it('should reject height below minimum', () => {
      const result = validateBinParams(makeParams({ height: 0 }));
      expectErr(result);
    });

    it('should reject height above maximum', () => {
      const result = validateBinParams(makeParams({ height: 25 }));
      expectErr(result);
    });

    it('should accept valid half-unit dimensions', () => {
      const result = validateBinParams(makeParams({ width: 1.5, depth: 2.5 }));
      expectOk(result);
    });

    it('should reject non-step width', () => {
      const result = validateBinParams(makeParams({ width: 1.3 }));
      const error = expectErr(result);
      expect(error.code).toBe('INVALID_STEP');
    });

    it('should reject non-integer height', () => {
      const result = validateBinParams(makeParams({ height: 3.5 }));
      const error = expectErr(result);
      expect(error.code).toBe('INVALID_STEP');
      expect(error.field).toBe('height');
    });

    it('should accept boundary values', () => {
      expectOk(validateBinParams(makeParams({ width: 0.5, depth: 2 })));
      expectOk(validateBinParams(makeParams({ width: 1, depth: 0.5 })));
      expectOk(validateBinParams(makeParams({ width: 8 })));
      // MIN_HEIGHT is 2 (1U = base only, 2U minimum for usable cavity)
      expectOk(validateBinParams(makeParams({ height: 2 })));
      expectOk(validateBinParams(makeParams({ height: 20 })));
    });

    it('should reject 0.5×0.5 footprint', () => {
      const result = validateBinParams(makeParams({ width: 0.5, depth: 0.5 }));
      const error = expectErr(result);
      expect(error.code).toBe('FOOTPRINT_TOO_SMALL');
    });

    it('should accept 0.5×1 and 1×0.5 footprints', () => {
      expectOk(validateBinParams(makeParams({ width: 0.5, depth: 1 })));
      expectOk(validateBinParams(makeParams({ width: 1, depth: 0.5 })));
    });
  });

  describe('compartment constraints', () => {
    it('should reject cols below minimum', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 0, rows: 1, thickness: 1.2, cells: [] } })
      );
      const error = expectErr(result);
      expect(error.code).toBe('COMPARTMENT_GRID_OUT_OF_RANGE');
    });

    it('should reject cols above maximum', () => {
      const overMax = DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID + 1;
      const result = validateBinParams(
        makeParams({
          compartments: {
            cols: overMax,
            rows: 1,
            thickness: 1.2,
            cells: Array(overMax)
              .fill(0)
              .map((_, i) => i),
          },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('COMPARTMENT_GRID_OUT_OF_RANGE');
    });

    it('should reject thickness below minimum', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 2, rows: 1, thickness: 0.5, cells: [0, 1] } })
      );
      const error = expectErr(result);
      expect(error.code).toBe('COMPARTMENT_THICKNESS_OUT_OF_RANGE');
    });

    it('should reject thickness above maximum', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 2, rows: 1, thickness: 3.0, cells: [0, 1] } })
      );
      const error = expectErr(result);
      expect(error.code).toBe('COMPARTMENT_THICKNESS_OUT_OF_RANGE');
    });

    it('should accept valid compartment config', () => {
      const result = validateBinParams(
        makeParams({
          compartments: {
            cols: 4,
            rows: 3,
            thickness: 1.2,
            cells: Array(12)
              .fill(0)
              .map((_, i) => i),
          },
        })
      );
      expectOk(result);
    });

    it('should reject cells array length mismatch', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2] } })
      );
      const error = expectErr(result);
      expect(error.code).toBe('COMPARTMENT_CELLS_MISMATCH');
    });
  });

  describe('label tab constraints', () => {
    it('should reject label tab depth out of range', () => {
      const result = validateBinParams(
        makeParams({
          label: { enabled: true, support: 'bracket', depth: 25, width: 100, alignment: 'left' },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('LABEL_TAB_DEPTH_OUT_OF_RANGE');
    });

    it('should reject label tab width out of range', () => {
      const result = validateBinParams(
        makeParams({
          label: { enabled: true, support: 'bracket', depth: 12, width: 110, alignment: 'left' },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('LABEL_TAB_WIDTH_OUT_OF_RANGE');
    });

    it('should accept valid label tab config', () => {
      const result = validateBinParams(
        makeParams({
          label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
        })
      );
      expectOk(result);
    });

    it('should accept solid label tab support', () => {
      const result = validateBinParams(
        makeParams({
          label: { enabled: true, support: 'solid', depth: 12, width: 100, alignment: 'left' },
        })
      );
      expectOk(result);
    });

    it('should accept fillet label tab support', () => {
      const result = validateBinParams(
        makeParams({
          label: { enabled: true, support: 'fillet', depth: 12, width: 100, alignment: 'left' },
        })
      );
      expectOk(result);
    });

    it('should reject invalid label tab support', () => {
      const result = validateBinParams(
        makeParams({
          label: {
            enabled: true,
            support: 'invalid' as any,
            depth: 12,
            width: 100,
            alignment: 'left',
          },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('LABEL_TAB_SUPPORT_INVALID');
    });

    it('should reject invalid label alignment', () => {
      const result = validateBinParams(
        makeParams({
          label: {
            enabled: true,
            support: 'bracket',
            depth: 12,
            width: 100,
            alignment: 'top' as any,
          },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('LABEL_ALIGNMENT_INVALID');
    });

    it('should skip validation when label disabled', () => {
      const result = validateBinParams(
        makeParams({
          label: { enabled: false, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
        })
      );
      expectOk(result);
    });

    it('should accept label tab at boundary depth values', () => {
      expectOk(
        validateBinParams(
          makeParams({
            label: {
              enabled: true,
              support: 'bracket',
              depth: DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH,
              width: 100,
              alignment: 'left',
            },
          })
        )
      );
      expectOk(
        validateBinParams(
          makeParams({
            label: {
              enabled: true,
              support: 'bracket',
              depth: DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH,
              width: 100,
              alignment: 'left',
            },
          })
        )
      );
    });

    it('should accept label tab at boundary width values', () => {
      expectOk(
        validateBinParams(
          makeParams({
            label: {
              enabled: true,
              support: 'bracket',
              depth: 12,
              width: DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH,
              alignment: 'center',
            },
          })
        )
      );
      expectOk(
        validateBinParams(
          makeParams({
            label: {
              enabled: true,
              support: 'bracket',
              depth: 12,
              width: DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH,
              alignment: 'right',
            },
          })
        )
      );
    });

    it('should reject depth just beyond boundary', () => {
      const result = validateBinParams(
        makeParams({
          label: {
            enabled: true,
            support: 'bracket',
            depth: DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH + 1,
            width: 100,
            alignment: 'left',
          },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('LABEL_TAB_DEPTH_OUT_OF_RANGE');
      expect(error.field).toBe('label.depth');
    });

    it('should reject width just beyond boundary', () => {
      const result = validateBinParams(
        makeParams({
          label: {
            enabled: true,
            support: 'bracket',
            depth: 12,
            width: DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH + 1,
            alignment: 'left',
          },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('LABEL_TAB_WIDTH_OUT_OF_RANGE');
      expect(error.field).toBe('label.width');
    });
  });

  describe('magnet depth constraints', () => {
    it('should reject magnet depth below minimum', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDepth: 0.5 },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('MAGNET_HEIGHT_OUT_OF_RANGE');
    });

    it('should reject magnet depth above maximum', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDepth: 5.0 },
        })
      );
      expectErr(result);
    });

    it('should accept valid magnet depth', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDepth: 2.4 },
        })
      );
      expectOk(result);
    });

    it('should not check magnet depth for non-magnet base styles', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', magnetDepth: 99 },
        })
      );
      expectOk(result);
    });

    it('should validate magnet depth for magnet_and_screw style', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', magnetDepth: 0.5 },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('MAGNET_HEIGHT_OUT_OF_RANGE');
    });

    it('should accept valid magnet_and_screw params', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', magnetDepth: 2.4 },
        })
      );
      expectOk(result);
    });
  });

  describe('compartment size validation', () => {
    it('should reject cols that create too-small compartments', () => {
      // 1-unit bin = 42mm outer, ~39.6mm inner after walls
      // 8 columns = 7 dividers consuming thickness, remaining/8 < 5mm each
      const result = validateBinParams(
        makeParams({
          width: 1,
          depth: 1,
          compartments: {
            cols: 8,
            rows: 1,
            thickness: 1.2,
            cells: Array(8)
              .fill(0)
              .map((_, i) => i),
          },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('COMPARTMENT_TOO_SMALL');
    });

    it('should reject rows that create too-small compartments', () => {
      const result = validateBinParams(
        makeParams({
          width: 1,
          depth: 1,
          compartments: {
            cols: 1,
            rows: 8,
            thickness: 1.2,
            cells: Array(8)
              .fill(0)
              .map((_, i) => i),
          },
        })
      );
      const error = expectErr(result);
      expect(error.code).toBe('COMPARTMENT_TOO_SMALL');
    });

    it('should accept reasonable compartment count for bin size', () => {
      // 2-unit bin = 84mm outer, ~81.6mm inner
      // 3 columns of ~26mm each = fine
      const result = validateBinParams(
        makeParams({
          width: 2,
          depth: 2,
          compartments: {
            cols: 3,
            rows: 3,
            thickness: 1.2,
            cells: Array(9)
              .fill(0)
              .map((_, i) => i),
          },
        })
      );
      expectOk(result);
    });

    it('should accept single-cell compartment', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] } })
      );
      expectOk(result);
    });

    it('should account for divider thickness in compartment size', () => {
      // Thick dividers leave less room
      // 1-unit bin (inner ~39.6mm), 7 cols with 6 dividers at 2.0mm = 12mm divider space
      // Remaining: 27.6mm / 7 = ~3.9mm < 5mm min
      const result = validateBinParams(
        makeParams({
          width: 1,
          depth: 1,
          compartments: {
            cols: 7,
            rows: 1,
            thickness: 2.0,
            cells: Array(7)
              .fill(0)
              .map((_, i) => i),
          },
        })
      );
      expectErr(result);
    });

    it('should allow maximum cols on large bins', () => {
      // 8-unit bin can handle many columns
      const result = validateBinParams(
        makeParams({
          width: 8,
          depth: 8,
          compartments: {
            cols: 8,
            rows: 8,
            thickness: 1.2,
            cells: Array(64)
              .fill(0)
              .map((_, i) => i),
          },
        })
      );
      expectOk(result);
    });
  });

  describe('expanded dimension ranges', () => {
    it('should accept 7-unit width', () => {
      expectOk(validateBinParams(makeParams({ width: 7 })));
    });

    it('should accept 16-unit width (maximum)', () => {
      expectOk(validateBinParams(makeParams({ width: 16 })));
    });

    it('should accept height 15', () => {
      expectOk(validateBinParams(makeParams({ height: 15 })));
    });

    it('should accept height 20 (new maximum)', () => {
      expectOk(validateBinParams(makeParams({ height: 20 })));
    });

    it('should reject height 21', () => {
      expectErr(validateBinParams(makeParams({ height: 21 })));
    });

    it('should reject width 16.5', () => {
      expectErr(validateBinParams(makeParams({ width: 16.5 })));
    });
  });
});

describe('computeMinCellSize', () => {
  it('computes correct cell size for single column/row', () => {
    // 2x2 bin, 1x1 grid, 1.2mm thickness (no dividers)
    const result = computeMinCellSize(2, 2, 1.2, 1, 1, 1.2);
    const innerW = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE - 2 * 1.2;
    expect(result.minCellW).toBeCloseTo(innerW);
    expect(result.minCellD).toBeCloseTo(innerW);
  });

  it('accounts for divider thickness with multiple columns', () => {
    // 2x2 bin, 3 cols, 1 row, 1.2mm dividers
    const result = computeMinCellSize(2, 2, 1.2, 3, 1, 1.2);
    const innerW = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE - 2 * 1.2;
    const expectedCellW = (innerW - 2 * 1.2) / 3; // 2 dividers
    expect(result.minCellW).toBeCloseTo(expectedCellW);
  });

  it('accounts for divider thickness with multiple rows', () => {
    const result = computeMinCellSize(2, 2, 1.2, 1, 4, 1.2);
    const innerD = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE - 2 * 1.2;
    const expectedCellD = (innerD - 3 * 1.2) / 4; // 3 dividers
    expect(result.minCellD).toBeCloseTo(expectedCellD);
  });

  it('returns small values for degenerate config', () => {
    // 0.5-unit bin, 8 cols, 2.4mm thick dividers
    const result = computeMinCellSize(0.5, 0.5, 1.2, 8, 8, 2.4);
    expect(result.minCellW).toBeLessThan(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE);
    expect(result.minCellD).toBeLessThan(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE);
  });

  it('returns large values for spacious config', () => {
    // 8-unit bin, 2 cols, thin dividers
    const result = computeMinCellSize(8, 8, 0.95, 2, 2, 0.4);
    expect(result.minCellW).toBeGreaterThan(100);
    expect(result.minCellD).toBeGreaterThan(100);
  });

  it('honors a custom gridUnitMm (regression: validator must match mesh frame)', () => {
    // 2-unit bin, half-pitch 30mm grid, 1x1 grid → innerW = 2 × 30 − 0.5 − 2 × 1.2 = 57.1
    const result = computeMinCellSize(2, 2, 1.2, 1, 1, 1.2, 30);
    expect(result.minCellW).toBeCloseTo(57.1, 5);
    // Same bin with default 42mm would produce 81.1 — confirm we're not falling back
    expect(result.minCellW).not.toBeCloseTo(81.1, 1);
  });

  it('rejects a config that fits at 42mm but not at 30mm gridUnitMm', () => {
    // 1-unit bin × 6 cols × 1.2mm dividers (min compartment size = 5mm)
    //   42mm: innerW = 42 − 0.5 − 2.4 = 39.1 → minCellW = (39.1 − 5 × 1.2) / 6 ≈ 5.52 (valid)
    //   30mm: innerW = 30 − 0.5 − 2.4 = 27.1 → minCellW = (27.1 − 5 × 1.2) / 6 ≈ 3.52 (too small)
    expectOk(validateCompartmentSizes(1, 1, 1.2, 6, 1, 1.2));
    const halfPitchErr = expectErr(validateCompartmentSizes(1, 1, 1.2, 6, 1, 1.2, 30));
    expect(halfPitchErr.code).toBe('COMPARTMENT_TOO_SMALL');
  });
});

describe('validateCompartmentSizes', () => {
  it('returns ok for 1x1 grid (no validation needed)', () => {
    const result = validateCompartmentSizes(1, 1, 1.2, 1, 1, 2.4);
    expectOk(result);
  });

  it('returns ok for viable grid configuration', () => {
    // 2x2 bin, 3x3 grid, 1.2mm dividers — plenty of space
    const result = validateCompartmentSizes(2, 2, 1.2, 3, 3, 1.2);
    expectOk(result);
  });

  it('returns error when cols produce too-small cells', () => {
    // 1-unit bin, 8 cols, 1.2mm dividers → cells ~3.9mm wide
    const result = validateCompartmentSizes(1, 1, 1.2, 8, 1, 1.2);
    const error = expectErr(result);
    expect(error.code).toBe('COMPARTMENT_TOO_SMALL');
    expect(error.field).toBe('compartments.cols');
  });

  it('returns error when rows produce too-small cells', () => {
    // 1-unit bin, 1 col, 8 rows, 1.2mm dividers
    const result = validateCompartmentSizes(1, 1, 1.2, 1, 8, 1.2);
    const error = expectErr(result);
    expect(error.code).toBe('COMPARTMENT_TOO_SMALL');
    expect(error.field).toBe('compartments.rows');
  });

  it('returns error when thick dividers make cells too small', () => {
    // 1-unit bin, 6 cols, 2.4mm dividers
    const result = validateCompartmentSizes(1, 1, 1.2, 6, 1, 2.4);
    expectErr(result);
  });

  it('accepts large bin with max grid', () => {
    // 8-unit bin, MAX×MAX compartment grid, 1.2mm dividers
    const max = DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID;
    const result = validateCompartmentSizes(8, 8, 1.2, max, max, 1.2);
    expectOk(result);
  });

  it('includes helpful error message with bin-size suggestion', () => {
    const result = validateCompartmentSizes(0.5, 0.5, 1.2, 4, 1, 1.2);
    const error = expectErr(result);
    expect(error.message).toContain('cell-size limit');
    expect(error.message).toContain('5mm minimum');
    expect(error.message).toMatch(/up to \d+ columns/);
  });

  it('rejects cols less than 1', () => {
    const result = validateCompartmentSizes(2, 2, 1.2, 0, 2, 1.2);
    const error = expectErr(result);
    expect(error.code).toBe('COMPARTMENT_GRID_INVALID');
    expect(error.field).toBe('compartments.cols');
  });

  it('rejects rows less than 1', () => {
    const result = validateCompartmentSizes(2, 2, 1.2, 2, 0, 1.2);
    const error = expectErr(result);
    expect(error.code).toBe('COMPARTMENT_GRID_INVALID');
    expect(error.field).toBe('compartments.rows');
  });
});

describe('maxCompartmentsForInner', () => {
  // 5mm minimum cell size + thickness gives N*(5+t) - t ≤ inner ⇒ N ≤ (inner+t)/(5+t)
  // These cases lock down the inverse-math formula since the validator error
  // message surfaces the result to end users.
  it('returns 1 when inner span is smaller than minimum cell size', () => {
    expect(maxCompartmentsForInner(4, 1.2)).toBe(1);
  });

  it('returns 1 when inner span exactly equals minimum cell size', () => {
    expect(maxCompartmentsForInner(5, 1.2)).toBe(1);
  });

  it('returns 2 when inner span comfortably fits two cells with one divider', () => {
    // 2 cells × 5mm + 1 divider × 1.2mm = 11.2mm minimum
    // Use 11.3 to stay off the IEEE-754 boundary (the helper makes no
    // epsilon-rounding guarantees, only the floor of the literal ratio).
    expect(maxCompartmentsForInner(11.3, 1.2)).toBe(2);
    // Just under should still be 1
    expect(maxCompartmentsForInner(11.1, 1.2)).toBe(1);
  });

  it('scales linearly with inner span for a fixed thickness', () => {
    // 1 unit (40mm inner ≈ 1×42 - tolerance - 2*0.95): 5+5+5+5+5+5 = 30, with 5 dividers @1.2 = 36 → fits 6
    expect(maxCompartmentsForInner(40, 1.2)).toBe(6);
    // 2 units (~83mm inner): can fit ~13 columns
    expect(maxCompartmentsForInner(83, 1.2)).toBe(13);
  });

  it('thicker dividers reduce the max count', () => {
    // 40mm inner with 0.4mm dividers ⇒ floor(40.4 / 5.4) = 7
    expect(maxCompartmentsForInner(40, 0.4)).toBe(7);
    // 40mm inner with 2.4mm dividers ⇒ floor(42.4 / 7.4) = 5
    expect(maxCompartmentsForInner(40, 2.4)).toBe(5);
  });

  it('clamps to at least 1 for degenerate inputs', () => {
    expect(maxCompartmentsForInner(0, 1.2)).toBe(1);
    expect(maxCompartmentsForInner(-10, 1.2)).toBe(1);
    expect(maxCompartmentsForInner(50, 0)).toBe(10); // 0-thickness edge case
  });
});

describe('validator surfaces the suggested-cap in the error message', () => {
  // Direct check: a known-tight bin should produce a specific suggested count.
  // Locks the message-rendering path (helper → message) against future refactors.
  it('reports the same N that maxCompartmentsForInner computes', () => {
    // 1×1 bin = ~40mm inner; with 1.2mm dividers, 6 cols max per the helper.
    // Request 12 cols → should fail with "...up to 6 columns."
    const result = validateCompartmentSizes(1, 1, 1.2, 12, 1, 1.2);
    const error = expectErr(result);
    expect(error.message).toContain('up to 6 columns');
  });
});
