import { describe, it, expect } from 'vitest';
import { isFractional, reorderForDisplay, type AxisCaps } from './splitReorder';

// Generous caps so reordering isn't constrained by edge limits.
const CAPS: AxisCaps = { maxFirst: 99, maxLast: 99, maxMiddle: 99 };

describe('isFractional', () => {
  it('detects half-units, not integers or noise', () => {
    expect(isFractional(3.5)).toBe(true);
    expect(isFractional(3)).toBe(false);
    expect(isFractional(3.0001)).toBe(false);
  });
});

describe('reorderForDisplay', () => {
  it('returns short arrays unchanged', () => {
    expect(reorderForDisplay([5], CAPS, false, false)).toEqual([5]);
  });

  it('sorts integer pieces descending (largest at front)', () => {
    expect(reorderForDisplay([4, 6, 5], CAPS, false, false)).toEqual([6, 5, 4]);
  });

  it('pins a fractional piece to the end by default', () => {
    const out = reorderForDisplay([2.5, 5, 4], CAPS, false, false);
    expect(out[out.length - 1]).toBe(2.5);
  });

  it('pins a fractional piece to the start when requested', () => {
    const out = reorderForDisplay([2.5, 5, 4], CAPS, true, false);
    expect(out[0]).toBe(2.5);
  });

  it('arranges palindromically under preferIdenticalPieces', () => {
    // [5,4,4] → pair (4,4) outer, leftover 5 in the middle.
    expect(reorderForDisplay([5, 4, 4], CAPS, false, true)).toEqual([4, 5, 4]);
  });

  it('respects edge caps, falling back to a feasible descending order', () => {
    // First slot caps at 4, so the 6 cannot sit at position 0.
    const caps: AxisCaps = { maxFirst: 4, maxLast: 99, maxMiddle: 99 };
    const out = reorderForDisplay([6, 4, 3], caps, false, false);
    expect(out[0]).toBeLessThanOrEqual(4);
  });
});
