import { describe, it, expect } from 'vitest';
import { DESIGNER_CONSTRAINTS, minHeightUnits } from './gridfinity';

describe('minHeightUnits', () => {
  it('holds an ordinary bin to the usable-cavity minimum', () => {
    expect(minHeightUnits({ spacer: false, style: 'standard' })).toBe(
      DESIGNER_CONSTRAINTS.MIN_HEIGHT
    );
  });

  // #2915: a spacer is floorless, so the cavity rationale behind MIN_HEIGHT
  // doesn't bind — 1u is what shims a stack from an odd to an even height.
  it('lets a spacer go a unit lower', () => {
    expect(minHeightUnits({ spacer: true, style: 'standard' })).toBe(
      DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT
    );
    expect(minHeightUnits({ spacer: true, style: 'standard' })).toBeLessThan(
      minHeightUnits({ spacer: false, style: 'standard' })
    );
  });

  // `deriveDimensions` makes the spacer flag inert on a flat base (no socket to
  // shell through), so the relaxed floor has to track the EFFECTIVE spacer or a
  // flat+spacer payload would buy 1u while generating an ordinary bin.
  it('holds a flat base to the bin minimum even when the spacer flag is set', () => {
    expect(minHeightUnits({ spacer: true, style: 'flat' })).toBe(DESIGNER_CONSTRAINTS.MIN_HEIGHT);
  });

  it('never returns a floor above the maximum height', () => {
    expect(minHeightUnits({ spacer: false, style: 'standard' })).toBeLessThan(
      DESIGNER_CONSTRAINTS.MAX_HEIGHT
    );
  });
});
