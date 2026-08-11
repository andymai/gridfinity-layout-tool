/**
 * Drift guard: `labelTabInteriorDims` vs the pipeline's own `deriveDimensions`.
 *
 * The lid is generated independently of the bin pipeline, so it has no
 * `BinDimensions` to read and `labelTabInteriorDims` re-derives the interior
 * from params. That re-derivation is only safe while it agrees with the real
 * one — a silent divergence would put the label footprints at the wrong Z and
 * quietly stop clipping the click rails (#3401), with no failing geometry
 * assertion anywhere, since both solids stay perfectly valid.
 *
 * If this fails, `deriveDimensions` moved and `labelTabInteriorDims` must
 * follow it.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveDimensions } from './pipeline/context';
import { labelTabInteriorDims } from '@/shared/utils/labelTabPlan';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

const CASES: readonly (readonly [string, Partial<BinParams>])[] = [
  ['stock 2x3x6', { width: 2, depth: 3, height: 6 }],
  ['1U bin', { width: 1, depth: 1, height: 1 }],
  ['tall bin', { width: 4, depth: 2, height: 12 }],
  ['thick walls', { width: 3, depth: 3, height: 5, wallThickness: 2.4 }],
  ['thin walls', { width: 3, depth: 3, height: 5, wallThickness: 0.4 }],
  ['non-square grid', { width: 2, depth: 2, height: 4, gridUnitMmY: 21 }],
  ['no stacking lip', { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }],
  ['flat base', { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } }],
  ['tray base', { base: { ...DEFAULT_BIN_PARAMS.base, style: 'lid' } }],
  ['custom height unit', { height: 3, heightUnitMm: 10 }],
  ['symmetric overhang', { overhang: { left: 4, right: 4, front: 4, back: 4, feet: false } }],
  ['asymmetric overhang', { overhang: { left: 0, right: 6, front: 2, back: 0, feet: false } }],
];

describe('labelTabInteriorDims tracks deriveDimensions', () => {
  it.each(CASES)('%s', (_name, over) => {
    const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 3, height: 6, ...over };
    const real = deriveDimensions(params, false);
    const mirrored = labelTabInteriorDims(params);

    if (mirrored === null) throw new Error('expected dimensions for a walled bin');
    expect(mirrored.innerW).toBeCloseTo(real.innerW, 6);
    expect(mirrored.innerD).toBeCloseTo(real.innerD, 6);
    expect(mirrored.interiorHeight).toBeCloseTo(real.interiorHeight, 6);
    // The collar is what lifts the lip (and so the rail band) above an
    // unmoved shelf, so the mirror has to track it separately.
    expect(mirrored.collarHeight).toBeCloseTo(real.collarHeight, 6);
  });
});
