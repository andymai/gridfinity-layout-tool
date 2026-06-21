import { describe, it, expect } from 'vitest';
import { estimateBedLoads, type Footprint } from './bedPacking';

const BED = 256;

describe('estimateBedLoads', () => {
  it('returns 0 for no pieces', () => {
    expect(estimateBedLoads([], BED, BED)).toBe(0);
  });

  it('returns 1 for a single piece that fits the bed', () => {
    expect(estimateBedLoads([{ w: 200, d: 200 }], BED, BED)).toBe(1);
  });

  it('packs two half-width, full-height pieces onto one bed', () => {
    const pieces: Footprint[] = [
      { w: 120, d: 250 },
      { w: 120, d: 250 },
    ];
    expect(estimateBedLoads(pieces, BED, BED)).toBe(1);
  });

  it('packs two full-width, half-height pieces onto one bed (stacked shelves)', () => {
    const pieces: Footprint[] = [
      { w: 250, d: 120 },
      { w: 250, d: 120 },
    ];
    expect(estimateBedLoads(pieces, BED, BED)).toBe(1);
  });

  it('uses rotation to pack a wide and a tall piece together', () => {
    // A 250×120 and a 120×250 both occupy the same footprint rotated; two of
    // them stack as two 250×120 shelves (240 ≤ 256 depth) on one bed.
    const pieces: Footprint[] = [
      { w: 250, d: 120 },
      { w: 120, d: 250 },
    ];
    expect(estimateBedLoads(pieces, BED, BED)).toBe(1);
  });

  it('needs one bed per piece when pieces are too big to pair', () => {
    // 140×140 squares can't pair (2×140 = 280 > 256 in either axis) → 1 per bed.
    const sq: Footprint = { w: 140, d: 140 };
    expect(estimateBedLoads([sq, sq, sq], BED, BED)).toBe(3);
  });

  it('opens a second bed only once one is full', () => {
    // 120×120 packs 2 per shelf × 2 shelves = 4 per bed; the 5th opens bed two.
    const q: Footprint = { w: 120, d: 120 };
    expect(estimateBedLoads([q, q, q, q], BED, BED)).toBe(1);
    expect(estimateBedLoads([q, q, q, q, q], BED, BED)).toBe(2);
  });

  it('gives each oversize piece its own bed (stays total)', () => {
    const pieces: Footprint[] = [
      { w: 300, d: 300 },
      { w: 300, d: 300 },
    ];
    expect(estimateBedLoads(pieces, BED, BED)).toBe(2);
  });

  it('an oversize piece claims its own bed and does not absorb later small pieces', () => {
    // The oversize piece must not leave a reusable empty bed: it gets bed 1
    // alone, and the two quarter-bed pieces share bed 2.
    const pieces: Footprint[] = [
      { w: 300, d: 300 },
      { w: 120, d: 120 },
      { w: 120, d: 120 },
    ];
    expect(estimateBedLoads(pieces, BED, BED)).toBe(2);
  });

  it('packs a 2×2 grid of quarter-bed pieces onto one bed', () => {
    const q: Footprint = { w: 120, d: 120 };
    expect(estimateBedLoads([q, q, q, q], BED, BED)).toBe(1);
  });

  it('respects a non-square bed', () => {
    // Bed 256×128: two 120×120 fit side by side on one shelf (240≤256) within
    // the 128 depth → 1 bed; add a third → second bed.
    const q: Footprint = { w: 120, d: 120 };
    expect(estimateBedLoads([q, q], 256, 128)).toBe(1);
    expect(estimateBedLoads([q, q, q], 256, 128)).toBe(2);
  });
});
