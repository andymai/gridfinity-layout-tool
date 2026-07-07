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

  for (const [name, overhang] of cases) {
    it(name, () => {
      const params = withOverhang(overhang);
      const dim = createInitialContext(params).dimensions;
      const ci = cutoutInterior(params);
      expect(ci.innerW).toBeCloseTo(dim.innerW, 6);
      expect(ci.innerD).toBeCloseTo(dim.innerD, 6);
      expect(ci.offsetX).toBeCloseTo(dim.innerOffsetX, 6);
      expect(ci.offsetY).toBeCloseTo(dim.innerOffsetY, 6);
    });
  }
});
