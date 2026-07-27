import { describe, it, expect } from 'vitest';
import { DESIGNER_CONSTRAINTS, minHeightUnits } from './gridfinity';

describe('minHeightUnits', () => {
  it('holds an ordinary bin to the usable-cavity minimum', () => {
    expect(minHeightUnits(false)).toBe(DESIGNER_CONSTRAINTS.MIN_HEIGHT);
  });

  // #2915: a spacer is floorless, so the cavity rationale behind MIN_HEIGHT
  // doesn't bind — 1u is what shims a stack from an odd to an even height.
  it('lets a spacer go a unit lower', () => {
    expect(minHeightUnits(true)).toBe(DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT);
    expect(minHeightUnits(true)).toBeLessThan(minHeightUnits(false));
  });

  it('never returns a floor above the maximum height', () => {
    expect(minHeightUnits(false)).toBeLessThan(DESIGNER_CONSTRAINTS.MAX_HEIGHT);
  });
});
