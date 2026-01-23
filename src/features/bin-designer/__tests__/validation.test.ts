import { describe, it, expect } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { validateBinParams } from '../utils/validation';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

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
      // MIN_HEIGHT is 2 (1U = base only, no usable cavity)
      expect(isOk(validateBinParams(makeParams({ height: 2 })))).toBe(true);
      expect(isOk(validateBinParams(makeParams({ height: 20 })))).toBe(true);
    });
  });

  describe('divider constraints', () => {
    it('should reject negative dividers', () => {
      const result = validateBinParams(
        makeParams({ dividers: { x: -1, y: 0, thickness: 1.2 } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DIVIDER_OUT_OF_RANGE');
      }
    });

    it('should reject too many dividers', () => {
      const result = validateBinParams(
        makeParams({ dividers: { x: 11, y: 0, thickness: 1.2 } })
      );
      expect(isErr(result)).toBe(true);
    });

    it('should reject thickness below minimum', () => {
      const result = validateBinParams(
        makeParams({ dividers: { x: 1, y: 1, thickness: 0.5 } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DIVIDER_THICKNESS_OUT_OF_RANGE');
      }
    });

    it('should reject thickness above maximum', () => {
      const result = validateBinParams(
        makeParams({ dividers: { x: 1, y: 1, thickness: 3.0 } })
      );
      expect(isErr(result)).toBe(true);
    });

    it('should accept valid divider config', () => {
      const result = validateBinParams(
        makeParams({ dividers: { x: 3, y: 2, thickness: 1.2 } })
      );
      expect(isOk(result)).toBe(true);
    });
  });

  describe('wall cutout constraints', () => {
    it('should reject negative wall values', () => {
      const result = validateBinParams(
        makeParams({ walls: { front: -10, back: 0, left: 0, right: 0 } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('WALL_CUTOUT_OUT_OF_RANGE');
      }
    });

    it('should reject values above 100%', () => {
      const result = validateBinParams(
        makeParams({ walls: { front: 0, back: 110, left: 0, right: 0 } })
      );
      expect(isErr(result)).toBe(true);
    });

    it('should reject values between 0 and minimum', () => {
      const result = validateBinParams(
        makeParams({ walls: { front: 15, back: 0, left: 0, right: 0 } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('WALL_CUTOUT_TOO_SMALL');
      }
    });

    it('should accept 0% (no cutout)', () => {
      const result = validateBinParams(
        makeParams({ walls: { front: 0, back: 0, left: 0, right: 0 } })
      );
      expect(isOk(result)).toBe(true);
    });

    it('should accept minimum cutout (20%)', () => {
      const result = validateBinParams(
        makeParams({ walls: { front: 20, back: 50, left: 0, right: 100 } })
      );
      expect(isOk(result)).toBe(true);
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

  describe('vase mode constraints', () => {
    it('should reject dividers in vase mode', () => {
      const result = validateBinParams(
        makeParams({ style: 'vase', dividers: { x: 1, y: 0, thickness: 1.2 } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VASE_INCOMPATIBLE');
      }
    });

    it('should reject scoop in vase mode', () => {
      const result = validateBinParams(makeParams({ style: 'vase', scoop: { enabled: true, radius: 'auto', allRows: false } }));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VASE_INCOMPATIBLE');
      }
    });

    it('should reject label in vase mode', () => {
      const result = validateBinParams(
        makeParams({ style: 'vase', label: { enabled: true, text: 'test', fontSize: 'auto' } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VASE_INCOMPATIBLE');
      }
    });

    it('should accept vase mode with no features', () => {
      const result = validateBinParams(
        makeParams({
          style: 'vase',
          dividers: { x: 0, y: 0, thickness: 1.2 },
          scoop: { enabled: false, radius: 'auto', allRows: false },
          label: { enabled: false, text: '', fontSize: 'auto' },
        })
      );
      expect(isOk(result)).toBe(true);
    });
  });

  describe('magnet depth constraints', () => {
    it('should reject magnet depth below minimum', () => {
      const result = validateBinParams(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDepth: 1.5 },
        })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('MAGNET_DEPTH_OUT_OF_RANGE');
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
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', magnetDepth: 1.5 },
        })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('MAGNET_DEPTH_OUT_OF_RANGE');
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

  describe('scoop radius constraints', () => {
    it('should accept auto radius', () => {
      const result = validateBinParams(
        makeParams({ scoop: { enabled: true, radius: 'auto', allRows: false } })
      );
      expect(isOk(result)).toBe(true);
    });

    it('should reject fixed radius below minimum', () => {
      const result = validateBinParams(
        makeParams({ scoop: { enabled: true, radius: 1.0, allRows: false } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('SCOOP_RADIUS_OUT_OF_RANGE');
      }
    });

    it('should reject fixed radius above maximum', () => {
      const result = validateBinParams(
        makeParams({ scoop: { enabled: true, radius: 35, allRows: false } })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('SCOOP_RADIUS_OUT_OF_RANGE');
      }
    });

    it('should accept valid fixed radius', () => {
      expect(isOk(validateBinParams(
        makeParams({ scoop: { enabled: true, radius: 10, allRows: false } })
      ))).toBe(true);
    });

    it('should not validate radius when scoop is disabled', () => {
      // Invalid radius but scoop disabled - should pass
      const result = validateBinParams(
        makeParams({ scoop: { enabled: false, radius: 1.0, allRows: false } })
      );
      expect(isOk(result)).toBe(true);
    });

    it('should accept boundary radius values', () => {
      expect(isOk(validateBinParams(
        makeParams({ scoop: { enabled: true, radius: 2.0, allRows: false } })
      ))).toBe(true);
      expect(isOk(validateBinParams(
        makeParams({ scoop: { enabled: true, radius: 30.0, allRows: false } })
      ))).toBe(true);
    });
  });

  describe('compartment size validation', () => {
    it('should reject dividers that create too-small compartments', () => {
      // 1-unit bin = 42mm outer, ~39.6mm inner after walls
      // 8 X dividers = 9 compartments of ~4mm each = too small (< 5mm)
      const result = validateBinParams(
        makeParams({
          width: 1,
          depth: 1,
          dividers: { x: 8, y: 0, thickness: 1.2 },
        })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_TOO_SMALL');
      }
    });

    it('should reject Y dividers that create too-small compartments', () => {
      const result = validateBinParams(
        makeParams({
          width: 1,
          depth: 1,
          dividers: { x: 0, y: 8, thickness: 1.2 },
        })
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('COMPARTMENT_TOO_SMALL');
      }
    });

    it('should accept reasonable divider count for bin size', () => {
      // 2-unit bin = 84mm outer, ~81.6mm inner
      // 2 dividers = 3 compartments of ~26mm each = fine
      const result = validateBinParams(
        makeParams({
          width: 2,
          depth: 2,
          dividers: { x: 2, y: 2, thickness: 1.2 },
        })
      );
      expect(isOk(result)).toBe(true);
    });

    it('should accept zero dividers', () => {
      const result = validateBinParams(
        makeParams({ dividers: { x: 0, y: 0, thickness: 1.2 } })
      );
      expect(isOk(result)).toBe(true);
    });

    it('should account for divider thickness in compartment size', () => {
      // Thick dividers leave less room for compartments
      // 1-unit bin (inner ~39.6mm), 6 dividers at 2.0mm = 12mm divider space
      // Remaining: 27.6mm / 7 compartments = 3.94mm each < 5mm min
      const result = validateBinParams(
        makeParams({
          width: 1,
          depth: 1,
          dividers: { x: 6, y: 0, thickness: 2.0 },
        })
      );
      expect(isErr(result)).toBe(true);
    });

    it('should allow maximum dividers on large bins', () => {
      // 8-unit bin can handle many dividers
      const result = validateBinParams(
        makeParams({
          width: 8,
          depth: 8,
          dividers: { x: 10, y: 10, thickness: 1.2 },
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
