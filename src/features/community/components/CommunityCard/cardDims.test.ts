import { describe, it, expect } from 'vitest';
import { formatCardDims } from './cardDims';

describe('formatCardDims', () => {
  it('recovers whole grid units from tolerance-adjusted millimetres', () => {
    expect(formatCardDims({ width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 })).toBe('2×3×6');
  });

  it('recovers half-unit footprints', () => {
    expect(formatCardDims({ width: 20.5, depth: 62.5, height: 21, gridUnitMm: 42 })).toBe(
      '0.5×1.5×3'
    );
  });

  it('tracks a non-standard grid unit', () => {
    expect(formatCardDims({ width: 49.5, depth: 24.5, height: 28, gridUnitMm: 25 })).toBe('2×1×4');
  });
});
