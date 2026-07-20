import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { dividerInteriorDims } from './dividerExport';

const base: BinParams = { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2 };

describe('dividerInteriorDims', () => {
  it('matches the nominal interior when there is no overhang', () => {
    const { innerW, innerD } = dividerInteriorDims(base);
    // 3 * 42 - 0.5 tolerance - 2*wall; exact wall value comes from defaults.
    const outerW = 3 * base.gridUnitMm - 0.5;
    expect(innerW).toBeCloseTo(outerW - 2 * base.wallThickness, 5);
    const outerD = 2 * base.gridUnitMm - 0.5;
    expect(innerD).toBeCloseTo(outerD - 2 * base.wallThickness, 5);
  });

  it('expands the interior by the per-side overhang so pieces reach the slots', () => {
    const withOverhang = dividerInteriorDims({
      ...base,
      overhang: { enabled: true, left: 4, right: 6, front: 3, back: 0 },
    });
    const nominal = dividerInteriorDims(base);
    expect(withOverhang.innerW).toBeCloseTo(nominal.innerW + 10, 5); // 4 + 6
    expect(withOverhang.innerD).toBeCloseTo(nominal.innerD + 3, 5); // 3 + 0
  });

  it('ignores overhang when disabled', () => {
    const disabled = dividerInteriorDims({
      ...base,
      overhang: { enabled: false, left: 4, right: 6, front: 3, back: 2 },
    });
    expect(disabled.innerW).toBeCloseTo(dividerInteriorDims(base).innerW, 5);
  });
});
