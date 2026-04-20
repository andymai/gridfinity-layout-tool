import { describe, it, expect } from 'vitest';
import { MASK_CELLS_PER_UNIT, validateMask } from '@/shared/utils/cellMask';
import { L_PRESET, T_PRESET, U_PRESET, RECTANGLE_PRESET, getPreset } from './shapePresets';

describe('RECTANGLE_PRESET', () => {
  it('is always available', () => {
    expect(RECTANGLE_PRESET.isAvailable(1, 1)).toBe(true);
    expect(RECTANGLE_PRESET.isAvailable(10, 10)).toBe(true);
  });

  it('builds undefined (rectangle fast-path)', () => {
    expect(RECTANGLE_PRESET.build(3, 3)).toBeUndefined();
  });
});

describe('L_PRESET', () => {
  it('unavailable for bins smaller than 2×2', () => {
    expect(L_PRESET.isAvailable(1, 1)).toBe(false);
    expect(L_PRESET.isAvailable(1, 3)).toBe(false);
    expect(L_PRESET.isAvailable(3, 1)).toBe(false);
  });

  it('available for 2×2 and larger', () => {
    expect(L_PRESET.isAvailable(2, 2)).toBe(true);
    expect(L_PRESET.isAvailable(3, 3)).toBe(true);
  });

  it('produces a valid mask with the bottom-right corner cleared', () => {
    const mask = L_PRESET.build(3, 3)!;
    expect(mask.cols).toBe(3 * MASK_CELLS_PER_UNIT);
    expect(mask.rows).toBe(3 * MASK_CELLS_PER_UNIT);
    // Bottom-right cell should be 0 (cleared).
    expect(mask.cells[0 * mask.cols + (mask.cols - 1)]).toBe(0);
    // Top-left cell should be 1.
    expect(mask.cells[(mask.rows - 1) * mask.cols + 0]).toBe(1);
    expect(validateMask(mask)).toBeNull();
  });
});

describe('T_PRESET', () => {
  it('unavailable for narrow bins (width < 3)', () => {
    expect(T_PRESET.isAvailable(2, 3)).toBe(false);
  });

  it('available for 3×2 and larger', () => {
    expect(T_PRESET.isAvailable(3, 2)).toBe(true);
  });

  it('produces a valid T-shape mask', () => {
    const mask = T_PRESET.build(3, 3)!;
    expect(validateMask(mask)).toBeNull();
    // Top row is fully filled.
    for (let c = 0; c < mask.cols; c++) {
      expect(mask.cells[(mask.rows - 1) * mask.cols + c]).toBe(1);
    }
    // Bottom row has some zeros (shoulder cuts).
    const bottomRow = mask.cells.slice(0, mask.cols);
    expect(bottomRow.some((v) => v === 0)).toBe(true);
  });
});

describe('U_PRESET', () => {
  it('unavailable for narrow bins (width < 3)', () => {
    expect(U_PRESET.isAvailable(2, 3)).toBe(false);
  });

  it('produces a valid U-shape mask with central top gap', () => {
    const mask = U_PRESET.build(3, 3)!;
    expect(validateMask(mask)).toBeNull();
    // Bottom row is fully filled.
    for (let c = 0; c < mask.cols; c++) {
      expect(mask.cells[0 * mask.cols + c]).toBe(1);
    }
    // Top row has some zeros (central gap).
    const topRow = mask.cells.slice((mask.rows - 1) * mask.cols);
    expect(topRow.some((v) => v === 0)).toBe(true);
  });
});

describe('getPreset', () => {
  it('looks up by id', () => {
    expect(getPreset('l').id).toBe('l');
    expect(getPreset('t').id).toBe('t');
  });

  it('falls back to rectangle for unknown ids', () => {
    // @ts-expect-error -- deliberate invalid id for fallback test
    expect(getPreset('invalid').id).toBe('rectangle');
  });
});
