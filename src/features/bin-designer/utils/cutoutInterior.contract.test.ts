/**
 * Contract test: the cutout editor's interior frame ({@link cutoutInterior})
 * must equal the generator pipeline's interior derivation, so cutouts land
 * where the editor shows them (#2462). This imports the real generator context
 * builder rather than re-deriving, so any future change to the pipeline's
 * overhang math fails here instead of silently drifting the editor.
 */

import { describe, it, expect } from 'vitest';
import { createInitialContext } from '@/features/generation/worker/generators/pipeline/context';
import { cutoutInterior } from './binDimensions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

function withOverhang(overhang: BinParams['overhang']): BinParams {
  return { ...DEFAULT_BIN_PARAMS, overhang };
}

describe('cutoutInterior matches the generator pipeline dimensions', () => {
  const cases: Array<[string, BinParams['overhang']]> = [
    ['no overhang', undefined],
    ['symmetric', { left: 3, right: 3, front: 2, back: 2 }],
    ['asymmetric', { left: 0, right: 8, front: 4, back: 0 }],
    ['single side', { left: 6, right: 0, front: 0, back: 0 }],
    ['explicitly disabled', { enabled: false, left: 5, right: 5, front: 0, back: 0 }],
  ];

  function expectMatchesGenerator(params: BinParams): void {
    const dim = createInitialContext(params).dimensions;
    const ci = cutoutInterior(params);
    expect(ci.innerW).toBeCloseTo(dim.innerW, 6);
    expect(ci.innerD).toBeCloseTo(dim.innerD, 6);
    expect(ci.offsetX).toBeCloseTo(dim.innerOffsetX, 6);
    expect(ci.offsetY).toBeCloseTo(dim.innerOffsetY, 6);
  }

  for (const [name, overhang] of cases) {
    it(name, () => {
      expectMatchesGenerator(withOverhang(overhang));
    });
  }

  it('suppresses overhang for a partial cell mask (matches the generator)', () => {
    // Default bin is 2×2 grid units → 4×4 half-bin mask; one empty cell makes
    // it partial, so both the helper and the generator ignore the overhang.
    const cells = new Array(16).fill(1) as (0 | 1)[];
    cells[0] = 0;
    expectMatchesGenerator({
      ...DEFAULT_BIN_PARAMS,
      overhang: { left: 5, right: 5, front: 3, back: 3 },
      cellMask: { cols: 4, rows: 4, cells },
    });
  });
});
