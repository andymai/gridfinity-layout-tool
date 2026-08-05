import { describe, it, expect } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { formatGridSize, formatMillimetres } from './publishSummary';

function params(overrides: Partial<BinParams> = {}): BinParams {
  return {
    width: 2,
    depth: 4,
    height: 4,
    gridUnitMm: 42,
    heightUnitMm: 7,
    wallThickness: 1.2,
    ...overrides,
  } as unknown as BinParams;
}

describe('formatGridSize', () => {
  it('renders whole units without decimals', () => {
    expect(formatGridSize(params())).toBe('2×4×4');
  });

  it('keeps half-bin sizes readable', () => {
    expect(formatGridSize(params({ width: 2.5, depth: 1.5 }))).toBe('2.5×1.5×4');
  });
});

describe('formatMillimetres', () => {
  it('multiplies units by their pitch', () => {
    expect(formatMillimetres(params())).toBe('84 × 168 × 28 mm');
  });

  it('uses the Y pitch on a non-square grid', () => {
    expect(formatMillimetres(params({ gridUnitMmY: 22 }))).toBe('84 × 88 × 28 mm');
  });

  it('rounds a fractional result to one decimal', () => {
    expect(formatMillimetres(params({ width: 2.5, height: 1.5 }))).toBe('105 × 168 × 10.5 mm');
  });
});
