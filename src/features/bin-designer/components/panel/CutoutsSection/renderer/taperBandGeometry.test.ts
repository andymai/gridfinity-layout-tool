import { describe, it, expect } from 'vitest';
import { hasTaperBand, innerRectIsDrawable, taperBandInnerRect } from './taperBandGeometry';

const NONE = { left: 0, right: 0, front: 0, back: 0 };

describe('hasTaperBand', () => {
  it('is false when every side is zero', () => {
    expect(hasTaperBand(NONE)).toBe(false);
  });

  it('is true when a single side is flared', () => {
    expect(hasTaperBand({ ...NONE, right: 3 })).toBe(true);
  });
});

describe('taperBandInnerRect', () => {
  it('insets each edge by that side alone', () => {
    // Asymmetric on purpose: the band is per-side, so a flare on the right must
    // not move the left edge.
    expect(taperBandInnerRect(100, 80, { left: 4, right: 6, front: 2, back: 8 })).toEqual({
      x0: 4,
      x1: 94,
      y0: 2,
      y1: 72,
    });
  });

  it('returns the full interior when nothing is flared', () => {
    expect(taperBandInnerRect(100, 80, NONE)).toEqual({ x0: 0, x1: 100, y0: 0, y1: 80 });
  });

  it('collapses to the centre line rather than inverting on an over-wide flare', () => {
    // A flare wider than the bin would otherwise give x1 < x0, and an inverted
    // hole paints the whole interior as band.
    const rect = taperBandInnerRect(20, 20, { left: 40, right: 40, front: 0, back: 0 });
    expect(rect.x0).toBe(10);
    expect(rect.x1).toBe(10);
    expect(innerRectIsDrawable(rect)).toBe(false);
  });

  it('ignores negative sides instead of growing past the interior', () => {
    expect(taperBandInnerRect(100, 80, { ...NONE, left: -5 }).x0).toBe(0);
  });
});

describe('innerRectIsDrawable', () => {
  it('accepts a rect with area', () => {
    expect(innerRectIsDrawable({ x0: 1, x1: 2, y0: 1, y1: 2 })).toBe(true);
  });

  it('rejects a zero-height rect', () => {
    expect(innerRectIsDrawable({ x0: 1, x1: 2, y0: 5, y1: 5 })).toBe(false);
  });
});
