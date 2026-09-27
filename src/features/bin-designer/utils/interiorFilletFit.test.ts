import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { narrowestCavitySpansMm } from '@/shared/utils/interiorFillet';
import { interiorFilletFitMm } from './interiorFilletFit';

function bin(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, width: 2, depth: 1, ...overrides };
}

describe('interiorFilletFitMm', () => {
  it('is half the narrowest span in a bin tall enough', () => {
    const params = bin({ height: 6 });
    const span = Math.min(...narrowestCavitySpansMm(params).values());
    expect(interiorFilletFitMm(params)).toBeCloseTo(span / 2, 6);
  });

  it('is the headroom above the floor in a bin too short for the span', () => {
    const params = bin({ height: 2 });
    const span = Math.min(...narrowestCavitySpansMm(params).values());
    expect(interiorFilletFitMm(params)).toBeLessThan(span / 2);
  });

  it('shrinks over a raised floor', () => {
    const compartments = { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 };
    const flat = interiorFilletFitMm(bin({ height: 3, compartments }));
    const raised = interiorFilletFitMm(
      bin({ height: 3, compartments: { ...compartments, floorRaises: [6, null] } })
    );
    expect(raised).toBeCloseTo(flat - 6, 6);
  });

  it('stops at the top of short dividers', () => {
    const compartments = { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 };
    const full = interiorFilletFitMm(bin({ height: 3, compartments }));
    const short = interiorFilletFitMm(
      bin({ height: 3, compartments: { ...compartments, dividerHeight: 8 } })
    );
    expect(short).toBeLessThan(full);
  });
});
