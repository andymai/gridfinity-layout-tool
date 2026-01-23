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
      const result = validateBinParams(makeParams({ width: 7 }));
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
      const result = validateBinParams(makeParams({ depth: 8 }));
      expect(isErr(result)).toBe(true);
    });

    it('should reject height below minimum', () => {
      const result = validateBinParams(makeParams({ height: 0 }));
      expect(isErr(result)).toBe(true);
    });

    it('should reject height above maximum', () => {
      const result = validateBinParams(makeParams({ height: 13 }));
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
      expect(isOk(validateBinParams(makeParams({ width: 6 })))).toBe(true);
      expect(isOk(validateBinParams(makeParams({ height: 1 })))).toBe(true);
      expect(isOk(validateBinParams(makeParams({ height: 12 })))).toBe(true);
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
      const result = validateBinParams(makeParams({ style: 'vase', scoop: true }));
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
          scoop: false,
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
  });
});
