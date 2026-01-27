import { describe, it, expect } from 'vitest';
import { isOk, isErr } from '@/core/result';
import {
  validateBinParams,
  computeMinCellSize,
  validateCompartmentSizes,
} from '@/features/bin-designer/utils/validation';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import type { BinParams } from '@/features/bin-designer/types';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('validateBinParams', () => {
  it('should pass for default params', () => {
    const result = validateBinParams(DEFAULT_BIN_PARAMS);
    expect(isOk(result)).toBe(true);
  });

  describe('dimension ranges', () => {
    it('should reject width below minimum', () => {
      const result = validateBinParams(makeParams({ width: 0.25 }));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DIMENSION_OUT_OF_RANGE');
        expect(result.error.field).toBe('width');
      }
    });

    it('should reject width above maximum', () => {
      const result = validateBinParams(makeParams({ width: 9 }));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DIMENSION_OUT_OF_RANGE');
      }
    });

    it('should reject depth below minimum', () => {
      const result = validateBinParams(makeParams({ depth: 0 }));
      expect(isErr(result)).toBe(true);
    });

    it('should reject depth above maximum', () => {
      const result = validateBinParams(makeParams({ depth: 9 }));
      expect(isErr(result)).toBe(true);
    });

    it('should reject height below minimum', () => {
      const result = validateBinParams(makeParams({ height: 0 }));
      expect(isErr(result)).toBe(true);
    });

    it('should reject height above maximum', () => {
      const result = validateBinParams(makeParams({ height: 25 }));
      expect(isErr(result)).toBe(true);
    });

    it('should accept valid half-unit dimensions', () => {
      const result = validateBinParams(makeParams({ width: 1.5, depth: 2.5 }));
      expect(isOk(result)).toBe(true);
    });

    it('should reject non-step width', () => {
      const result = validateBinParams(makeParams({ width: 1.3 }));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_STEP');
      }
    });

    it('should reject non-integer height', () => {
      const result = validateBinParams(makeParams({ height: 3.5 }));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_STEP');
        expect(result.error.field).toBe('height');
      }
    });

    it('should accept boundary values', () => {
      expect(isOk(validateBinParams(makeParams({ width: 0.5 })))).toBe(true);
      expect(isOk(validateBinParams(makeParams({ width: 8 })))).toBe(true);
      // MIN_HEIGHT is 2 (1U = base only, 2U minimum for usable cavity)
      expect(isOk(validateBinParams(makeParams({ height: 2 })))).toBe(true);
      expect(isOk(validateBinParams(makeParams({ height: 20 })))).toBe(true);
    });
  });

  describe('compartment constraints', () => {
    it('should reject cols below minimum', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 0, rows: 1, thickness: 1.2, cells: [] } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_GRID_OUT_OF_RANGE');
      }
    });

    it('should reject cols above maximum', () => {
      const result = validateBinParams(
        makeParams({
          compartments: {
            cols: 9,
            rows: 1,
            thickness: 1.2,
            cells: Array(9)
              .fill(0)
              .map((_, i) => i),
          },
        })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_GRID_OUT_OF_RANGE');
      }
    });

    it('should reject thickness below minimum', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 2, rows: 1, thickness: 0.5, cells: [0, 1] } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_THICKNESS_OUT_OF_RANGE');
      }
    });

    it('should reject thickness above maximum', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 2, rows: 1, thickness: 3.0, cells: [0, 1] } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_THICKNESS_OUT_OF_RANGE');
      }
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
      expect(isOk(result)).toBe(true);
    });

    it('should reject cells array length mismatch', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2] } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_CELLS_MISMATCH');
      }
    });
  });

  describe('label constraints', () => {
    it('should reject label text exceeding max length', () => {
      const result = validateBinParams(
        makeParams({ label: { enabled: true, text: 'a'.repeat(21), fontSize: 'auto' } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LABEL_TOO_LONG');
      }
    });

    it('should accept label at max length', () => {
      const result = validateBinParams(
        makeParams({ label: { enabled: true, text: 'a'.repeat(20), fontSize: 'auto' } })
      );
      expect(isOk(result)).toBe(true);
    });
  });

  describe('magnet depth constraints', () => {
    it('should reject magnet depth below minimum', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDepth: 0.5 },
        })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('MAGNET_HEIGHT_OUT_OF_RANGE');
      }
    });

    it('should reject magnet depth above maximum', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDepth: 5.0 },
        })
      );
      expect(isErr(result)).toBe(true);
    });

    it('should accept valid magnet depth', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDepth: 2.4 },
        })
      );
      expect(isOk(result)).toBe(true);
    });

    it('should not check magnet depth for non-magnet base styles', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', magnetDepth: 99 },
        })
      );
      expect(isOk(result)).toBe(true);
    });

    it('should validate magnet depth for magnet_and_screw style', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', magnetDepth: 0.5 },
        })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('MAGNET_HEIGHT_OUT_OF_RANGE');
      }
    });

    it('should accept valid magnet_and_screw params', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', magnetDepth: 2.4 },
        })
      );
      expect(isOk(result)).toBe(true);
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
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_TOO_SMALL');
      }
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
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_TOO_SMALL');
      }
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
      expect(isOk(result)).toBe(true);
    });

    it('should accept single-cell compartment', () => {
      const result = validateBinParams(
        makeParams({ compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] } })
      );
      expect(isOk(result)).toBe(true);
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
      expect(isErr(result)).toBe(true);
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
      expect(isOk(result)).toBe(true);
    });
  });

  describe('expanded dimension ranges', () => {
    it('should accept 7-unit width', () => {
      expect(isOk(validateBinParams(makeParams({ width: 7 })))).toBe(true);
    });

    it('should accept 8-unit width (new maximum)', () => {
      expect(isOk(validateBinParams(makeParams({ width: 8 })))).toBe(true);
    });

    it('should accept height 15', () => {
      expect(isOk(validateBinParams(makeParams({ height: 15 })))).toBe(true);
    });

    it('should accept height 20 (new maximum)', () => {
      expect(isOk(validateBinParams(makeParams({ height: 20 })))).toBe(true);
    });

    it('should reject height 21', () => {
      expect(isErr(validateBinParams(makeParams({ height: 21 })))).toBe(true);
    });

    it('should reject width 8.5', () => {
      expect(isErr(validateBinParams(makeParams({ width: 8.5 })))).toBe(true);
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
});

describe('validateCompartmentSizes', () => {
  it('returns ok for 1x1 grid (no validation needed)', () => {
    const result = validateCompartmentSizes(1, 1, 1.2, 1, 1, 2.4);
    expect(isOk(result)).toBe(true);
  });

  it('returns ok for viable grid configuration', () => {
    // 2x2 bin, 3x3 grid, 1.2mm dividers — plenty of space
    const result = validateCompartmentSizes(2, 2, 1.2, 3, 3, 1.2);
    expect(isOk(result)).toBe(true);
  });

  it('returns error when cols produce too-small cells', () => {
    // 1-unit bin, 8 cols, 1.2mm dividers → cells ~3.9mm wide
    const result = validateCompartmentSizes(1, 1, 1.2, 8, 1, 1.2);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('COMPARTMENT_TOO_SMALL');
      expect(result.error.field).toBe('compartments.cols');
    }
  });

  it('returns error when rows produce too-small cells', () => {
    // 1-unit bin, 1 col, 8 rows, 1.2mm dividers
    const result = validateCompartmentSizes(1, 1, 1.2, 1, 8, 1.2);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('COMPARTMENT_TOO_SMALL');
      expect(result.error.field).toBe('compartments.rows');
    }
  });

  it('returns error when thick dividers make cells too small', () => {
    // 1-unit bin, 6 cols, 2.4mm dividers
    const result = validateCompartmentSizes(1, 1, 1.2, 6, 1, 2.4);
    expect(isErr(result)).toBe(true);
  });

  it('accepts large bin with max grid', () => {
    // 8-unit bin, 8x8 grid, 1.2mm dividers
    const result = validateCompartmentSizes(8, 8, 1.2, 8, 8, 1.2);
    expect(isOk(result)).toBe(true);
  });

  it('includes helpful error message', () => {
    const result = validateCompartmentSizes(0.5, 0.5, 1.2, 4, 1, 1.2);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain('Compartment cells too small');
      expect(result.error.message).toContain('min');
    }
  });

  it('rejects cols less than 1', () => {
    const result = validateCompartmentSizes(2, 2, 1.2, 0, 2, 1.2);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('COMPARTMENT_GRID_INVALID');
      expect(result.error.field).toBe('compartments.cols');
    }
  });

  it('rejects rows less than 1', () => {
    const result = validateCompartmentSizes(2, 2, 1.2, 2, 0, 1.2);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('COMPARTMENT_GRID_INVALID');
      expect(result.error.field).toBe('compartments.rows');
    }
  });
});
