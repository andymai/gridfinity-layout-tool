import { describe, it, expect } from 'vitest';
import { MASK_CELLS_PER_UNIT, validateMask } from '@/shared/utils/cellMask';
import {
  L_PRESET,
  T_PRESET,
  U_PRESET,
  RECTANGLE_PRESET,
  SHAPE_PRESETS,
  getPreset,
  type ShapePreset,
} from './shapePresets';

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

describe('preset availability + build matrix', () => {
  interface Case {
    readonly preset: ShapePreset;
    readonly w: number;
    readonly d: number;
    readonly available: boolean;
  }

  // Exhaustive matrix covering: minimum sizes (1×1, 1.5×1.5), asymmetric
  // (2×5, 5×2), half-bin (2.5×2.5), and the upper bound (10×10). Each
  // case asserts `isAvailable` matches expectation and, when available,
  // `build` returns a mask that passes `validateMask` and matches the
  // bin's half-bin dimensions.
  const matrix: readonly Case[] = [
    // Rectangle — always available across the full range.
    { preset: RECTANGLE_PRESET, w: 1, d: 1, available: true },
    { preset: RECTANGLE_PRESET, w: 1.5, d: 1.5, available: true },
    { preset: RECTANGLE_PRESET, w: 2, d: 2, available: true },
    { preset: RECTANGLE_PRESET, w: 5, d: 3, available: true },
    { preset: RECTANGLE_PRESET, w: 10, d: 10, available: true },
    // L — needs W ≥ 2 and D ≥ 2.
    { preset: L_PRESET, w: 1, d: 1, available: false },
    { preset: L_PRESET, w: 1, d: 3, available: false },
    { preset: L_PRESET, w: 3, d: 1, available: false },
    { preset: L_PRESET, w: 1.5, d: 1.5, available: false },
    { preset: L_PRESET, w: 2, d: 2, available: true },
    { preset: L_PRESET, w: 2.5, d: 2.5, available: true },
    { preset: L_PRESET, w: 5, d: 2, available: true },
    { preset: L_PRESET, w: 2, d: 5, available: true },
    { preset: L_PRESET, w: 10, d: 10, available: true },
    // T — needs W ≥ 3 and D ≥ 2.
    { preset: T_PRESET, w: 2, d: 2, available: false },
    { preset: T_PRESET, w: 2.5, d: 3, available: false },
    { preset: T_PRESET, w: 3, d: 1, available: false },
    { preset: T_PRESET, w: 3, d: 2, available: true },
    { preset: T_PRESET, w: 4, d: 2, available: true },
    { preset: T_PRESET, w: 10, d: 10, available: true },
    // U — same constraints as T.
    { preset: U_PRESET, w: 2, d: 2, available: false },
    { preset: U_PRESET, w: 3, d: 2, available: true },
    { preset: U_PRESET, w: 5, d: 3, available: true },
    { preset: U_PRESET, w: 10, d: 10, available: true },
  ];

  it.each(matrix)(
    '$preset.id preset at $w×$d → available: $available',
    ({ preset, w, d, available }) => {
      expect(preset.isAvailable(w, d)).toBe(available);

      if (!available) return;
      const mask = preset.build(w, d);

      // Rectangle preset returns undefined by design; everything else
      // must produce a structurally-valid mask at the right dimensions.
      if (preset.id === 'rectangle') {
        expect(mask).toBeUndefined();
        return;
      }
      expect(mask).toBeDefined();
      expect(mask!.cols).toBe(Math.round(w * MASK_CELLS_PER_UNIT));
      expect(mask!.rows).toBe(Math.round(d * MASK_CELLS_PER_UNIT));
      expect(validateMask(mask!)).toBeNull();
    }
  );

  it('every SHAPE_PRESETS entry is exported and builds a valid mask at 10×10', () => {
    // Smoke test: loop over the registered presets so a new preset added
    // to the tuple automatically gets sanity-checked at the max bin size.
    for (const preset of SHAPE_PRESETS) {
      expect(preset.isAvailable(10, 10)).toBe(true);
      const mask = preset.build(10, 10);
      if (preset.id === 'rectangle') {
        expect(mask).toBeUndefined();
      } else {
        expect(mask).toBeDefined();
        expect(validateMask(mask!)).toBeNull();
      }
    }
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
